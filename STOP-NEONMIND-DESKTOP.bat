@echo off
powershell.exe -NoProfile -Command "Get-Process NeonMindDesktopCore -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Stop-Process -Force"
powershell.exe -NoProfile -Command "Get-Process NeonMindWebViewRuntime -ErrorAction SilentlyContinue | Stop-Process -Force"
powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -like '*NeonMindDesktopHost.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
