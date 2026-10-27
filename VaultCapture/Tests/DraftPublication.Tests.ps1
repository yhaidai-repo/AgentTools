BeforeAll {
    $script:modulePath = Join-Path $PSScriptRoot '..' 'VaultCapture.psd1'
    Import-Module $modulePath -Force
    function New-Input([hashtable]$Override = @{}) {
        $data = @{ vault = (Split-Path -Leaf $script:root); project = 'pos'; name = 'pos-concurrent'; title = 'Topic'; source = 'session finding'; target = '[[pos-index]]'; captured = @('Shared fact') }
        foreach ($key in $Override.Keys) { $data[$key] = $Override[$key] }
        [pscustomobject]$data
    }
    function Invoke-Writers([int]$Count, [object]$InputObject) {
        $gate = Join-Path $script:root 'gate'
        $jobs = 1..$Count | ForEach-Object {
            Start-Job -ArgumentList $script:modulePath, $InputObject, $script:config, $_, $gate -ScriptBlock {
                param($module, $inputData, $config, $number, $gate)
                Import-Module $module -Force
                & (Get-Module VaultCapture) {
                    $script:originalRead = ${function:Read-DraftFile}
                    function script:Read-DraftFile {
                        param($Path, $Root, $ScopeRoot)
                        $draft = & $script:originalRead -Path $Path -Root $Root -ScopeRoot $ScopeRoot
                        Start-Sleep -Milliseconds 200
                        return $draft
                    }
                }
                [IO.File]::WriteAllText("$gate.$number", 'ready')
                $deadline = [datetime]::UtcNow.AddSeconds(30)
                while (-not [IO.File]::Exists($gate)) {
                    if ([datetime]::UtcNow -gt $deadline) { throw 'test gate timed out' }
                    Start-Sleep -Milliseconds 20
                }
                $inputData.captured = @("Writer $number", 'Shared fact', "Writer $number")
                Save-VaultCapture -InputObject $inputData -Config $config
            }
        }
        try {
            $deadline = [datetime]::UtcNow.AddSeconds(30)
            while (@(Get-ChildItem -LiteralPath $script:root -Filter 'gate.*').Count -lt $Count) {
                if ([datetime]::UtcNow -gt $deadline) { throw 'writers did not become ready' }
                Start-Sleep -Milliseconds 20
            }
            [IO.File]::WriteAllText($gate, 'go')
            $jobs | Wait-Job -Timeout 30 | Receive-Job -ErrorAction Stop
            if (@($jobs | Where-Object State -ne Completed).Count) { throw 'writer did not finish' }
        }
        finally { $jobs | Remove-Job -Force }
    }
}

Describe 'Draft publication and final rendering' {
    BeforeEach {
        $script:root = Join-Path $TestDrive ([guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory (Join-Path $root 'pos'), (Join-Path $root 'draft') -Force | Out-Null
        @('---', 'project: pos', "repo: $root", '---') | Set-Content (Join-Path $root 'pos/pos-index.md')
        $script:config = [pscustomobject]@{ vaults = @($root) }
        $script:path = Join-Path $root 'draft/pos-concurrent.md'
    }

    It 'serializes actual exported saves across processes during creation and append' -ForEach @(@{ Existing = $false }, @{ Existing = $true }) {
        if ($Existing) { (Save-VaultCapture -InputObject (New-Input) -Config $config).ok | Should -BeTrue }
        $results = @(Invoke-Writers 4 (New-Input))
        @($results | Where-Object ok).Count | Should -Be 4 -Because ($results.errors -join '; ')
        $content = [IO.File]::ReadAllLines($path)
        foreach ($number in 1..4) { @($content | Where-Object { $_ -eq "- Writer $number" }).Count | Should -Be 1 }
        @($content | Where-Object { $_ -eq '- Shared fact' }).Count | Should -Be 1
    }

    It 'checks the latest content under the lock before allowing a concurrent append' {
        (Save-VaultCapture -InputObject (New-Input) -Config $config).ok | Should -BeTrue
        $initial = [IO.File]::ReadAllLines($path).Count
        (Save-VaultCapture -InputObject (New-Input @{ captured = @(1..(79 - $initial) | ForEach-Object { "Filler $_" }) }) -Config $config).ok | Should -BeTrue
        $results = @(Invoke-Writers 2 (New-Input))
        @($results | Where-Object ok).Count | Should -Be 1
        @($results | Where-Object { -not $_.ok }).Count | Should -Be 1
        [IO.File]::ReadAllLines($path).Count | Should -Be 80
    }

    It 'keeps the prior draft after publication failure, removes temporary files and releases its lock' {
        (Save-VaultCapture -InputObject (New-Input) -Config $config).ok | Should -BeTrue
        $original = [IO.File]::ReadAllText($path)
        Mock Publish-DraftFile -ModuleName VaultCapture { throw 'synthetic publication failure' }
        $result = Save-VaultCapture -InputObject (New-Input @{ captured = @('Rejected fact') }) -Config $config
        $result.ok | Should -BeFalse
        [IO.File]::ReadAllText($path) | Should -BeExactly $original
        @(Get-ChildItem -LiteralPath (Split-Path -Parent $path) -Force -Filter '*.tmp').Count | Should -Be 0
        # Other processes use the unmocked module and must be able to acquire the released file handle.
        @((Invoke-Writers 2 (New-Input)) | Where-Object ok).Count | Should -Be 2
    }

    It 'round-trips multiline metadata as YAML and normalizes Markdown headings' -ForEach @(@{ Eol = "`n" }, @{ Eol = "`r`n" }) {
        $title = ('a title: "quoted" # true\path' + $Eol) * 85
        $source = "session finding$Eol" + '# more source'
        $target = "[[pos-index]]$Eol" + 'folder: other'
        $inputData = New-Input @{ title = $title; source = $source; target = $target; sections = [pscustomobject]@{ "Extra${Eol}heading" = @('Other fact') } }
        $result = Save-VaultCapture -InputObject $inputData -Config $config
        $result.ok | Should -BeTrue -Because ($result.errors -join '; ')
        $lines = [IO.File]::ReadAllLines($path)
        $lines.Count | Should -BeLessOrEqual 80
        @($lines | Where-Object { $_ -like '# *' }).Count | Should -Be 1
        $lines | Should -Contain '## Extra heading'
        # Parse the actual emitted YAML with the runtime's installed parser, not a custom approximation.
        $yaml = node -e 'const fs=require("node:fs"),y=require("js-yaml");const s=fs.readFileSync(process.argv[1],"utf8").split("---")[1];process.stdout.write(JSON.stringify(y.load(s,{schema:y.FAILSAFE_SCHEMA})))' $path
        $LASTEXITCODE | Should -Be 0
        $metadata = $yaml | ConvertFrom-Json
        $metadata.title | Should -BeExactly $title
        $metadata.source | Should -BeExactly $source
        $metadata.target | Should -BeExactly $target
    }

    It 'enforces exact physical-line edges and preserves LF or CRLF after rejection' -ForEach @(@{ Eol = "`n" }, @{ Eol = "`r`n" }) {
        (Save-VaultCapture -InputObject (New-Input) -Config $config).ok | Should -BeTrue
        $lines = [IO.File]::ReadAllLines($path)
        [IO.File]::WriteAllText($path, ($lines -join $Eol) + $Eol)
        $filler = @(1..(80 - $lines.Count) | ForEach-Object { "Filler $_" })
        (Save-VaultCapture -InputObject (New-Input @{ captured = $filler }) -Config $config).ok | Should -BeTrue
        [IO.File]::ReadAllLines($path).Count | Should -Be 80
        $before = [IO.File]::ReadAllText($path)
        $result = Save-VaultCapture -InputObject (New-Input @{ captured = @('Excess') }) -Config $config
        $result.ok | Should -BeFalse
        [IO.File]::ReadAllText($path) | Should -BeExactly $before
        $before.Contains("`r`n") | Should -Be ($Eol -eq "`r`n")
    }
}
