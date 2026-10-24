@echo off
chcp 65001 >nul
title 树洞 - 一键启动公网
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0守护公网.ps1"
pause
