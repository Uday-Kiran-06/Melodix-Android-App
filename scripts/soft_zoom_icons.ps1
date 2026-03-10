Add-Type -AssemblyName System.Drawing

# High-quality "soft" resizing to avoid harsh edges/sharpness
function Make-PaddedIconSoft {
    param(
        [string]$srcPath,
        [string]$dstPath,
        [int]$canvasSize = 1024,
        [float]$iconScale = 0.70 # Optimized for Android 15 Safe Zone (66%)
    )

    if (-not (Test-Path $srcPath)) {
        Write-Host "Source not found: $srcPath"
        return
    }

    $src = [System.Drawing.Image]::FromFile($srcPath)
    $bmp = New-Object System.Drawing.Bitmap($canvasSize, $canvasSize)
    $g = [System.Drawing.Graphics]::FromImage($bmp)

    # Pure absolute black background
    $g.Clear([System.Drawing.Color]::Black)
    
    # High quality settings for "soft" look
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Scale and center
    $iconSize = [int]($canvasSize * $iconScale)
    $x = [int](($canvasSize - $iconSize) / 2)
    $y = [int](($canvasSize - $iconSize) / 2)
    $destRect = New-Object System.Drawing.Rectangle($x, $y, $iconSize, $iconSize)
    
    $g.DrawImage($src, $destRect)

    $g.Dispose()
    $src.Dispose()
    
    $tmpPath = $dstPath + ".zoom.png"
    $bmp.Save($tmpPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()

    if (Test-Path $dstPath) { Remove-Item $dstPath -Force }
    Rename-Item $tmpPath $dstPath
    Write-Host "Updated with soft zoom (0.70): $dstPath"
}

$logoSrc = "C:\Users\ASUS\.gemini\antigravity\brain\ec98de25-1996-44f8-ad3f-9917839a4c29\media__1772885563474.jpg"
$targets = @(
    @{ dst = "C:\melodix\assets\images\icon.png"; size = 1024 },
    @{ dst = "C:\melodix\assets\images\adaptive-icon.png"; size = 1024 },
    @{ dst = "C:\melodix\assets\images\splash-icon.png"; size = 1024 },
    @{ dst = "C:\melodix\assets\images\android-icon-foreground.png"; size = 1024 },
    @{ dst = "C:\melodix\assets\images\android-icon-monochrome.png"; size = 1024 },
    @{ dst = "C:\melodix\assets\images\favicon.png"; size = 64 }
)

foreach ($target in $targets) {
    Make-PaddedIconSoft -srcPath $logoSrc -dstPath $target.dst -canvasSize $target.size -iconScale 0.70
}

Write-Host "Resizing for Android 15 complete!"
