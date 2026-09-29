param(
  [string]$BridgePath = 'C:\ZKas-Bridge-Test\zkas-pool\target\release\stratum-bridge.exe',
  [string]$WorkingDirectory = 'C:\ZKas-Bridge-Test\zkas-pool',
  [string]$ConfigPath = '.\bridge-test.yaml',
  [string]$ZkasRpcHost = '127.0.0.1',
  [int]$ZkasRpcPort = 16810,
  [string]$KaspaRpcHost = '127.0.0.1',
  [int]$KaspaRpcPort = 16110,
  [int]$CheckIntervalSeconds = 15,
  [int]$ConnectionGraceSeconds = 45,
  [string]$LogPath = 'C:\ZKas-Bridge-Test\community-bridge-watchdog.log'
)

$ErrorActionPreference = 'Stop'
$bridgeFullPath = [IO.Path]::GetFullPath($BridgePath)
$missingConnectionSince = $null

function Write-BridgeLog([string]$message) {
  $line = '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $message
  Write-Host $line
  try { Add-Content -Path $LogPath -Value $line -Encoding UTF8 } catch { }
}

function Test-TcpPort([string]$hostName, [int]$port) {
  $client = [Net.Sockets.TcpClient]::new()
  try {
    $task = $client.ConnectAsync($hostName, $port)
    if (-not $task.Wait(3000)) { return $false }
    return $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Get-CommunityBridgeProcess {
  return Get-CimInstance Win32_Process -Filter "Name='stratum-bridge.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.ExecutablePath -and [IO.Path]::GetFullPath($_.ExecutablePath) -eq $bridgeFullPath } |
    Select-Object -First 1
}

function Wait-ForBothNodes {
  $lastStatus = ''
  while ($true) {
    $zkasReady = Test-TcpPort $ZkasRpcHost $ZkasRpcPort
    $kaspaReady = Test-TcpPort $KaspaRpcHost $KaspaRpcPort
    $status = "ZKAS RPC=$zkasReady; Kaspa RPC=$kaspaReady"
    if ($status -ne $lastStatus) {
      Write-BridgeLog $status
      $lastStatus = $status
    }
    if ($zkasReady -and $kaspaReady) {
      Start-Sleep -Seconds 5
      if ((Test-TcpPort $ZkasRpcHost $ZkasRpcPort) -and (Test-TcpPort $KaspaRpcHost $KaspaRpcPort)) { return }
    }
    Start-Sleep -Seconds ([math]::Max(5, $CheckIntervalSeconds))
  }
}

function Start-CommunityBridge {
  if (-not (Test-Path -LiteralPath $bridgeFullPath -PathType Leaf)) {
    throw "Bridge executable not found: $bridgeFullPath"
  }
  if (-not (Test-Path -LiteralPath $WorkingDirectory -PathType Container)) {
    throw "Bridge working directory not found: $WorkingDirectory"
  }

  Wait-ForBothNodes
  $process = Start-Process -FilePath $bridgeFullPath `
    -WorkingDirectory $WorkingDirectory `
    -ArgumentList @('--node-mode', 'external', '--config', $ConfigPath) `
    -PassThru
  Write-BridgeLog "Started community bridge PID $($process.Id) after both RPC nodes were ready."
  Start-Sleep -Seconds 10
}

function Test-BridgeNodeConnections([int]$processId) {
  try {
    $connections = @(Get-NetTCPConnection -OwningProcess $processId -State Established -ErrorAction Stop)
    $zkasConnected = $connections | Where-Object { $_.RemoteAddress -eq $ZkasRpcHost -and $_.RemotePort -eq $ZkasRpcPort }
    $kaspaConnected = $connections | Where-Object { $_.RemoteAddress -eq $KaspaRpcHost -and $_.RemotePort -eq $KaspaRpcPort }
    return [bool]$zkasConnected -and [bool]$kaspaConnected
  } catch {
    return $false
  }
}

Write-BridgeLog 'Community bridge watchdog started.'

while ($true) {
  $bridge = Get-CommunityBridgeProcess
  if ($null -eq $bridge) {
    Start-CommunityBridge
    $missingConnectionSince = $null
    continue
  }

  $zkasReady = Test-TcpPort $ZkasRpcHost $ZkasRpcPort
  $kaspaReady = Test-TcpPort $KaspaRpcHost $KaspaRpcPort
  $connected = $zkasReady -and $kaspaReady -and (Test-BridgeNodeConnections ([int]$bridge.ProcessId))

  if ($connected) {
    $missingConnectionSince = $null
  } else {
    if ($null -eq $missingConnectionSince) {
      $missingConnectionSince = Get-Date
      Write-BridgeLog "Bridge PID $($bridge.ProcessId) lost one or both node connections; grace timer started."
    }
    $missingSeconds = ((Get-Date) - $missingConnectionSince).TotalSeconds
    if ($missingSeconds -ge [math]::Max(15, $ConnectionGraceSeconds)) {
      Write-BridgeLog "Stopping bridge PID $($bridge.ProcessId) after $([math]::Round($missingSeconds)) seconds without both node connections."
      Stop-Process -Id ([int]$bridge.ProcessId) -Force -ErrorAction SilentlyContinue
      Start-Sleep -Seconds 3
      Start-CommunityBridge
      $missingConnectionSince = $null
      continue
    }
  }

  Start-Sleep -Seconds ([math]::Max(5, $CheckIntervalSeconds))
}
