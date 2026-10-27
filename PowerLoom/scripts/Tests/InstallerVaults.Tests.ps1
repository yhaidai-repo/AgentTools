BeforeAll {
    $ast = [Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot '..' 'install.ps1'), [ref]$null, [ref]$null)
    foreach ($definition in $ast.FindAll({ param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] }, $false)) {
        . ([scriptblock]::Create($definition.Extent.Text))
    }
    function New-HttpFailure([int]$Status) {
        $exception = [Exception]::new("HTTP $Status")
        $exception | Add-Member NoteProperty Response ([pscustomobject]@{ StatusCode = $Status })
        return $exception
    }
}
Describe 'Required installer vault outcomes' {
    BeforeEach {
        $script:outcomes = @{ '/vaults/a' = 200; '/vaults/b' = 200 }
        $script:attempts = [Collections.Generic.List[string]]::new()
        Mock Invoke-RestMethod {
            param($Body)
            $path = ($Body | ConvertFrom-Json).folder
            $script:attempts.Add($path)
            if ($outcomes[$path] -ne 200) { throw (New-HttpFailure $outcomes[$path]) }
        }
        Mock Set-Providers {}
        Mock Show-NextSteps {}
    }
    It 'completes after successful required vault creation' {
        Complete-Installation 'http://synthetic.invalid' @('/vaults/a', '/vaults/b')
        $attempts.Count | Should -Be 2
        Should -Invoke Show-NextSteps -Exactly -Times 1
    }
    It 'explicitly accepts an already existing vault on retry' {
        $outcomes['/vaults/a'] = 409
        Complete-Installation 'http://synthetic.invalid' @('/vaults/a', '/vaults/b')
        Should -Invoke Show-NextSteps -Exactly -Times 1
    }
    It 'fails unexpected HTTP responses before optional setup or success' -ForEach @(@{ Status = 400 }, @{ Status = 403 }, @{ Status = 503 }) {
        $outcomes['/vaults/a'] = $Status
        { Complete-Installation 'http://synthetic.invalid' @('/vaults/a') } | Should -Throw '*Required vault setup failed*Vault /vaults/a*kept*rerun*'
        Should -Invoke Set-Providers -Times 0
        Should -Invoke Show-NextSteps -Times 0
    }
    It 'collects partial or total failure while trying every requested vault' -ForEach @(@{ FailBoth = $false }, @{ FailBoth = $true }) {
        $outcomes['/vaults/a'] = 503
        if ($FailBoth) { $outcomes['/vaults/b'] = 503 }
        $failure = $null
        try { Complete-Installation 'http://synthetic.invalid' @('/vaults/a', '/vaults/b') } catch { $failure = $_ }
        $failure | Should -Not -BeNullOrEmpty
        $failure.Exception.Message | Should -BeLike '*Vault /vaults/a*'
        if ($FailBoth) { $failure.Exception.Message | Should -BeLike '*Vault /vaults/b*' }
        $attempts.Count | Should -Be 2
        Should -Invoke Show-NextSteps -Times 0
    }
    It 'propagates a connection failure as unsuccessful installation' {
        Mock Invoke-RestMethod { throw [IO.IOException]::new('Connection failed') }
        { Complete-Installation 'http://synthetic.invalid' @('/vaults/a') } | Should -Throw '*Vault /vaults/a*Connection failed*'
        Should -Invoke Show-NextSteps -Times 0
    }
}
