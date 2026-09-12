param(
    [switch]$Install
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$TaskName = "ZKAS Mining Rankings Hourly Update"
$RpcEndpoint = "127.0.0.1:16810"
$IndexerPath = "D:\ZKas-Windows\tools\zkas-mining-indexer\zkas-mining-indexer.exe"
$RankingsDir = "D:\ZKas-Windows\data\rankings"
$SnapshotPath = "$RankingsDir\zkas-mining-rankings.json"
$TokenPath = "D:\ZKas-Windows\secure\ranking-upload-token.dat"
$LogPath = "$RankingsDir\hourly-update.log"
$LockPath = "$RankingsDir\hourly-update.lock"
$UploadUrl = "https://zkas.stream/api/mining-rankings"

function Write-UpdateLog {
    param([string]$Message)
    $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Add-Content -Path $LogPath -Value $line -Encoding UTF8
    Write-Host $line
}

if ($Install) {
    if (-not (Test-Path -LiteralPath $TokenPath)) {
        throw "Encrypted upload token not found: $TokenPath"
    }
    if (-not (Test-Path -LiteralPath $IndexerPath)) {
        throw "Mining indexer not found: $IndexerPath"
    }

    $scriptPath = $MyInvocation.MyCommand.Path
    $account = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$scriptPath`""
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddHours(1) -RepetitionInterval (New-TimeSpan -Hours 1)
    $principal = New-ScheduledTaskPrincipal -UserId $account -LogonType Interactive -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 55)

    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
    Start-ScheduledTask -TaskName $TaskName
    Write-Host "Installed and started: $TaskName"
    Write-Host "The task runs hourly while $account is signed in."
    Write-Host "Log: $LogPath"
    exit 0
}

New-Item -ItemType Directory -Path $RankingsDir -Force | Out-Null
if ((Test-Path -LiteralPath $LogPath) -and (Get-Item -LiteralPath $LogPath).Length -gt 5MB) {
    Move-Item -LiteralPath $LogPath -Destination "$LogPath.previous" -Force
}

$lock = $null
$token = $null
$bstr = [IntPtr]::Zero
try {
    try {
        $lock = [System.IO.File]::Open($LockPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
    } catch [System.IO.IOException] {
        Write-UpdateLog "Skipped: another ranking update is already running."
        exit 0
    }

    Write-UpdateLog "Starting verified mining-payout index."
    if (-not (Test-Path -LiteralPath $IndexerPath)) { throw "Mining indexer not found: $IndexerPath" }
    if (-not (Test-Path -LiteralPath $TokenPath)) { throw "Encrypted upload token not found: $TokenPath" }

    & $IndexerPath $RpcEndpoint $SnapshotPath 2>&1 | ForEach-Object {
        Write-UpdateLog ([string]$_)
    }
    if ($LASTEXITCODE -ne 0) { throw "Indexer exited with code $LASTEXITCODE" }

    $snapshot = Get-Content -LiteralPath $SnapshotPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($snapshot.schemaVersion -ne 1 -or $snapshot.status -ne "complete" -or $snapshot.complete -ne $true) {
        throw "Indexer did not produce a complete snapshot."
    }
    if ($snapshot.source.historyComplete -ne $true -or [uint64]$snapshot.source.historyFromDaaScore -ne 0) {
        throw "Snapshot is not backed by verified history from genesis."
    }
    if ([uint64]$snapshot.backfill.processedBlocks -lt 1 -or [uint64]$snapshot.backfill.processedBlocks -ne [uint64]$snapshot.backfill.targetBlocks -or [double]$snapshot.backfill.coveragePercent -ne 100) {
        throw "Snapshot backfill is incomplete."
    }
    if ($snapshot.rows.Count -lt 1) { throw "Snapshot contains no payout addresses." }

    $encryptedToken = (Get-Content -LiteralPath $TokenPath -Raw -Encoding ASCII).Trim()
    $secureToken = ConvertTo-SecureString $encryptedToken
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
    $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)

    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $headers = @{ Authorization = "Bearer $token" }
    $response = Invoke-RestMethod -Uri $UploadUrl -Method Post -Headers $headers -ContentType "application/json" -InFile $SnapshotPath
    if ($response.ok -ne $true) { throw "Upload endpoint did not confirm success." }

    Write-UpdateLog ("Uploaded DAA {0}: {1} blocks, {2} payout addresses." -f $response.checkpointDaaScore, $response.processedBlocks, $response.addresses)
} catch {
    Write-UpdateLog ("FAILED: " + $_.Exception.Message)
    exit 1
} finally {
    if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    $token = $null
    if ($lock) { $lock.Dispose() }
}
