# ZKAS.stream telemetry agent for Community Bridge (1.0.7)
# Reads localhost-only bridge telemetry and publishes sanitized miner rows.
# No wallet addresses or miner IP addresses are sent to ZKAS.stream.

$ErrorActionPreference = 'Stop'
$StatsUrl   = 'http://127.0.0.1:18114/api/stats'
$MetricsUrl = 'http://127.0.0.1:18114/metrics'
$IngestUrl  = 'https://zkas.stream/api/community-mining?gateway=community-107'
$StratumPort = 5556
$PollSeconds = 60
$DiffToHashes = 1073741824.0 # 2^30; calibrated to the 1.0.7 bridge share-difficulty scale

$secret = [Environment]::GetEnvironmentVariable('MINING_INGEST_SECRET','Machine')
if ([string]::IsNullOrWhiteSpace($secret)) {
    $secret = [Environment]::GetEnvironmentVariable('MINING_INGEST_SECRET','User')
}
if ([string]::IsNullOrWhiteSpace($secret)) { throw 'MINING_INGEST_SECRET is not set.' }

$previousDiff = @{}
$previousHashrate = @{}
$previousShares = @{}
$lastShareAt = @{}

function Parse-Labels([string]$text) {
    $labels = @{}
    foreach ($m in [regex]::Matches($text, '(\w+)="((?:\\.|[^"])*)"')) {
        $labels[$m.Groups[1].Value] = $m.Groups[2].Value
    }
    return $labels
}

function Parse-Metrics([string]$text) {
    $rows = @()
    foreach ($line in ($text -split "`n")) {
        $line = $line.Trim()
        if (!$line -or $line.StartsWith('#')) { continue }
        if ($line -match '^(?<name>[A-Za-z_:][A-Za-z0-9_:]*)\{(?<labels>.*)\}\s+(?<value>[-+0-9.eE]+)$') {
            $rows += [pscustomobject]@{
                Name = $Matches.name
                Labels = Parse-Labels $Matches.labels
                Value = [double]$Matches.value
            }
        }
    }
    return $rows
}

function Metric-Value($rows, [string]$name, [string]$endpoint, [hashtable]$extra = @{}) {
    $matches = @($rows | Where-Object {
        if ($_.Name -ne $name) { return $false }
        if ($_.Labels['ip'] -ne $endpoint) { return $false }
        # Counter rows used by the bridge are emitted with miner="". Prefer those
        # so duplicate IceRiver label-series are not double counted.
        if ($_.Labels.ContainsKey('miner') -and $_.Labels['miner'] -ne '') { return $false }
        foreach ($k in $extra.Keys) {
            if ($_.Labels[$k] -ne $extra[$k]) { return $false }
        }
        return $true
    })
    if (!$matches.Count) { return 0.0 }
    return [double](($matches | Measure-Object Value -Maximum).Maximum)
}

function Active-Endpoints {
    try {
        return @(Get-NetTCPConnection -LocalPort $StratumPort -State Established -ErrorAction Stop |
            ForEach-Object { "$($_.RemoteAddress):$($_.RemotePort)" } |
            Sort-Object -Unique)
    } catch { return @() }
}

while ($true) {
    try {
        # Stats call is also a lightweight health check for the 1.0.7 bridge.
        $null = Invoke-RestMethod -Uri $StatsUrl -TimeoutSec 10
        $metricText = (Invoke-WebRequest -UseBasicParsing -Uri $MetricsUrl -TimeoutSec 10).Content
        $rows = Parse-Metrics $metricText
        $nowMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        $nowSec = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
        $miners = @()

        foreach ($endpoint in (Active-Endpoints)) {
            $shareRow = $rows | Where-Object {
                $_.Name -eq 'ks_valid_share_counter' -and
                $_.Labels['ip'] -eq $endpoint -and
                $_.Labels['miner'] -eq '' -and
                $_.Labels['worker']
            } | Select-Object -First 1
            if (!$shareRow) { continue } # TCP probe, not an authenticated miner

            $worker = [string]$shareRow.Labels['worker']
            $wallet = [string]$shareRow.Labels['wallet']
            $suffix = if ($wallet.Length -ge 3) { $wallet.Substring($wallet.Length - 3) } else { '107' }
            $alias = ($worker + '-' + $suffix) -replace '[^A-Za-z0-9._-]','-'
            if ($alias.Length -gt 32) { $alias = $alias.Substring(0,32) }

            $shares = [double]$shareRow.Value
            $diffTotal = Metric-Value $rows 'ks_valid_share_diff_counter' $endpoint
            $startSec = Metric-Value $rows 'ks_worker_start_time' $endpoint
            $uptime = if ($startSec -gt 0) { [math]::Max(0, $nowSec - $startSec) } else { 0 }

            $hashrate = 0.0
            if ($previousDiff.ContainsKey($endpoint)) {
                $delta = [math]::Max(0, $diffTotal - [double]$previousDiff[$endpoint])
                $sample = ($delta * $DiffToHashes) / $PollSeconds
                if ($previousHashrate.ContainsKey($endpoint) -and $previousHashrate[$endpoint] -gt 0) {
                    $hashrate = (0.55 * $sample) + (0.45 * [double]$previousHashrate[$endpoint])
                } else { $hashrate = $sample }
            } elseif ($uptime -gt 0) {
                $hashrate = ($diffTotal * $DiffToHashes) / $uptime
            }
            $previousDiff[$endpoint] = $diffTotal
            $previousHashrate[$endpoint] = $hashrate

            if (!$previousShares.ContainsKey($endpoint) -or $shares -gt [double]$previousShares[$endpoint]) {
                $lastShareAt[$endpoint] = $nowMs
            }
            $previousShares[$endpoint] = $shares

            $invalid = Metric-Value $rows 'ks_invalid_share_counter' $endpoint @{ type='invalid' }
            $stale = Metric-Value $rows 'ks_invalid_share_counter' $endpoint @{ type='stale' }
            $zkasBlocks = Metric-Value $rows 'ks_blocks_accepted_by_node' $endpoint
            $kasBlocks = Metric-Value $rows 'ks_merged_kas_blocks_accepted_total' $endpoint

            $miners += [ordered]@{
                alias = $alias
                status = 'online'
                hashrateHps = [double]$hashrate
                uptimeSeconds = [double]$uptime
                acceptedShares = [double]$shares
                invalidShares = [double]$invalid
                staleShares = [double]$stale
                lastShareAt = if ($lastShareAt.ContainsKey($endpoint)) { [double]$lastShareAt[$endpoint] } else { $null }
                zkasBlocks = [double]$zkasBlocks
                kasBlocks = [double]$kasBlocks
                kasPayoutSet = $false
            }
        }

        $payload = @{ gatewayOnline = $true; miners = $miners } | ConvertTo-Json -Depth 6 -Compress
        Invoke-RestMethod -Method Post -Uri $IngestUrl -Headers @{ Authorization = "Bearer $secret" } -ContentType 'application/json' -Body $payload -TimeoutSec 15 | Out-Null
    } catch {
        # Keep the agent alive; the dashboard will mark telemetry stale if updates stop.
    }
    Start-Sleep -Seconds $PollSeconds
}
