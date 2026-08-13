param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-zA-Z0-9_-]+$')]
  [string]$Name
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$outputDirectory = Join-Path $projectRoot 'play-store-assets\raw-screenshots'
Add-Type -AssemblyName System.Drawing
$adbCandidates = @(
  (Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'),
  'C:\Program Files (x86)\Android\android-sdk\platform-tools\adb.exe'
)
$adb = $adbCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $adb) { throw 'ADB was not found. Start the Android emulator and check your Android SDK installation.' }

$devices = & $adb devices | Select-String '\sdevice$'
if ($devices.Count -ne 1) { throw "Connect exactly one Android device or emulator. Found $($devices.Count)." }

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$remotePath = "/sdcard/tindaryo-$Name.png"
$localPath = Join-Path $outputDirectory "$Name.png"

& $adb shell screencap -p $remotePath
if ($LASTEXITCODE -ne 0) { throw 'Android could not capture the current screen.' }
& $adb pull $remotePath $localPath
if ($LASTEXITCODE -ne 0) { throw 'Android could not copy the screenshot to the project.' }
& $adb shell rm $remotePath

$image = [System.Drawing.Image]::FromFile($localPath)
try {
  if ($image.Width -lt 320 -or $image.Height -lt 320) { throw 'The captured image is too small for Google Play.' }
  $shortSide = [Math]::Min($image.Width, $image.Height)
  $longSide = [Math]::Max($image.Width, $image.Height)
  if ($longSide -gt 2 * $shortSide) { throw "Google Play rejects this $($image.Width)x$($image.Height) aspect ratio. Run 'adb shell wm size 1080x1920', reopen Tindaryo, and capture again." }
  $width = $image.Width
  $height = $image.Height
  $convertedPath = Join-Path $outputDirectory "$Name-24bit.png"
  $converted = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  try {
    $graphics = [System.Drawing.Graphics]::FromImage($converted)
    try { $graphics.DrawImage($image, 0, 0, $width, $height) } finally { $graphics.Dispose() }
    $converted.Save($convertedPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $converted.Dispose()
  }
} finally {
  $image.Dispose()
}
Move-Item -LiteralPath $convertedPath -Destination $localPath -Force
Write-Host "Saved $($width)x$($height) 24-bit screenshot: $localPath"
