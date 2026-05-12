$mysqlPath = "C:\xampp\mysql"
$dataPath = Join-Path $mysqlPath "data"
$backupPath = Join-Path $mysqlPath "backup"
$oldDataPath = Join-Path $mysqlPath ("data_old_" + (Get-Date -Format "yyyyMMdd_HHmmss"))

if (-not (Test-Path $dataPath)) {
    Write-Error "Data path $dataPath not found!"
    exit
}

if (-not (Test-Path $backupPath)) {
    Write-Error "Backup path $backupPath not found!"
    exit
}

Write-Host "Backing up current data folder to $oldDataPath..."
Rename-Item -Path $dataPath -NewName (Split-Path $oldDataPath -Leaf)

Write-Host "Creating new data folder from backup..."
New-Item -ItemType Directory -Path $dataPath
Copy-Item -Path "$backupPath\*" -Destination $dataPath -Recurse

Write-Host "Restoring user databases..."
$items = Get-ChildItem -Path $oldDataPath -Directory
foreach ($item in $items) {
    if ($item.Name -notin @("mysql", "performance_schema", "phpmyadmin", "test")) {
        Write-Host "Copying database: $($item.Name)"
        Copy-Item -Path $item.FullName -Destination $dataPath -Recurse
    }
}

Write-Host "Restoring ibdata1..."
Copy-Item -Path (Join-Path $oldDataPath "ibdata1") -Destination (Join-Path $dataPath "ibdata1") -Force

Write-Host "Fix complete. Please try starting MySQL from XAMPP Control Panel."
