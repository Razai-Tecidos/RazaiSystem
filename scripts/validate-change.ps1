param(
  [Parameter(Mandatory = $true)]
  [string]$RepoRoot,

  [Parameter(Mandatory = $true)]
  [ValidateSet('frontend', 'backend', 'functions', 'cross')]
  [string]$Scope
)

$ErrorActionPreference = 'Stop'

function Run-Step {
  param(
    [string]$Title,
    [string]$WorkDir,
    [string[]]$Commands
  )

  Write-Host "\n=== $Title ==="
  Push-Location $WorkDir
  try {
    foreach ($cmd in $Commands) {
      Write-Host "> $cmd"
      Invoke-Expression $cmd
      if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code ${LASTEXITCODE}: $cmd"
      }
    }
  }
  finally {
    Pop-Location
  }
}

if (-not (Test-Path $RepoRoot)) {
  throw "Repo path not found: $RepoRoot"
}

switch ($Scope) {
  'frontend' {
    Run-Step -Title 'Frontend Validation' -WorkDir (Join-Path $RepoRoot 'frontend') -Commands @('npm test', 'npm run build')
  }
  'backend' {
    Run-Step -Title 'Backend Validation' -WorkDir (Join-Path $RepoRoot 'backend') -Commands @('npm test', 'npm run build')
  }
  'functions' {
    Run-Step -Title 'Functions Validation' -WorkDir (Join-Path $RepoRoot 'functions') -Commands @('npm test', 'npm run build')
  }
  'cross' {
    Run-Step -Title 'Frontend Validation' -WorkDir (Join-Path $RepoRoot 'frontend') -Commands @('npm test', 'npm run build')
    Run-Step -Title 'Backend Validation' -WorkDir (Join-Path $RepoRoot 'backend') -Commands @('npm test', 'npm run build')
    Run-Step -Title 'Functions Validation' -WorkDir (Join-Path $RepoRoot 'functions') -Commands @('npm test', 'npm run build')
  }
}

Write-Host "\nAll validations passed for scope: $Scope"
