BeforeAll {
    . (Join-Path $PSScriptRoot ".." "Set-AiProviders.ps1") -Api "http://powerloom.test"

    function New-Providers([bool]$claude, [bool]$codex, [string]$claudeSource = "settings") {
        return @(
            [pscustomobject]@{ provider = "anthropic"; label = "Claude"; connected = $claude; source = if ($claude) { $claudeSource } else { $null } },
            [pscustomobject]@{ provider = "openai-codex"; label = "Codex"; connected = $codex; source = if ($codex) { "settings" } else { $null } }
        )
    }

    function New-Apps([string]$current, [bool]$codexConnected) {
        return [pscustomobject]@{
            current = $current
            apps    = @(
                [pscustomobject]@{ id = "claude-desktop"; label = "Claude"; connected = $true },
                [pscustomobject]@{ id = "codex-desktop"; label = "Codex"; connected = $codexConnected }
            )
        }
    }
}

Describe "Set-AiProviders" {
    BeforeEach {
        $ClaudeToken = ""
        $ChatApp = ""
        $ConnectCodex = $false
        $NonInteractive = $false
        $CodexPollSeconds = 0
        $env:CLAUDE_CODE_OAUTH_TOKEN = $null
        Mock Write-Host {}
        Mock Write-Warning {}
        Mock Start-Sleep {}
        Mock Read-Host { "" }
    }

    Context "Claude" {
        It "saves a typed token and says so" {
            Mock Invoke-PowerLoom { New-Providers $false $false } -ParameterFilter { $path -eq "/api/ai-providers" }
            Mock Invoke-PowerLoom {} -ParameterFilter { $path -eq "/api/ai-providers/claude/token" }
            Mock Read-Secret { "sk-ant-oat01-typed" }

            Set-Claude

            Should -Invoke Invoke-PowerLoom -ParameterFilter { $path -eq "/api/ai-providers/claude/token" -and $method -eq "Put" -and $body.token -eq "sk-ant-oat01-typed" } -Times 1 -Exactly
            Should -Invoke Write-Host -ParameterFilter { $Object -eq "Claude: connected with the token saved in Settings." }
        }

        It "takes CLAUDE_CODE_OAUTH_TOKEN from the environment without asking" {
            $env:CLAUDE_CODE_OAUTH_TOKEN = "sk-ant-oat01-env"
            Mock Invoke-PowerLoom { New-Providers $false $false } -ParameterFilter { $path -eq "/api/ai-providers" }
            Mock Invoke-PowerLoom {} -ParameterFilter { $path -eq "/api/ai-providers/claude/token" }
            Mock Read-Secret { throw "asked" }

            Set-Claude

            Should -Invoke Invoke-PowerLoom -ParameterFilter { $body.token -eq "sk-ant-oat01-env" } -Times 1 -Exactly
        }

        It "leaves a connected Claude as it is and asks nothing" {
            Mock Invoke-PowerLoom { New-Providers $true $false "env" } -ParameterFilter { $path -eq "/api/ai-providers" }
            Mock Read-Secret { throw "asked" }

            Set-Claude

            Should -Invoke Write-Host -ParameterFilter { $Object -eq "Claude: connected (CLAUDE_CODE_OAUTH_TOKEN in .env)." }
            Should -Invoke Invoke-PowerLoom -ParameterFilter { $path -eq "/api/ai-providers/claude/token" } -Times 0
        }

        It "is skipped on Enter and when nothing may be asked" {
            Mock Invoke-PowerLoom { New-Providers $false $false } -ParameterFilter { $path -eq "/api/ai-providers" }
            Mock Read-Secret { "" }

            Set-Claude
            $NonInteractive = $true
            Set-Claude

            Should -Invoke Read-Secret -Times 1 -Exactly
            Should -Invoke Write-Host -ParameterFilter { $Object -like "Claude: skipped*" } -Times 2 -Exactly
        }

        It "warns with PowerLoom's reason when the token is refused, and goes on" {
            Mock Invoke-PowerLoom { New-Providers $false $false } -ParameterFilter { $path -eq "/api/ai-providers" }
            Mock Invoke-PowerLoom { throw "refused" } -ParameterFilter { $path -eq "/api/ai-providers/claude/token" }
            Mock Get-ProblemText { "Paste the token claude setup-token prints." }
            Mock Read-Secret { "two words" }

            { Set-Claude } | Should -Not -Throw

            Should -Invoke Write-Warning -ParameterFilter { $Message -like "Claude: not saved: Paste the token*" }
        }
    }

    Context "Codex" {
        It "is skipped unless the user says yes" {
            Mock Invoke-PowerLoom { New-Providers $true $false } -ParameterFilter { $path -eq "/api/ai-providers" }
            Mock Invoke-PowerLoom { throw "started" } -ParameterFilter { $path -eq "/api/ai-providers/codex/login" }
            Mock Read-Host { "n" }

            Set-Codex

            Should -Invoke Write-Host -ParameterFilter { $Object -like "Codex: skipped*" }
        }

        It "shows the link and code, then waits until the sign-in is done" {
            $script:polls = 0
            Mock Invoke-PowerLoom { New-Providers $true $false } -ParameterFilter { $path -eq "/api/ai-providers" }
            Mock Invoke-PowerLoom { [pscustomobject]@{ verificationUri = "https://auth.openai.com/codex/device"; userCode = "ABCD-12345"; output = "" } } -ParameterFilter { $method -eq "Post" -and $path -eq "/api/ai-providers/codex/login" }
            Mock Invoke-PowerLoom { $script:polls++; [pscustomobject]@{ status = if ($script:polls -lt 3) { "pending" } else { "done" }; error = $null } } -ParameterFilter { $method -eq "Get" -and $path -eq "/api/ai-providers/codex/login" }
            Mock Read-Host { "y" }

            Set-Codex

            Should -Invoke Write-Host -ParameterFilter { $Object -like "*Device code authorization*" }
            Should -Invoke Write-Host -ParameterFilter { $Object -eq "Open https://auth.openai.com/codex/device and enter the code ABCD-12345, then sign in with your ChatGPT account." }
            Should -Invoke Write-Host -ParameterFilter { $Object -eq "Codex: connected." }
            $script:polls | Should -Be 3
        }

        It "shows the CLI's own text when the code couldn't be read, and says why the sign-in failed" {
            $ConnectCodex = $true
            Mock Invoke-PowerLoom { New-Providers $true $false } -ParameterFilter { $path -eq "/api/ai-providers" }
            Mock Invoke-PowerLoom { [pscustomobject]@{ verificationUri = $null; userCode = $null; output = "Something new" } } -ParameterFilter { $method -eq "Post" }
            Mock Invoke-PowerLoom { [pscustomobject]@{ status = "failed"; error = "device codes are switched off" } } -ParameterFilter { $method -eq "Get" -and $path -eq "/api/ai-providers/codex/login" }

            Set-Codex

            Should -Invoke Read-Host -Times 0
            Should -Invoke Write-Host -ParameterFilter { $Object -eq "Something new" }
            Should -Invoke Write-Warning -ParameterFilter { $Message -like "Codex: not connected: device codes are switched off*" }
        }

        It "leaves a connected Codex as it is" {
            Mock Invoke-PowerLoom { New-Providers $true $true } -ParameterFilter { $path -eq "/api/ai-providers" }

            Set-Codex

            Should -Invoke Write-Host -ParameterFilter { $Object -eq "Codex: connected." }
            Should -Invoke Read-Host -Times 0
        }
    }

    Context "Chat app" {
        It "asks only when more than one app is connected and saves the pick" {
            Mock Invoke-PowerLoom { New-Apps "claude-desktop" $true } -ParameterFilter { $path -eq "/api/chats/apps" }
            Mock Invoke-PowerLoom {} -ParameterFilter { $path -eq "/api/chats/app" }
            Mock Read-Host { "2" }

            Set-ChatApp

            Should -Invoke Invoke-PowerLoom -ParameterFilter { $path -eq "/api/chats/app" -and $body.launcher -eq "codex-desktop" } -Times 1 -Exactly
            Should -Invoke Write-Host -ParameterFilter { $Object -eq "Chat app: Codex." }
        }

        It "keeps the current app without asking while only Claude is connected" {
            Mock Invoke-PowerLoom { New-Apps "claude-desktop" $false } -ParameterFilter { $path -eq "/api/chats/apps" }

            Set-ChatApp

            Should -Invoke Read-Host -Times 0
            Should -Invoke Write-Host -ParameterFilter { $Object -eq "Chat app: Claude." }
        }

        It "takes -ChatApp without asking and passes PowerLoom's refusal on" {
            $ChatApp = "codex-desktop"
            Mock Invoke-PowerLoom { New-Apps "claude-desktop" $false } -ParameterFilter { $path -eq "/api/chats/apps" }
            Mock Invoke-PowerLoom { throw "refused" } -ParameterFilter { $path -eq "/api/chats/app" }
            Mock Get-ProblemText { "Connect Codex in Settings -> AI providers before choosing it as the chat app." }

            Set-ChatApp

            Should -Invoke Read-Host -Times 0
            Should -Invoke Write-Warning -ParameterFilter { $Message -like "Chat app: not changed: Connect Codex*" }
        }
    }

    It "finds one provider in PowerLoom's list answer, which Invoke-RestMethod hands on as one array" {
        Mock Invoke-RestMethod { Write-Output -NoEnumerate (New-Providers $true $false) }

        $codex = Get-Provider "openai-codex"

        $codex.provider | Should -Be "openai-codex"
        $codex.connected | Should -BeFalse
    }

    It "reads PowerLoom's address from .env when -Api isn't given" {
        Mock Get-Content { "POWERLOOM_PORT=5999   # the backend" }

        Get-DefaultApi | Should -Be "http://127.0.0.1:5999"
    }
}
