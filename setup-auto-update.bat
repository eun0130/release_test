@echo off
rem One-time setup: checks for updates automatically every day at 09:30.
schtasks /Create /F /SC DAILY /ST 09:30 /TN "ReleaseTestUpdater" ^
  /TR "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%~dp0update.ps1\" -Silent"
if %errorlevel%==0 (
  echo.
  echo Auto-update enabled. This window closes in 5 seconds.
) else (
  echo.
  echo Setup failed. Please run this file again.
)
timeout /t 5 >nul
