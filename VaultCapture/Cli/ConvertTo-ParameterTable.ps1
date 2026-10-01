# Turns "-Name value -Flag -Name value2" into a splattable table. A repeated name collects its values into an array.
function ConvertTo-ParameterTable {
    param([object[]]$Arguments = @())

    $table = @{}
    $step = 1

    for ($index = 0; $index -lt $Arguments.Count; $index += $step) {
        $step = Add-ParameterEntry -Table $table -Arguments $Arguments -Index $index
    }

    return $table
}

function Add-ParameterEntry {
    param(
        [Parameter(Mandatory)][hashtable]$Table,
        [Parameter(Mandatory)][object[]]$Arguments,
        [Parameter(Mandatory)][int]$Index
    )

    $token = [string]$Arguments[$Index]
    if (-not (Test-ParameterName -Token $token)) {
        throw "Expected a parameter name like -Path, got '$token'."
    }

    $name = $token.TrimStart('-')
    $nextIndex = $Index + 1
    $hasValue = $nextIndex -lt $Arguments.Count -and -not (Test-ParameterName -Token ([string]$Arguments[$nextIndex]))

    if (-not $hasValue) {
        $Table[$name] = $true

        return 1
    }

    Add-TableValue -Table $Table -Name $name -Value $Arguments[$nextIndex]

    return 2
}

function Test-ParameterName {
    param([string]$Token)

    return $Token -match '^-[A-Za-z]'
}

function Add-TableValue {
    param(
        [Parameter(Mandatory)][hashtable]$Table,
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][object]$Value
    )

    if (-not $Table.ContainsKey($Name)) {
        $Table[$Name] = $Value

        return
    }

    $Table[$Name] = @($Table[$Name]) + $Value
}
