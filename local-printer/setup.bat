@echo off
setlocal
title BizzFlow Printer Setup

set "SRC=%~dp0bizzflow-printer.exe"
set "DEST_DIR=%LOCALAPPDATA%\Programs\BizzFlowPrinter"
set "DEST=%DEST_DIR%\bizzflow-printer.exe"
set "MENU_LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\BizzFlow Printer.lnk"
set "OLD_STARTUP_LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\BizzFlow-Printer.lnk"

if not exist "%SRC%" (
    echo bizzflow-printer.exe was not found next to this file.
    pause
    exit /b 1
)

echo Installing BizzFlow Printer...

rem Stop any running copy so the file can be replaced.
taskkill /IM bizzflow-printer.exe /F >nul 2>&1
ping -n 3 127.0.0.1 >nul

if not exist "%DEST_DIR%" mkdir "%DEST_DIR%"
copy /Y "%SRC%" "%DEST%" >nul || (echo Could not copy the program. & pause & exit /b 1)

rem Carry over printer settings from the old version (only on first install).
if exist "%~dp0config.json" if not exist "%APPDATA%\BizzFlowPrinter\config.json" (
    if not exist "%APPDATA%\BizzFlowPrinter" mkdir "%APPDATA%\BizzFlowPrinter"
    copy /Y "%~dp0config.json" "%APPDATA%\BizzFlowPrinter\config.json" >nul
)

rem The old version used a Startup-folder shortcut; the app now registers itself instead.
if exist "%OLD_STARTUP_LNK%" del "%OLD_STARTUP_LNK%"

rem Start menu shortcut
powershell -NoProfile -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('%MENU_LNK%');$s.TargetPath='%DEST%';$s.WorkingDirectory='%DEST_DIR%';$s.Description='BizzFlow silent print service';$s.Save()"

rem Register "Start with Windows" (runs silently in the tray at sign-in)
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v BizzFlowPrinter /t REG_SZ /d "\"%DEST%\" --startup" /f >nul

start "" "%DEST%"

echo.
echo Done. BizzFlow Printer is running in the system tray and will start
echo automatically when you sign in to Windows.
echo You can change this any time from the dashboard or the tray menu.
timeout /t 6 >nul 2>&1
