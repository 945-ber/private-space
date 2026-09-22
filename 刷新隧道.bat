@echo off
chcp 65001 >nul
title 树洞 - 刷新公网隧道
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0renew-tunnel.ps1"
