[CmdletBinding()]
param(
    [string]$Message = "Tarea completada",
    [int]$BeepCount = 3
)

Add-Type -AssemblyName System.Windows.Forms

$safeCount = [Math]::Max(1, [Math]::Min($BeepCount, 6))

for ($index = 0; $index -lt $safeCount; $index += 1) {
    [console]::beep(1200, 180)
    Start-Sleep -Milliseconds 120
}

[System.Windows.Forms.MessageBox]::Show($Message, 'Event App', 'OK', 'Information') | Out-Null
