# ============================================================
# 树洞 · 公网全自动守护脚本
# 功能：
#   1. 读取 secrets.env 里的数据库/密钥配置（不入 Git）
#   2. 启动聊天服务器（node server.js，数据在云端 MongoDB Atlas）
#   3. 启动 Cloudflare 免费隧道（cloudflared + HTTP/2，无需注册）
#   4. 每 30 秒巡检：服务器/隧道掉线自动拉起
#   5. 隧道域名变化时自动写入 tunnel-url.txt，页面实时显示最新公网地址
# 使用：双击「启动公网.bat」，本窗口保持开启即可（可最小化）
# ============================================================

$ErrorActionPreference = 'Continue'
$PROJECT = Split-Path -Parent $MyInvocation.MyCommand.Path
$LOG_TUNNEL = Join-Path $PROJECT 'tunnel.log'
$URL_FILE   = Join-Path $PROJECT 'tunnel-url.txt'
$CLOUDFLARED = Join-Path $PROJECT 'cloudflared.exe'
$TICK = 30  # 巡检间隔（秒）

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  树洞 · 公网守护" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# ---------- 0. 读取本地敏感配置（MONGODB_URI / SESSION_SECRET / ARK_API_KEY） ----------
$envFile = Join-Path $PROJECT 'secrets.env'
if (Test-Path $envFile) {
  $envText = [IO.File]::ReadAllText($envFile)
  foreach ($envLine in ($envText -split "`r?`n")) {
    $lineT = $envLine.Trim()
    if ($lineT -match '^[A-Z_]+=') {
      $k = ($lineT -split '=', 2)[0].Trim()
      $v = ($lineT -split '=', 2)[1].Trim()
      Set-Item -Path "env:$k" -Value $v
    }
  }
  if ($env:MONGODB_URI) {
    Write-Host "[0/5] 已加载本地敏感配置 (secrets.env)" -ForegroundColor Green
  } else {
    Write-Host "[0/5] 警告：secrets.env 读取失败，数据库将无法连接" -ForegroundColor Yellow
  }
} else {
  Write-Host "[0/5] 警告：未找到 secrets.env，数据库/密钥将使用默认值" -ForegroundColor Yellow
}

# ---------- 工具函数 ----------
function Ensure-Server {
  $listening = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
  if ($listening) { return $true }
  Write-Host "  [server] 检测到服务器掉线，正在重启..." -ForegroundColor Yellow
  Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $PROJECT -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PROJECT 'server-out.log') -RedirectStandardError (Join-Path $PROJECT 'server-err.log') | Out-Null
  Start-Sleep -Seconds 4
  $listening = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
  if ($listening) { Write-Host "  [server] 重启成功" -ForegroundColor Green; return $true }
  return $false
}

# 清理本项目启动的 cloudflared（电脑上一般没有别的 cloudflared，可放心）
function Clear-StaleTunnel {
  Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}

function Ensure-Tunnel {
  if (Get-Process cloudflared -ErrorAction SilentlyContinue) { return $true }
  Write-Host "  [tunnel] 隧道掉线，正在重建..." -ForegroundColor Yellow
  Clear-StaleTunnel
  Start-Sleep -Seconds 2
  Remove-Item $LOG_TUNNEL, "$LOG_TUNNEL.err" -ErrorAction SilentlyContinue
  # 关键参数 --protocol http2：走 TCP 443，国内网络可达（QUIC 会被墙）
  Start-Process -FilePath $CLOUDFLARED -ArgumentList 'tunnel','--url','http://127.0.0.1:3000','--protocol','http2','--no-autoupdate' -RedirectStandardOutput $LOG_TUNNEL -RedirectStandardError "$LOG_TUNNEL.err" -WindowStyle Hidden | Out-Null
  return $true
}

# 共享读取隧道日志（进程正占用文件 / UTF-16 编码）
function Read-TunnelLog {
  foreach ($p in @("$LOG_TUNNEL.err", $LOG_TUNNEL)) {
    if (-not (Test-Path $p)) { continue }
    try {
      $fs = [IO.File]::Open($p, 'Open', 'Read', 'ReadWrite')
      $sr = New-Object IO.StreamReader($fs, $true)
      $c = $sr.ReadToEnd()
      $sr.Close(); $fs.Close()
      if ($c) { return $c }
    } catch { }
  }
  return ''
}

function Update-Url {
  $content = Read-TunnelLog
  if (-not $content) { return }
  $m = [regex]::Match($content, 'https://[a-zA-Z0-9\-]+\.trycloudflare\.com')
  if (-not $m.Success) { return }
  $url = $m.Value
  $old = ''
  if (Test-Path $URL_FILE) { $old = (Get-Content $URL_FILE -Raw -ErrorAction SilentlyContinue).Trim() }
  if ($url -ne $old) {
    Set-Content -Path $URL_FILE -Value $url -Encoding UTF8
    Write-Host "  [url] 公网地址更新：" -ForegroundColor Green
    Write-Host "        $url" -ForegroundColor White
  }
}

# 隧道是否真的活着：能正常响应 HTTP 才算活
function Test-TunnelAlive {
  if (-not (Test-Path $URL_FILE)) { return $false }
  $url = (Get-Content $URL_FILE -Raw -ErrorAction SilentlyContinue).Trim()
  if (-not $url) { return $false }
  try {
    $code = (curl.exe -s -o NUL -w "%{http_code}" -m 15 $url)
    return $code -eq '200' -or $code -eq '302'
  } catch {
    return $false
  }
}

# ---------- 1. 首次启动：服务器 + 隧道 ----------
Write-Host "[1/5] 启动聊天服务器..." -ForegroundColor Yellow
$ok = Ensure-Server
if ($ok) {
  Write-Host "      聊天服务器运行中 (http://localhost:3000)" -ForegroundColor Green
} else {
  Write-Host "      服务器启动失败！请确认 node 已安装 (node -v)" -ForegroundColor Red
}

Write-Host "[2/5] 启动 Cloudflare 隧道..." -ForegroundColor Yellow
if (-not (Test-Path $CLOUDFLARED)) {
  Write-Host "      未找到 cloudflared.exe，请重新下载后重试" -ForegroundColor Red
} else {
  Ensure-Tunnel | Out-Null
  Write-Host "      隧道已拉起，等待分配地址 (约 15 秒)..." -ForegroundColor Yellow
}

# 首次等待隧道分配地址
for ($i = 0; $i -lt 15; $i++) {
  Start-Sleep -Seconds 2
  Update-Url
  if (Test-Path $URL_FILE) { break }
}

# ---------- 2. 显示当前公网地址 ----------
Write-Host "==============================================" -ForegroundColor Cyan
if (Test-Path $URL_FILE) {
  $cur = Get-Content $URL_FILE -Raw -ErrorAction SilentlyContinue
  Write-Host "  当前公网地址：" -ForegroundColor Green
  Write-Host "  $($cur.Trim())" -ForegroundColor White
  Write-Host "  (把这个网址发给朋友，任何设备浏览器都能打开)" -ForegroundColor DarkGray
}
Write-Host "  本机访问:  http://localhost:3000" -ForegroundColor DarkGray
Write-Host "  保持本窗口开启 = 服务在线；最小化即可，勿关闭" -ForegroundColor Yellow
Write-Host "==============================================" -ForegroundColor Cyan

# ---------- 3. 守护循环 ----------
Write-Host ""
Write-Host "守护中（每 $TICK 秒巡检一次，Ctrl+C 或关闭窗口即停止服务）..." -ForegroundColor DarkGray

$failCount = 0
while ($true) {
  Start-Sleep -Seconds $TICK
  Ensure-Server | Out-Null
  if (Test-Path $CLOUDFLARED) { Ensure-Tunnel | Out-Null }
  Update-Url

  # 探活公网地址：连续 3 次失败（约 90 秒）才重启隧道，避免误杀刚建好的隧道
  if (Test-TunnelAlive) {
    $failCount = 0
  } else {
    $failCount++
    Write-Host "  [probe] 公网地址第 ${failCount} 次无响应，将在连续 3 次后重建隧道..." -ForegroundColor Yellow
    if ($failCount -ge 3) {
      Write-Host "  [probe] 确认隧道失效，正在重建..." -ForegroundColor Yellow
      Clear-StaleTunnel
      Start-Sleep -Seconds 3
      Remove-Item $LOG_TUNNEL, "$LOG_TUNNEL.err" -ErrorAction SilentlyContinue
      Start-Process -FilePath $CLOUDFLARED -ArgumentList 'tunnel','--url','http://127.0.0.1:3000','--protocol','http2','--no-autoupdate' -RedirectStandardOutput $LOG_TUNNEL -RedirectStandardError "$LOG_TUNNEL.err" -WindowStyle Hidden | Out-Null
      $failCount = 0
      Start-Sleep -Seconds 15
      Update-Url
    }
  }
}
