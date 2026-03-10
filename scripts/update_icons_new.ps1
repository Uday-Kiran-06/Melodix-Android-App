Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\ASUS\.gemini\antigravity\brain\ec98de25-1996-44f8-ad3f-9917839a4c29\media__1772885563474.jpg"
$img = [System.Drawing.Image]::FromFile($srcPath)

$targets = @(
    "C:\melodix\assets\images\icon.png",
    "C:\melodix\assets\images\adaptive-icon.png",
    "C:\melodix\assets\images\splash-icon.png",
    "C:\melodix\assets\images\android-icon-foreground.png",
    "C:\melodix\assets\images\android-icon-monochrome.png"
)

foreach ($target in $targets) {
    if (Test-Path $target) { Remove-Item $target -Force }
    $img.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "Saved: $target"
}

# Favicon usually smaller
$faviconPath = "C:\melodix\assets\images\favicon.png"
if (Test-Path $faviconPath) { Remove-Item $faviconPath -Force }
$favicon = New-Object System.Drawing.Bitmap($img, 64, 64)
$favicon.Save($faviconPath, [System.Drawing.Imaging.ImageFormat]::Png)
$favicon.Dispose()
Write-Host "Saved: $faviconPath"

$img.Dispose()
