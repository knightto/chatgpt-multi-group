# export-for-chatgpt.ps1
# Run from the project root (where package.json and server.js live)

$ErrorActionPreference = "Stop"

# Check we are in the right place
if (-not (Test-Path ".\package.json")) {
    Write-Error "No package.json found in current folder. Run this script from the project root."
}

$exportDir = ".\chatgpt-export"
$zipPath   = ".\chatgpt-multi-group-export.zip"

# Clean old export if it exists
if (Test-Path $exportDir) {
    Remove-Item $exportDir -Recurse -Force
}
New-Item -ItemType Directory -Path $exportDir | Out-Null

# Helper to copy a folder if it exists
function Copy-FolderIfExists {
    param(
        [string]$Name
    )
    if (Test-Path ".\$Name") {
        Write-Host "Copying folder: $Name"
        Copy-Item ".\$Name" -Destination "$exportDir\$Name" -Recurse -Force
    } else {
        Write-Host "Skipping missing folder: $Name"
    }
}

# Helper to copy a file if it exists
function Copy-FileIfExists {
    param(
        [string]$Name
    )
    if (Test-Path ".\$Name") {
        Write-Host "Copying file: $Name"
        Copy-Item ".\$Name" -Destination "$exportDir\$Name" -Force
    } else {
        Write-Host "Skipping missing file: $Name"
    }
}

# Core files
Copy-FileIfExists "package.json"
Copy-FileIfExists "package-lock.json"
Copy-FileIfExists "server.js"
Copy-FileIfExists "README.md"

# Main source structure
Copy-FolderIfExists "routes"
Copy-FolderIfExists "models"
Copy-FolderIfExists "middleware"
Copy-FolderIfExists "config"
Copy-FolderIfExists "utils"
Copy-FolderIfExists "public"

# Optional: capture runtime info (helps debug)
"NodeVersion: $(node -v 2>$null)" | Out-File "$exportDir\env-info.txt"
"NpmVersion:  $(npm -v 2>$null)"  | Add-Content "$exportDir\env-info.txt"

# Do NOT include node_modules, .git, dist, etc. (keeps file small & clean)
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Write-Host "Creating zip: $zipPath"
Compress-Archive -Path "$exportDir\*" -DestinationPath $zipPath -Force

Write-Host "Done. Upload file: $zipPath"
