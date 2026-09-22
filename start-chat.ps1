# ============================================================
# 树洞 · 一键启动脚本
# 功能：启动 MongoDB → 启动聊天服务器 → 提示公网方式
# 使用：右键「使用 PowerShell 运行」，或 PowerShell 里执行 .\start-chat.ps1
# 公网隧道请另运行「刷新隧道.bat」
# ============================================================

$ErrorActionPreference = 'Continue'
$MONGOD = 'C:\mongodb\bin\mongod.exe'
$DBPATH = 'C:\mongodb\data_new'
$PROJECT = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  树洞一键启动" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# ---------- 1. 启动 MongoDB ----------
$mongoRunning = Get-NetTCPConnection -LocalPort 27017 -State Listen -ErrorAction SilentlyContinue
if ($mongoRunning) {
  Write-Host "[1/2] MongoDB 已在运行 (端口 27017)" -ForegroundColor Green
} else {
  Write-Host "[1/2] 正在启动 MongoDB..." -ForegroundColor Yellow
  Start-Process -FilePath $MONGOD -ArgumentList "--dbpath",$DBPATH,"--port","27017","--bind_ip","127.0.0.1","--logpath","C:\mongodb\log\mongod-new.log","--logappend" -WindowStyle Hidden
  Start-Sleep -Seconds 4
  if (Get-NetTCPConnection -LocalPort 27017 -State Listen -ErrorAction SilentlyContinue) {
    Write-Host "      MongoDB 启动成功" -ForegroundColor Green
  } else {
    Write-Host "      MongoDB 启动失败！请检查 C:\mongodb" -ForegroundColor Red
  }
}

# ---------- 2. 启动聊天服务器 ----------
$serverRunning = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($serverRunning) {
  Write-Host "[2/2] 聊天服务器已在运行 (端口 3000)" -ForegroundColor Green
} else {
  Write-Host "[2/2] 正在启动聊天服务器..." -ForegroundColor Yellow
  Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $PROJECT -WindowStyle Hidden
  Start-Sleep -Seconds 3
  if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
    Write-Host "      聊天服务器启动成功" -ForegroundColor Green
  } else {
    Write-Host "      聊天服务器启动失败！请确认 node 已安装" -ForegroundColor Red
  }
}

# ---------- 3. 显示地址 ----------
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  启动完成！" -ForegroundColor Green
Write-Host ""
Write-Host "  本机访问:  http://localhost:3000" -ForegroundColor White
Write-Host "  公网访问:  运行「刷新隧道.bat」获取新地址" -ForegroundColor Yellow
Write-Host ""
Write-Host "  数据目录:  C:\mongodb\data_new" -ForegroundColor DarkGray
Write-Host "==============================================" -ForegroundColor Cyan
Read-Host "按回车键关闭窗口"
