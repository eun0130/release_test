' Double-click me: updates the extension silently (no window).
' A Windows notification appears when the update is done.
Dim shell, scriptDir
Set shell = CreateObject("WScript.Shell")
scriptDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
shell.Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & scriptDir & "update.ps1"" -Silent", 0, False
