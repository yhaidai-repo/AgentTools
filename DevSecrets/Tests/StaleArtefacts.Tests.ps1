BeforeAll {
    . (Join-Path $PSScriptRoot '..' 'StaleArtefacts.Selection.ps1')

    $script:Now = [datetime]::new(2026, 10, 21, 3, 0, 0, [DateTimeKind]::Utc)

    function New-File([string] $Path, [int] $AgeDays, [string] $Content = 'x') {
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Path) | Out-Null
        Set-Content -LiteralPath $Path -Value $Content
        (Get-Item -LiteralPath $Path).LastWriteTimeUtc = $script:Now.AddDays(-$AgeDays)
    }

    function New-Worktree([hashtable] $Overrides) {
        $worktree = @{ Path = 'D:/Projects/PVS-wt/feature/33649-thing'; Branch = 'feature/33649-thing'; Dirty = $false; DirtyFiles = 0; HasUpstream = $true; Ahead = 0; PbiId = 33649; PbiClosedAt = $script:Now.AddDays(-30); Bytes = 10 }

        foreach ($key in $Overrides.Keys) {
            $worktree[$key] = $Overrides[$key]
        }

        return [pscustomobject] $worktree
    }
}

Describe 'Get-StaleLogs' {
    BeforeEach {
        $script:stack = Join-Path $TestDrive ([guid]::NewGuid().Guid)

        New-File (Join-Path $script:stack 'pvs-api.log') 10
        New-File (Join-Path $script:stack 'pvs-web.log') 2
        New-File (Join-Path $script:stack 'stack.json') 10
    }

    It 'takes only logs older than the buffer while the stack is stopped' {
        $logs = Get-StaleLogs $script:stack $false $script:Now 7

        $logs.Count | Should -Be 1
        $logs[0].Path | Should -Be (Join-Path $script:stack 'pvs-api.log')
    }

    It 'takes nothing while the stack runs' {
        (Get-StaleLogs $script:stack $true $script:Now 7).Count | Should -Be 0
    }
}

Describe 'Get-StaleRecordings' {
    BeforeEach {
        $script:recordings = Join-Path $TestDrive ([guid]::NewGuid().Guid)
        $script:inbox = Join-Path $TestDrive ([guid]::NewGuid().Guid)

        # Imported 10 days ago: transcript there, inbox file gone.
        New-File (Join-Path $script:recordings 'old-meeting' 'mic.wav') 10
        New-File (Join-Path $script:recordings 'old-meeting' 'transcript.md') 10
        # Imported, but recent.
        New-File (Join-Path $script:recordings 'new-meeting' 'mic.wav') 2
        New-File (Join-Path $script:recordings 'new-meeting' 'transcript.md') 2
        # Handed over, still waiting in the inbox.
        New-File (Join-Path $script:recordings 'waiting' 'system.wav') 10
        New-File (Join-Path $script:recordings 'waiting' 'transcript.md') 10
        New-File (Join-Path $script:inbox 'waiting.json') 10
        # Set aside in failed/.
        New-File (Join-Path $script:recordings 'failed-one' 'system.wav') 10
        New-File (Join-Path $script:recordings 'failed-one' 'transcript.md') 10
        New-File (Join-Path $script:inbox 'failed' 'failed-one.json') 10
        # Never transcribed: 20 and 40 days old.
        New-File (Join-Path $script:recordings 'test-20' 'mic.wav') 20
        New-File (Join-Path $script:recordings 'test-40' 'mic.wav') 40
    }

    It 'takes the audio of imported sessions after 7 days and of untouched ones after 30, never transcripts' {
        $audio = Get-StaleRecordings $script:recordings $script:inbox $script:Now 7 30
        $names = @($audio | ForEach-Object { Split-Path -Leaf (Split-Path -Parent $_.Path) }) | Sort-Object

        $names | Should -Be @('old-meeting', 'test-40')
        $audio | ForEach-Object { $_.Path | Should -BeLike '*.wav' }
    }
}

Describe 'Get-StaleScratch' {
    It 'takes folders nothing was written to for the buffer, by their newest file' {
        $root = Join-Path $TestDrive ([guid]::NewGuid().Guid)

        New-File (Join-Path $root 'old' 'a.txt') 10
        New-File (Join-Path $root 'active' 'old.txt') 10
        New-File (Join-Path $root 'active' 'sub' 'new.txt') 1

        $stale = Get-StaleScratch $root $script:Now 7

        @($stale).Count | Should -Be 1
        $stale[0].Path | Should -Be (Join-Path $root 'old')
    }
}

Describe 'Get-PbiClosedDate' {
    It 'reads the closed note from the backlog vault or its trash, and ignores open ones' {
        $backlog = Join-Path $TestDrive ([guid]::NewGuid().Guid)

        New-File (Join-Path $backlog 'work' 'pbi' 'PBI-100-closed' 'PBI-100.md') 1 "---`nid: `"PBI-100`"`nstatus: `"closed`"`nupdated: `"2026-10-01`"`n---`n# x"
        New-File (Join-Path $backlog 'work' '.trash' 'pbi' 'PBI-200-done' 'PBI-200.md') 1 "---`nstatus: `"done`"`nupdated: `"2026-09-15`"`n---"
        New-File (Join-Path $backlog 'work' 'pbi' 'PBI-300-open' 'PBI-300.md') 1 "---`nstatus: `"development`"`nupdated: `"2026-10-01`"`n---"

        (Get-PbiClosedDate $backlog 100) | Should -Be ([datetime]::new(2026, 10, 1))
        (Get-PbiClosedDate $backlog 200) | Should -Be ([datetime]::new(2026, 9, 15))
        (Get-PbiClosedDate $backlog 300) | Should -BeNullOrEmpty
        (Get-PbiClosedDate $backlog 400) | Should -BeNullOrEmpty
    }
}

Describe 'Get-PbiIdOfBranch' {
    It 'reads the id from type/id-name branches and nothing from other names' {
        Get-PbiIdOfBranch 'improvement/33649-dc-medicaid' | Should -Be 33649
        Get-PbiIdOfBranch 'feature/powerloom-artefact-cleanup' | Should -BeNullOrEmpty
        Get-PbiIdOfBranch 'main' | Should -BeNullOrEmpty
    }
}

Describe 'Select-Worktrees' {
    It 'removes only a clean, pushed worktree of a PBI closed long enough' {
        $result = Select-Worktrees @(New-Worktree @{}) $script:Now 14

        $result[0].Remove | Should -BeTrue
    }

    It 'keeps dirty, detached, local-only, unpushed, no-PBI, open and recently closed ones with the reason' {
        $cases = @(
            @{ Over = @{ Dirty = $true; DirtyFiles = 3 }; Reason = 'dirty*' },
            @{ Over = @{ Branch = $null }; Reason = 'detached*' },
            @{ Over = @{ HasUpstream = $false }; Reason = 'no remote*' },
            @{ Over = @{ Ahead = 2 }; Reason = '2 commit(s)*' },
            @{ Over = @{ Branch = 'feature/no-id'; PbiId = $null }; Reason = 'no PBI*' },
            @{ Over = @{ PbiClosedAt = $null }; Reason = '*not closed' },
            @{ Over = @{ PbiClosedAt = $script:Now.AddDays(-3) }; Reason = '*less than 14 d ago' },
            @{ Over = @{ Path = 'D:/Projects/PVS.Internal/.claude/worktrees/claude-x' }; Reason = "Claude Code's*" }
        )

        foreach ($case in $cases) {
            $result = Select-Worktrees @(New-Worktree $case.Over) $script:Now 14

            $result[0].Remove | Should -BeFalse
            $result[0].Reason | Should -BeLike $case.Reason
        }
    }
}
