@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0NeonMindDesktopHost.ps1" -DesktopMode
