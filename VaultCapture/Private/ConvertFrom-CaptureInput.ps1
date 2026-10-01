function ConvertFrom-CaptureInput {
    param(
        [Parameter(Mandatory)][object]$InputObject,
        [Parameter(Mandatory)][object]$Rules
    )

    $sections = [ordered]@{}

    Add-InputSection -Sections $sections -Heading $Rules.draft.firstSection -Bullets $InputObject.captured
    foreach ($property in Get-ExtraSectionProperty -InputObject $InputObject) {
        Add-InputSection -Sections $sections -Heading $property.Name -Bullets $property.Value
    }

    Add-InputSection -Sections $sections -Heading $Rules.draft.assumptionsSection -Bullets $InputObject.assumptions
    Add-InputSection -Sections $sections -Heading $Rules.draft.lastSection -Bullets $InputObject.toFill

    return New-CaptureRequest -Vault $InputObject.vault -Project $InputObject.project `
        -Name ([string]$InputObject.name -replace '\.md$', '') -Title $InputObject.title `
        -Source $InputObject.source -Target $InputObject.target -Sections $sections `
        -Agent $InputObject.agent -Session $InputObject.session
}

function Get-ExtraSectionProperty {
    param([Parameter(Mandatory)][object]$InputObject)

    if (-not $InputObject.sections) {
        return @()
    }

    return @($InputObject.sections.PSObject.Properties | Where-Object { $_.Name })
}

function Add-InputSection {
    param(
        [Parameter(Mandatory)][Collections.Specialized.OrderedDictionary]$Sections,
        [Parameter(Mandatory)][string]$Heading,
        [object[]]$Bullets
    )

    $cleanBullets = @($Bullets | ForEach-Object { ConvertTo-BulletText -Text ([string]$_) } | Where-Object { $_ })
    if ($cleanBullets.Count -eq 0) {
        return
    }

    $Sections[$Heading] = $cleanBullets
}

# Bullets stay one line each; the module, not the agent, owns the "- " marker.
function ConvertTo-BulletText {
    param([string]$Text)

    return ($Text -replace '\s*\r?\n\s*', ' ' -replace '^\s*[-*]\s+', '').Trim()
}
