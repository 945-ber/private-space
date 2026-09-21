# ============================================================
# 私密空间 · 一键刷新公网隧道
# 用途：免费隧道每 5~6 小时失效，运行本脚本可拿一个新公网地址
# 用法：双击「刷新隧道.bat」，或右键本文件「使用 PowerShell 运行」
# ============================================================

$ErrorActionPreference = 'Continue'
$PROJECT = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  私密空间 · 刷新公网隧道" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# ---------- 1. 检查聊天服务器是否在运行 ----------
$server = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if (-not $server) {
  Write-Host "[1/3] 聊天服务器未运行 (端口 3000)！" -ForegroundColor Red
  Write-Host "      请先启动服务器：在项目目录执行  npm start" -ForegroundColor Yellow
  Read-Host "按回车键关闭窗口"
  exit 1
}
Write-Host "[1/3] 聊天服务器运行正常 (端口 3000)" -ForegroundColor Green

# ---------- 2. 关闭旧隧道（避免端口/地址冲突） ----------
Write-Host "[2/3] 正在关闭旧隧道..." -ForegroundColor Yellow
taskkill /F /IM ssh.exe 2>$null | Out-Null
Start-Sleep -Seconds 2
Write-Host "      旧隧道已关闭" -ForegroundColor Green

# ---------- 3. 建立新隧道并抓取公网地址 ----------
Write-Host "[3/3] 正在建立新隧道 (约 5~10 秒)..." -ForegroundColor Yellow
$log = Join-Path $PROJECT 'tunnel-renew.log'
Remove-Item $log, "$log.err" -ErrorAction SilentlyContinue
Start-Process ssh -ArgumentList '-o','StrictHostKeyChecking=no','-o','ServerAliveInterval=45','-o','ServerAliveCountMax=3','-R','80:localhost:3000','nokey@localhost.run' -RedirectStandardOutput $log -RedirectStandardError "$log.err" -WindowStyle Hidden

$pubUrl = $null
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 2
  $content = ""
  if (Test-Path $log) { $content += Get-Content $log -Raw -ErrorAction SilentlyContinue }
  if (Test-Path "$log.err") { $content += Get-Content "$log.err" -Raw -ErrorAction SilentlyContinue }
  $m = [regex]::Match($content, 'https://[a-zA-Z0-9.\-]+\.lhr\.life')
  if ($m.Success) { $pubUrl = $m.Value; break }
}

Write-Host "==============================================" -ForegroundColor Cyan
if ($pubUrl) {
  Write-Host "  新的公网地址：" -ForegroundColor Green
  Write-Host "  $pubUrl" -ForegroundColor White
  Write-Host "  (复制发给朋友，任何人可访问)" -ForegroundColor DarkGray
  Write-Host "  本机访问：  http://localhost:3000" -ForegroundColor DarkGray
} else {
  Write-Host "  未获取到公网地址，请检查网络后重试" -ForegroundColor Red
  Write-Host "  日志位置：  $log" -ForegroundColor DarkGray
}
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "按回车键关闭窗口"
