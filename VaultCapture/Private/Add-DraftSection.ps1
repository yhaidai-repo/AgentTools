# Appends bullets to an existing draft: into a section with the same heading, or as a new section before the last one.
function Add-DraftSection {
    param(
        [Parameter(Mandatory)][AllowEmptyString()][string[]]$Lines,
        [Parameter(Mandatory)][Collections.Specialized.OrderedDictionary]$Sections,
        [Parameter(Mandatory)][object]$Rules
    )

    $draft = [Collections.Generic.List[string]]::new([string[]]$Lines)

    foreach ($heading in $Sections.Keys) {
        Add-SectionBullet -Draft $draft -Heading $heading -Bullets $Sections[$heading] -LastSection $Rules.draft.lastSection
    }

    return $draft.ToArray()
}

function Add-SectionBullet {
    param(
        [Parameter(Mandatory)][AllowEmptyString()][Collections.Generic.List[string]]$Draft,
        [Parameter(Mandatory)][string]$Heading,
        [Parameter(Mandatory)][string[]]$Bullets,
        [Parameter(Mandatory)][string]$LastSection
    )

    $headingIndex = $Draft.IndexOf("## $Heading")
    if ($headingIndex -lt 0) {
        $Draft.InsertRange((Get-NewSectionIndex -Draft $Draft -LastSection $LastSection), [string[]](ConvertTo-SectionLine -Heading $Heading -Bullets $Bullets))

        return
    }

    $sectionEnd = Get-SectionContentEnd -Draft $Draft -HeadingIndex $headingIndex
    $existing = $Draft.GetRange($headingIndex, $sectionEnd - $headingIndex)
    $newBullets = @($Bullets | Where-Object { $existing -notcontains "- $_" } | ForEach-Object { "- $_" })

    $Draft.InsertRange($sectionEnd, [string[]]$newBullets)
}

function Get-NewSectionIndex {
    param(
        [Parameter(Mandatory)][AllowEmptyString()][Collections.Generic.List[string]]$Draft,
        [Parameter(Mandatory)][string]$LastSection
    )

    $lastSectionIndex = $Draft.IndexOf("## $LastSection")
    if ($lastSectionIndex -lt 0) {
        return Get-SectionContentEnd -Draft $Draft -HeadingIndex ($Draft.Count - 1)
    }

    return Get-LastContentIndex -Draft $Draft -Before $lastSectionIndex
}

# End of a section = after its last non-blank line, before the next "## " heading.
function Get-SectionContentEnd {
    param(
        [Parameter(Mandatory)][AllowEmptyString()][Collections.Generic.List[string]]$Draft,
        [Parameter(Mandatory)][int]$HeadingIndex
    )

    $nextHeading = $HeadingIndex + 1

    while ($nextHeading -lt $Draft.Count -and -not $Draft[$nextHeading].StartsWith('## ')) {
        $nextHeading++
    }

    return Get-LastContentIndex -Draft $Draft -Before $nextHeading
}

function Get-LastContentIndex {
    param(
        [Parameter(Mandatory)][AllowEmptyString()][Collections.Generic.List[string]]$Draft,
        [Parameter(Mandatory)][int]$Before
    )

    $index = $Before

    while ($index -gt 0 -and [string]::IsNullOrWhiteSpace($Draft[$index - 1])) {
        $index--
    }

    return $index
}
