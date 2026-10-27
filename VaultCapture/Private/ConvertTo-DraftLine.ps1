function ConvertTo-DraftLine {
    param(
        [Parameter(Mandatory)][object]$Request,
        [Parameter(Mandatory)][object]$Rules,
        [Parameter(Mandatory)][datetime]$CapturedAt
    )

    $frontmatter = @(
        '---'
        "title: $(ConvertTo-YamlString -Value $Request.Title)"
        'type: draft'
        'status: draft'
        "project: $($Request.Project)"
        "captured: $($CapturedAt.ToString('yyyy-MM-dd'))"
        "source: $(ConvertTo-YamlString -Value $Request.Source)"
        "target: $(ConvertTo-YamlString -Value $Request.Target)"
        '---'
        "# $(ConvertTo-DraftHeading $Request.Title)"
    )
    $sections = Add-DefaultToFill -Sections $Request.Sections -Rules $Rules

    return $frontmatter + @($sections.Keys | ForEach-Object { ConvertTo-SectionLine -Heading $_ -Bullets $sections[$_] })
}

function Add-DefaultToFill {
    param(
        [Parameter(Mandatory)][Collections.Specialized.OrderedDictionary]$Sections,
        [Parameter(Mandatory)][object]$Rules
    )

    $withDefault = [ordered]@{}

    foreach ($heading in $Sections.Keys) {
        $withDefault[$heading] = $Sections[$heading]
    }

    if (-not $withDefault.Contains($Rules.draft.lastSection)) {
        $withDefault[$Rules.draft.lastSection] = @($Rules.draft.defaultToFill)
    }

    return $withDefault
}

function ConvertTo-SectionLine {
    param(
        [Parameter(Mandatory)][string]$Heading,
        [Parameter(Mandatory)][string[]]$Bullets
    )

    return @('', "## $(ConvertTo-DraftHeading $Heading)") + ($Bullets | ForEach-Object { "- $_" })
}

function ConvertTo-YamlString {
    param([string]$Value)

    # JSON double-quoted scalars are valid YAML and preserve newlines, quotes and control characters.
    return ConvertTo-Json -InputObject ([string]$Value) -Compress
}

function ConvertTo-DraftHeading([string]$Value) {
    return ($Value -replace '\s*[\r\n]+\s*', ' ').Trim()
}
