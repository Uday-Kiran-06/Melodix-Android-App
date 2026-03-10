Add-Type -AssemblyName System.Drawing

function Clean-Icon {
    param(
        [string]$imgPath,
        [int]$whiteThreshold = 220 # Anything below this brightness becomes black
    )

    if (-not (Test-Path $imgPath)) {
        Write-Host "File not found: $imgPath"
        return
    }

    $tmpPath = $imgPath + ".clean.png"
    $src = [System.Drawing.Image]::FromFile($imgPath)
    $bmp = New-Object System.Drawing.Bitmap($src.Width, $src.Height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    # Start with pure black
    $g.Clear([System.Drawing.Color]::Black)
    $g.DrawImage($src, 0, 0)
    $g.Dispose()
    $src.Dispose()

    for ($y = 0; $y -lt $bmp.Height; $y++) {
        for ($x = 0; $x -lt $bmp.Width; $x++) {
            $pixel = $bmp.GetPixel($x, $y)
            
            # If the pixel isn't bright enough to be the white icon, make it pure black
            if ($pixel.R -lt $whiteThreshold -or $pixel.G -lt $whiteThreshold -or $pixel.B -lt $whiteThreshold) {
                $bmp.SetPixel($x, $y, [System.Drawing.Color]::Black)
            }
        }
    }

    $bmp.Save($tmpPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()

    Remove-Item $imgPath -Force
    Rename-Item $tmpPath $imgPath
    Write-Host "Cleaned: $imgPath"
}

$icons = @(
    "C:\melodix\assets\images\icon.png",
    "C:\melodix\assets\images\adaptive-icon.png",
    "C:\melodix\assets\images\splash-icon.png",
    "C:\melodix\assets\images\android-icon-foreground.png",
    "C:\melodix\assets\images\android-icon-monochrome.png",
    "C:\melodix\assets\images\favicon.png"
)

foreach ($icon in $icons) {
    Clean-Icon -imgPath $icon
}

Write-Host "Icon cleaning complete!"
