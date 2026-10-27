# The local Redis container of a stack (dot-sourced): the cache of the services run locally, so a stack never shares
# cached settings and sessions with another environment (seen 2026-10-20: a shared Redis served a settings dictionary
# without the password-expiry key, and the dev Azure Redis is unreachable from this PC).

$RedisComposeProject = "devsecrets-redis"
$RedisComposeFile = Join-Path $PSScriptRoot "redis/compose.yml"

function Invoke-RedisCompose([string[]] $Arguments) {
    docker compose -p $RedisComposeProject -f $RedisComposeFile @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw "docker compose $($Arguments -join ' ') failed for the local Redis"
    }
}

function Start-LocalRedis([hashtable] $Service, [hashtable] $State) {
    if (Test-LocalRedisExists) { throw 'Local Redis already exists; it is not owned by this start attempt.' }
    $entry = @{ name = 'redis'; kind = 'compose'; url = $Service.run.url }
    $State.services += $entry
    Save-StackState $State
    Invoke-RedisCompose @("up", "-d", "--wait")
    Write-Host "Started redis ($($Service.run.url)); the stack's services cache there"

    return $entry
}

function Test-LocalRedisExists() {
    $containers = Invoke-RedisCompose @('ps', '--all', '--quiet')
    return -not [string]::IsNullOrWhiteSpace(($containers | Out-String))
}

function Test-LocalRedisRunning() {
    $containers = docker compose -p $RedisComposeProject -f $RedisComposeFile ps -q 2>$null

    return -not [string]::IsNullOrWhiteSpace(($containers | Out-String))
}

function Stop-LocalRedis() {
    Invoke-RedisCompose @("down")
    Write-Host "Stopped redis"
}
