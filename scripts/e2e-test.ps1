$ErrorActionPreference = "Continue"
$base = "C:\Users\delig\OneDrive\Documents\Default Project\audit"
$data = "$base\.data"
$hardhat = "$base\node_modules\.bin\hardhat.cmd"
$tsx = "$base\node_modules\.bin\tsx.cmd"

# Deterministic run: reset agent state so assertions reflect only this run.
Remove-Item "$data\state.json", "$data\ledger.jsonl", "$data\priceHistory.json" -ErrorAction SilentlyContinue

$pNode = Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$hardhat`" node" -WorkingDirectory "$base\packages\contracts" -WindowStyle Hidden -RedirectStandardOutput "$data\hardhat-node.log" -RedirectStandardError "$data\hardhat-node.err.log" -PassThru
Write-Output "node pid: $($pNode.Id)"
Start-Sleep -Seconds 25

$ready = $false
try {
  $r = Invoke-WebRequest -Uri "http://127.0.0.1:8545" -Method Post -Body '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' -ContentType "application/json" -TimeoutSec 5
  $ready = $true
} catch {}
Write-Output "node ready: $ready"

$env:AGENT_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
$env:MARKET_MAKER_PRIVATE_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
Push-Location "$base\packages\contracts"
& $hardhat run scripts/deploy.ts --network localhost 2>&1 | Select-Object -Last 3
Pop-Location

$env:RPC_URL = "http://127.0.0.1:8545"
$env:CYCLE_MS = "4000"
$env:VETO_WINDOW_CYCLES = "2"
$env:OUTCOME_HORIZON_CYCLES = "6"
$env:PORT = "8787"

$pAgent = Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$tsx`" src/index.ts" -WorkingDirectory "$base\packages\agent" -WindowStyle Hidden -RedirectStandardOutput "$data\agent.log" -RedirectStandardError "$data\agent.err.log" -PassThru
Write-Output "agent pid: $($pAgent.Id)"
Start-Sleep -Seconds 50

Write-Output "=== AGENT LOG ==="
Get-Content "$data\agent.log" -ErrorAction SilentlyContinue | Select-Object -First 25
Write-Output "=== AGENT ERR (last 10) ==="
Get-Content "$data\agent.err.log" -ErrorAction SilentlyContinue | Select-Object -Last 10

Write-Output "=== STATE SUMMARY ==="
$state = Get-Content "$data\state.json" -ErrorAction SilentlyContinue | ConvertFrom-Json
if ($state) {
  Write-Output "cycle: $($state.cycle)  price: $($state.price)  mode: $($state.mode)"
  Write-Output "trust score: $($state.trust.score)  resolved: $($state.trust.resolved)  pending: $($state.trust.pending)"
  Write-Output "lastDecision: $($state.lastDecision.side) $($state.lastDecision.sizePct)% verdict=$($state.lastDecision.verdict)"
  Write-Output "lastExecution tx: $($state.lastExecution.txHash)"
  Write-Output "recentOutcomes: $($state.recentOutcomes.Count)"
  Write-Output "recentEntries: $($state.recentEntries.Count)"
}

Write-Output "=== DASHBOARD API CHECK ==="
try {
  $r = Invoke-WebRequest -Uri "http://127.0.0.1:8787/state" -TimeoutSec 5
  $s = $r.Content | ConvertFrom-Json
  Write-Output "api ok. cycle=$($s.cycle) price=$($s.price) trust=$($s.trust.score)"
} catch {
  Write-Output "api check failed: $($_.Exception.Message)"
}

Write-Output "=== ON-CHAIN REGISTRY ==="
Push-Location "$base\packages\contracts"
& $hardhat run scripts/inspect.ts --network localhost 2>&1 | Select-Object -Last 4
Pop-Location

Write-Output "=== CLEANUP ==="
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match "audit\\node_modules" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; Write-Output "killed node $($_.ProcessId)" }
Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" | Where-Object { $_.CommandLine -match "hardhat node|tsx src/index" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; Write-Output "killed cmd $($_.ProcessId)" }
Write-Output "DONE"
