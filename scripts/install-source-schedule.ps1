$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
if ($projectRoot -ne 'C:\tech\upost-uy') { throw 'Unexpected project root.' }
if ((Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).name -ne 'upost-uy') { throw 'Wrong project.' }
$taskName = 'UPOST.uy - Fuentes automaticas'
$nodeExe = (Get-Command node.exe).Source
$runner = Join-Path $projectRoot 'scripts\scheduled-sources.mjs'
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing -and ($existing.Actions.Arguments -notlike '*upost-uy*scheduled-sources.mjs*')) { throw 'A different task uses this name.' }
$arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -Command "& ''' + $nodeExe + ''' ''' + $runner + '''"'
$action = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Argument $arguments -WorkingDirectory $projectRoot
$now = Get-Date
$nextBoundary = $now.Date.AddMinutes(([math]::Floor($now.TimeOfDay.TotalMinutes / 30) + 1) * 30).AddSeconds(10)
$trigger = New-ScheduledTaskTrigger -Once -At $nextBoundary -RepetitionInterval (New-TimeSpan -Minutes 30)
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'UPOST local: sync configured sources every 30 minutes using their editorial publication modes. Requires this computer on and the user logged in.' -Force | Out-Null
$task = Get-ScheduledTask -TaskName $taskName
$info = Get-ScheduledTaskInfo -TaskName $taskName
[PSCustomObject]@{TaskName=$task.TaskName;State=$task.State;Interval=$task.Triggers.Repetition.Interval;NextRunTime=$info.NextRunTime;LogonType=$task.Principal.LogonType} | ConvertTo-Json
