@echo off
chcp 65001 >nul
title 私密空间 - 刷新公网隧道
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0renew-tunnel.ps1"
