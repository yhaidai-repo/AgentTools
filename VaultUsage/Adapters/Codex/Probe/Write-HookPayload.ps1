$ErrorActionPreference = 'Stop'

function Get-ProbePath {
    if ($env:CODEX_HOOK_PROBE_LOG) {
        return [IO.Path]::GetFullPath($env:CODEX_HOOK_PROBE_LOG)
    }

    return Join-Path ([Environment]::GetFolderPath('UserProfile')) '.vault-usage' 'codex-probe.jsonl'
}

function Write-HookPayload {
    $inputText = [Console]::In.ReadToEnd()
    $payload = ConvertFrom-Json -InputObject $inputText -Depth 100
    $line = ConvertTo-Json -InputObject $payload -Compress -Depth 100
    $path = Get-ProbePath

    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($path)) | Out-Null
    [IO.File]::AppendAllText($path, $line + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
}

try {
    Write-HookPayload
}
catch {
    # A diagnostic hook must never interrupt a session, including when its log is unavailable.
}

exit 0
