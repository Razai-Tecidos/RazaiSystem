param(
  [Parameter(Mandatory = $true)]
  [string]$RepoRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Section {
  param([string]$Title)
  Write-Host ''
  Write-Host "=== $Title ==="
}

function Parse-PorcelainLine {
  param([string]$Line)

  if ([string]::IsNullOrWhiteSpace($Line)) {
    return $null
  }

  $status = $Line.Substring(0, 2)
  $pathRaw = if ($Line.Length -ge 4) { $Line.Substring(3) } else { '' }

  # Rename format can be "old -> new". Keep the new path as impacted file.
  $path = $pathRaw
  if ($pathRaw -like '* -> *') {
    $path = ($pathRaw -split ' -> ')[-1]
  }

  $indexStatus = $status.Substring(0, 1)
  $workTreeStatus = $status.Substring(1, 1)

  [PSCustomObject]@{
    Raw            = $Line
    Status         = $status
    IndexStatus    = $indexStatus
    WorkTreeStatus = $workTreeStatus
    Path           = ($path -replace '\\', '/')
    IsUntracked    = ($status -eq '??')
    IsStaged       = ($indexStatus -ne ' ' -and $indexStatus -ne '?')
    IsUnstaged     = ($workTreeStatus -ne ' ')
  }
}

function Get-ChangedAreaKey {
  param([string]$Path)

  if ($Path -match '^frontend/') { return 'frontend' }
  if ($Path -match '^backend/') { return 'backend' }
  if ($Path -match '^functions/') { return 'functions' }
  if ($Path -match '^docs/' -or $Path -match '^frontend/src/docs/') { return 'docs' }
  if ($Path -match '^scripts/') { return 'scripts' }
  if ($Path -in @('firestore.rules', 'firestore.indexes.json', 'storage.rules', 'firebase.json')) { return 'firebase' }
  return 'other'
}

function Get-CountSafe {
  param($Value)
  return @($Value).Count
}

$resolvedRepoRoot = Resolve-Path -Path $RepoRoot

if (-not (Test-Path (Join-Path $resolvedRepoRoot '.git'))) {
  throw "RepoRoot '$resolvedRepoRoot' does not look like a git repository (missing .git)."
}

Write-Host 'Razai Change Pilot - Preflight'
Write-Host "RepoRoot: $resolvedRepoRoot"
Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

$branch = (git -C $resolvedRepoRoot rev-parse --abbrev-ref HEAD).Trim()
$upstream = $null
try {
  $upstream = (git -C $resolvedRepoRoot rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null).Trim()
} catch {
  $upstream = $null
}

Write-Section 'Current Git Status'
git -C $resolvedRepoRoot status -sb

if ($upstream) {
  $counts = (git -C $resolvedRepoRoot rev-list --left-right --count "$upstream...HEAD").Trim() -split '\s+'
  if ($counts.Length -eq 2) {
    $behind = [int]$counts[0]
    $ahead = [int]$counts[1]
    Write-Host "Branch: $branch (ahead $ahead, behind $behind vs $upstream)"
  } else {
    Write-Host "Branch: $branch (upstream: $upstream)"
  }
} else {
  Write-Host "Branch: $branch (no upstream configured)"
}

$porcelainLines = @(git -C $resolvedRepoRoot status --porcelain=1 --untracked-files=all)
$changes = @()
foreach ($line in $porcelainLines) {
  $parsed = Parse-PorcelainLine -Line $line
  if ($null -ne $parsed) {
    $changes += $parsed
  }
}

Write-Section 'Existing Local Changes'
if ((Get-CountSafe $changes) -eq 0) {
  Write-Host 'Working tree is clean.'
} else {
  $stagedCount = Get-CountSafe ($changes | Where-Object { $_.IsStaged })
  $unstagedCount = Get-CountSafe ($changes | Where-Object { $_.IsUnstaged })
  $untrackedCount = Get-CountSafe ($changes | Where-Object { $_.IsUntracked })
  Write-Host "Total changed entries: $(Get-CountSafe $changes)"
  Write-Host "Staged: $stagedCount | Unstaged: $unstagedCount | Untracked: $untrackedCount"
  Write-Host ''
  $changes | ForEach-Object { Write-Host ("{0} {1}" -f $_.Status, $_.Path) }
}

Write-Section 'High-Level Changed-Area Hints'
$areaCounts = [ordered]@{
  frontend  = 0
  backend   = 0
  functions = 0
  docs      = 0
  firebase  = 0
  scripts   = 0
  other     = 0
}

$changedPaths = @($changes | ForEach-Object { $_.Path })
foreach ($path in $changedPaths) {
  $key = Get-ChangedAreaKey -Path $path
  $areaCounts[$key] = [int]$areaCounts[$key] + 1
}

foreach ($entry in $areaCounts.GetEnumerator()) {
  if ($entry.Value -gt 0) {
    Write-Host ("{0}: {1}" -f $entry.Key, $entry.Value)
  }
}

$hints = New-Object System.Collections.Generic.List[string]

if ($changedPaths | Where-Object { $_ -match '^frontend/src/(navigation/|components/Layout/|pages/Home\.tsx|App\.tsx)' }) {
  $hints.Add('Navigation/UX surface touched (frontend navigation/layout/home/app).')
}
if ($changedPaths | Where-Object { $_ -match '(?i)shopee' }) {
  $hints.Add('Shopee integration surface touched (verify hooks/routes/services/types across layers).')
}
if ($changedPaths | Where-Object { $_ -match '(?i)(tecidos|cores|vinculos|tamanhos)' }) {
  $hints.Add('Core catalog domain touched (tecidos/cores/vinculos/tamanhos).')
}
if ($changedPaths | Where-Object { $_ -in @('firestore.rules', 'firestore.indexes.json', 'storage.rules') }) {
  $hints.Add('Firebase rules/indexes touched (run firebase rules/index deployment checks).')
}
if ($changedPaths | Where-Object { $_ -match '^docs/' -or $_ -match '^frontend/src/docs/' }) {
  $hints.Add('Documentation touched (confirm behavior/docs parity).')
}

$typeLayers = New-Object System.Collections.Generic.HashSet[string]
foreach ($path in $changedPaths) {
  if ($path -match '^frontend/src/types/') { [void]$typeLayers.Add('frontend') }
  if ($path -match '^backend/src/types/') { [void]$typeLayers.Add('backend') }
  if ($path -match '^functions/src/types/') { [void]$typeLayers.Add('functions') }
}
if ($typeLayers.Count -ge 2) {
  $hints.Add("Shared contract mirrors touched in multiple layers: $($typeLayers -join ', ').")
}

if ($hints.Count -eq 0) {
  Write-Host 'No high-risk pattern hints detected from current file paths.'
} else {
  foreach ($hint in $hints) {
    Write-Host "- $hint"
  }
}

$touchedRuntimeLayers = 0
if ($areaCounts.frontend -gt 0) { $touchedRuntimeLayers++ }
if ($areaCounts.backend -gt 0) { $touchedRuntimeLayers++ }
if ($areaCounts.functions -gt 0) { $touchedRuntimeLayers++ }

$recommendedScope = 'cross'
if ($touchedRuntimeLayers -eq 1) {
  if ($areaCounts.frontend -gt 0) { $recommendedScope = 'frontend' }
  if ($areaCounts.backend -gt 0) { $recommendedScope = 'backend' }
  if ($areaCounts.functions -gt 0) { $recommendedScope = 'functions' }
}

Write-Host ''
Write-Host "Recommended scope for validate-change: $recommendedScope"
