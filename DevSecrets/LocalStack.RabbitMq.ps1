# The local RabbitMQ container of a stack: compose project, static definitions, shovel to Service Bus (dot-sourced).

$RabbitComposeProject = "devsecrets-rabbitmq"
$RabbitComposeFile = Join-Path $StoreDir "rabbitmq/compose.yml"
$RabbitServiceBusValue = "signals-servicebus"
$RabbitShovelTopicValue = "local-instance"
$RabbitShovelName = "fw-cloudevents-to-sb"
$RabbitVhost = "pvs-local"
$RabbitCredential = [pscredential]::new("guest", (ConvertTo-SecureString "guest" -AsPlainText -Force))

function ConvertTo-ServiceBusAmqpUri([string] $ConnectionString) {
    $parts = @{}
    $ConnectionString -split ';' | Where-Object { $_ -match '=' } | ForEach-Object { $k, $v = $_ -split '=', 2; $parts[$k] = $v }
    $serviceBusHost = ([uri] $parts['Endpoint']).Host
    $keyName = [uri]::EscapeDataString($parts['SharedAccessKeyName'])
    $key = [uri]::EscapeDataString($parts['SharedAccessKey'])

    # AMQP 1.0 with the SAS key name and key as SASL PLAIN credentials. verify_none: Erlang's hostname check rejects
    # the wildcard certificate of *.servicebus.windows.net; the connection is still TLS-encrypted.
    return "amqps://${keyName}:${key}@${serviceBusHost}:5671?sasl=plain&verify=verify_none"
}

function Invoke-RabbitApi([string] $ManagementUrl, [string] $Method, [string] $Path, [string] $Body) {
    $arguments = @{ Method = $Method; Uri = "$ManagementUrl/api/$Path"; Credential = $RabbitCredential; AllowUnencryptedAuthentication = $true }

    if ($Body) {
        $arguments.ContentType = "application/json"
        $arguments.Body = $Body
    }

    return Invoke-RestMethod @arguments
}

function Set-RabbitShovel([string] $ManagementUrl, [hashtable] $Named) {
    # Created after the broker is up, not from the definitions file: a shovel defined there starts before the
    # listeners and dies, and the definitions file would hold the Service Bus key.
    $shovel = @{
        value = @{
            "src-protocol" = "amqp091"
            "src-uri" = "amqp://guest:guest@localhost/$RabbitVhost"
            "src-queue" = "cloud-events.fw.service-bus"
            "dest-protocol" = "amqp10"
            "dest-uri" = ConvertTo-ServiceBusAmqpUri $Named[$RabbitServiceBusValue]
            "dest-address" = "$($Named[$RabbitShovelTopicValue])-signals-integration-events"
            "ack-mode" = "on-confirm"
        }
    }

    Invoke-RabbitApi $ManagementUrl "Put" "parameters/shovel/$RabbitVhost/$RabbitShovelName" ($shovel | ConvertTo-Json -Depth 3) | Out-Null
}

function Get-RabbitShovelState([string] $ManagementUrl) {
    $shovel = Invoke-RabbitApi $ManagementUrl "Get" "shovels/$RabbitVhost" | Where-Object { $_.name -eq $RabbitShovelName }

    return "$($shovel.state)$(if ($shovel.reason) { " ($($shovel.reason))" })"
}

function Invoke-RabbitCompose([string[]] $Arguments) {
    docker compose -p $RabbitComposeProject -f $RabbitComposeFile @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw "docker compose $($Arguments -join ' ') failed for the local RabbitMQ"
    }
}

function Start-LocalRabbitMq([hashtable] $Named, [hashtable] $Service) {
    $managementUrl = $Service.run.managementUrl

    Invoke-RabbitCompose @("up", "-d", "--wait")
    Set-RabbitShovel $managementUrl $Named
    Write-Host "Started rabbitmq ($($Service.localUrl), management $managementUrl); the shovel connects once Signals has created its topic"

    return @{
        name = "rabbitmq"
        kind = "compose"
        url = $managementUrl
    }
}

function Test-LocalRabbitMqRunning() {
    $containers = docker compose -p $RabbitComposeProject -f $RabbitComposeFile ps -q 2>$null

    return -not [string]::IsNullOrWhiteSpace(($containers | Out-String))
}

function Stop-LocalRabbitMq() {
    Invoke-RabbitCompose @("down")
    Write-Host "Stopped rabbitmq"
}
