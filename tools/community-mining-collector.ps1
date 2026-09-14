param(
  [string]$MetricsUrl = 'http://127.0.0.1:18115/metrics',
  [string]$Endpoint = 'https://zkas.stream/api/community-mining',
  [string]$Secret = $env:MINING_INGEST_SECRET,
  [int]$IntervalSeconds = 15,
  [switch]$Once,
  [switch]$NoPost
)

$ErrorActionPreference = 'Stop'
$Two32 = [math]::Pow(2, 32)
$previous = @{}
$lastShareAt = @{}

function Parse-Labels([string]$raw) {
  $labels = @{}
  foreach ($m in [regex]::Matches($raw, '(\w+)="([^"]*)"')) {
    $labels[$m.Groups[1].Value] = $m.Groups[2].Value
  }
  return $labels
}

function Get-Series([string]$text, [string]$metric) {
  $escaped = [regex]::Escape($metric)
  $rx = [regex]::new("(?m)^$escaped\{([^}]*)\}\s+([0-9.eE+\-]+)\s*$")
  $rows = @()
  foreach ($m in $rx.Matches($text)) {
    $value = 0.0
    if (-not [double]::TryParse($m.Groups[2].Value, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$value)) { continue }
    $rows += [pscustomobject]@{ Labels = Parse-Labels $m.Groups[1].Value; Value = $value }
  }
  return $rows
}

function Get-WorkersFromSeries($seriesSets) {
  $set = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  foreach ($series in $seriesSets) {
    foreach ($row in $series) {
      $worker = [string]$row.Labels['worker']
      if ($worker) { [void]$set.Add($worker) }
    }
  }
  return @($set)
}

function Sum-SessionMax($series, [string]$worker, [string[]]$extraKeys = @()) {
  $sessions = @{}
  foreach ($row in $series) {
    if ([string]$row.Labels['worker'] -ne $worker) { continue }
    $keyParts = @([string]$row.Labels['ip'])
    foreach ($key in $extraKeys) { $keyParts += [string]$row.Labels[$key] }
    $key = $keyParts -join '|'
    if (-not $sessions.ContainsKey($key) -or $row.Value -gt $sessions[$key]) { $sessions[$key] = $row.Value }
  }
  $sum = 0.0
  foreach ($value in $sessions.Values) { $sum += [double]$value }
  return $sum
}

function Max-WorkerValue($series, [string]$worker) {
  $max = 0.0
  foreach ($row in $series) {
    if ([string]$row.Labels['worker'] -eq $worker -and $row.Value -gt $max) { $max = $row.Value }
  }
  return $max
}

function Min-WorkerStart($series, [string]$worker, [double]$currentDifficulty) {
  if ($currentDifficulty -le 0) { return $null }
  $min = $null
  foreach ($row in $series) {
    if ([string]$row.Labels['worker'] -ne $worker -or $row.Value -le 0) { continue }
    if ($null -eq $min -or $row.Value -lt $min) { $min = $row.Value }
  }
  return $min
}

function Build-Snapshot([string]$text) {
  $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $nowSec = $now / 1000.0

  $valid = Get-Series $text 'ks_valid_share_counter'
  $diff = Get-Series $text 'ks_valid_share_diff_counter'
  $invalid = Get-Series $text 'ks_invalid_share_counter'
  $currentDiff = Get-Series $text 'ks_worker_current_difficulty'
  $start = Get-Series $text 'ks_worker_start_time'
  $zkasBlocks = Get-Series $text 'ks_blocks_accepted_by_node'
  $kasSubmit = Get-Series $text 'ks_merged_parent_submit_total'
  $kasAcceptedLegacy = Get-Series $text 'ks_merged_kas_blocks_accepted_total'
  $kasPayoutSet = Get-Series $text 'ks_worker_kas_payout_set'

  $workers = Get-WorkersFromSeries @($valid, $diff, $currentDiff, $start, $zkasBlocks, $kasSubmit, $kasAcceptedLegacy, $kasPayoutSet)
  $miners = @()

  foreach ($worker in ($workers | Sort-Object)) {
    $acceptedShares = Sum-SessionMax $valid $worker
    $diffTotal = Sum-SessionMax $diff $worker
    $difficultyNow = Max-WorkerValue $currentDiff $worker

    $invalidShares = 0.0
    $staleShares = 0.0
    foreach ($type in @('duplicate', 'invalid', 'weak')) {
      $typed = @($invalid | Where-Object { [string]$_.Labels['type'] -eq $type })
      $invalidShares += Sum-SessionMax $typed $worker @('type')
    }
    $staleSeries = @($invalid | Where-Object { [string]$_.Labels['type'] -eq 'stale' })
    $staleShares = Sum-SessionMax $staleSeries $worker @('type')

    $zkas = Sum-SessionMax $zkasBlocks $worker

    $kas = 0.0
    if ($kasSubmit.Count -gt 0) {
      $accepted = @($kasSubmit | Where-Object { [string]$_.Labels['outcome'] -eq 'accepted' })
      $kas = Sum-SessionMax $accepted $worker @('zkas_claim', 'kas_payout')
    } else {
      $kas = Sum-SessionMax $kasAcceptedLegacy $worker
    }

    $payoutSet = (Max-WorkerValue $kasPayoutSet $worker) -ge 1

    $hashrate = $null
    if ($previous.ContainsKey($worker)) {
      $prior = $previous[$worker]
      $dt = $nowSec - [double]$prior.Time
      $deltaDiff = $diffTotal - [double]$prior.Diff
      if ($dt -gt 0 -and $deltaDiff -ge 0) { $hashrate = ($deltaDiff * $Two32) / $dt }
      if ($acceptedShares -gt [double]$prior.Shares) { $lastShareAt[$worker] = $now }
    } elseif ($acceptedShares -gt 0) {
      $lastShareAt[$worker] = $now
    }

    $previous[$worker] = @{ Time = $nowSec; Diff = $diffTotal; Shares = $acceptedShares }

    $startSec = Min-WorkerStart $start $worker $difficultyNow
    $uptime = if ($null -ne $startSec) { [math]::Max(0, $nowSec - [double]$startSec) } else { $null }
    $recentShare = $lastShareAt.ContainsKey($worker) -and (($now - [int64]$lastShareAt[$worker]) -lt 120000)
    $online = ($difficultyNow -gt 0) -or $recentShare

    $miners += [ordered]@{
      alias = $worker
      status = $(if ($online) { 'online' } else { 'offline' })
      hashrateHps = $(if ($null -eq $hashrate) { $null } else { [math]::Round($hashrate, 0) })
      uptimeSeconds = $(if ($null -eq $uptime) { $null } else { [math]::Round($uptime, 0) })
      acceptedShares = [math]::Round($acceptedShares, 0)
      invalidShares = [math]::Round($invalidShares, 0)
      staleShares = [math]::Round($staleShares, 0)
      lastShareAt = $(if ($lastShareAt.ContainsKey($worker)) { [int64]$lastShareAt[$worker] } else { $null })
      zkasBlocks = [math]::Round($zkas, 0)
      kasBlocks = [math]::Round($kas, 0)
      kasPayoutSet = [bool]$payoutSet
    }
  }

  return [ordered]@{
    gatewayOnline = $true
    miners = $miners
  }
}

function Push-Snapshot($snapshot) {
  $json = $snapshot | ConvertTo-Json -Depth 8 -Compress
  if ($NoPost) {
    Write-Host $json
    return
  }
  if ([string]::IsNullOrWhiteSpace($Secret)) {
    throw 'MINING_INGEST_SECRET is not set. Use -Secret or set $env:MINING_INGEST_SECRET.'
  }
  $headers = @{ Authorization = "Bearer $Secret" }
  $response = Invoke-RestMethod -Uri $Endpoint -Method Post -Headers $headers -ContentType 'application/json' -Body $json -TimeoutSec 15
  Write-Host ("[{0}] published {1} miner(s)" -f (Get-Date -Format 'HH:mm:ss'), $response.miners)
}

Write-Host "Community mining collector"
Write-Host "Metrics:  $MetricsUrl"
Write-Host "Endpoint: $Endpoint"
Write-Host 'Privacy: wallet and IP labels are parsed locally and never included in the posted JSON.'

while ($true) {
  try {
    $metrics = (Invoke-WebRequest -Uri $MetricsUrl -UseBasicParsing -TimeoutSec 10).Content
    $snapshot = Build-Snapshot $metrics
    Push-Snapshot $snapshot
  } catch {
    Write-Warning $_.Exception.Message
  }

  if ($Once) { break }
  Start-Sleep -Seconds ([math]::Max(5, $IntervalSeconds))
}
