<#
.SYNOPSIS
  Verteilt das Add-in "Textvorlagen" als Organisations-Add-in in Exchange Online.

.DESCRIPTION
  Liest die Add-in-ID aus dem veröffentlichten Manifest, entfernt persönliche Installationen
  (sonst doppelte Anzeige) und eine ältere Organisations-Installation (Update) und installiert
  das Add-in für bestimmte Benutzer oder alle, standardmäßig aktiviert. Mit -WhatIf nur anzeigen.
  Bewährt im Projekt "Mail-Ablage" (PowerShell 7, ExchangeOnlineManagement 3.11).

.EXAMPLE
  .\scripts\verteilen.ps1 -Alle -WhatIf

.EXAMPLE
  .\scripts\verteilen.ps1 -Alle
#>
[CmdletBinding(SupportsShouldProcess, DefaultParameterSetName = "Benutzer")]
param(
    [string] $ManifestUrl = "https://hendriklindemann.github.io/outlook-vorlagen/manifest.xml",

    [Parameter(Mandatory, ParameterSetName = "Benutzer")]
    [string[]] $Benutzer,

    [Parameter(Mandatory, ParameterSetName = "Alle")]
    [switch] $Alle,

    # Postfächer mit persönlicher Installation (New-App -Mailbox). Standard: die Liste aus -Benutzer.
    [string[]] $PersoenlichEntfernen,

    # Benutzer können das Add-in nicht deaktivieren
    [switch] $ImmerAktiv
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command New-App -ErrorAction SilentlyContinue)) {
    Import-Module ExchangeOnlineManagement
    Connect-ExchangeOnline -ShowBanner:$false
}

try {
    [xml] $manifest = (Invoke-WebRequest -Uri $ManifestUrl -UseBasicParsing).Content
}
catch {
    throw "Manifest nicht erreichbar: $ManifestUrl ($($_.Exception.Message))"
}
$AppId = $manifest.OfficeApp.Id
$Name = $manifest.OfficeApp.DisplayName.DefaultValue
Write-Host "Add-in: $Name ($AppId), Version $($manifest.OfficeApp.Version)"

if (-not $PersoenlichEntfernen) { $PersoenlichEntfernen = $Benutzer }
foreach ($mb in $PersoenlichEntfernen) {
    $app = Get-App -Mailbox $mb -Identity $AppId -ErrorAction SilentlyContinue
    if (-not $app) {
        Write-Host "Keine persönliche Installation: $mb"
    }
    elseif ($PSCmdlet.ShouldProcess($mb, "Persönliche Installation von $Name entfernen")) {
        Remove-App -Mailbox $mb -Identity $AppId -Confirm:$false
        Write-Host "Persönliche Installation entfernt: $mb"
    }
}

$org = Get-App -OrganizationApp -Identity $AppId -ErrorAction SilentlyContinue
if ($org -and $PSCmdlet.ShouldProcess("Organisation", "Bisherige Organisations-Installation (Version $($org.AppVersion)) entfernen")) {
    Remove-App -OrganizationApp -Identity $AppId -Confirm:$false
    Write-Host "Bisherige Organisations-Installation entfernt."
}

$params = @{
    OrganizationApp     = $true
    Url                 = $ManifestUrl
    DefaultStateForUser = $(if ($ImmerAktiv) { "AlwaysEnabled" } else { "Enabled" })
}
if ($Alle) {
    $params.ProvidedTo = "Everyone"
    $ziel = "alle Benutzer"
}
else {
    $params.ProvidedTo = "SpecificUsers"
    $params.UserList = $Benutzer
    $ziel = $Benutzer -join ", "
}

if ($PSCmdlet.ShouldProcess($ziel, "$Name als Organisations-Add-in installieren")) {
    New-App @params | Format-Table DisplayName, AppVersion, Enabled, ProvidedTo, DefaultStateForUser -AutoSize
    Write-Host "Installiert für: $ziel. Sichtbarkeit bei allen Benutzern: einige Stunden bis zwei Tage."
}
