Add-Type -AssemblyName System.Drawing

$baseSrc = "C:\Users\ASUS\.gemini\antigravity\brain\ec98de25-1996-44f8-ad3f-9917839a4c29\melodix_headphones_uk_between_1772876844536.png"

function Make-PaddedIcon {
    param(
        [string]$srcPath,
        [string]$dstPath,
        [int]$canvasSize = 1024,
        [float]$iconScale = 0.6
    )

    $src = [System.Drawing.Image]::FromFile($srcPath)
    $canvas = New-Object System.Drawing.Bitmap($canvasSize, $canvasSize)
    $g = [System.Drawing.Graphics]::FromImage($canvas)

    # Pure black background
    $g.Clear([System.Drawing.Color]::Black)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    # Scale and center the icon
    $iconSize = [int]($canvasSize * $iconScale)
    $x = [int](($canvasSize - $iconSize) / 2)
    $y = [int](($canvasSize - $iconSize) / 2)
    $destRect = New-Object System.Drawing.Rectangle($x, $y, $iconSize, $iconSize)
    $g.DrawImage($src, $destRect)

    $g.Dispose()
    $src.Dispose()
    $canvas.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $canvas.Dispose()
    Write-Host "Saved: $dstPath"
}

Make-PaddedIcon -srcPath $baseSrc -dstPath "C:\melodix\assets\images\icon.png" -canvasSize 1024 -iconScale 0.6
Make-PaddedIcon -srcPath $baseSrc -dstPath "C:\melodix\assets\images\adaptive-icon.png" -canvasSize 1024 -iconScale 0.6
Make-PaddedIcon -srcPath $baseSrc -dstPath "C:\melodix\assets\images\splash-icon.png" -canvasSize 1024 -iconScale 0.6
Make-PaddedIcon -srcPath $baseSrc -dstPath "C:\melodix\assets\images\android-icon-foreground.png" -canvasSize 1024 -iconScale 0.6
Make-PaddedIcon -srcPath $baseSrc -dstPath "C:\melodix\assets\images\android-icon-monochrome.png" -canvasSize 1024 -iconScale 0.6
Make-PaddedIcon -srcPath $baseSrc -dstPath "C:\melodix\assets\images\favicon.png" -canvasSize 64 -iconScale 0.6

Write-Host "All icons updated successfully!"
