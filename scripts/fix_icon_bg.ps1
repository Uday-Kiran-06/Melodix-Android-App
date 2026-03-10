Add-Type -AssemblyName System.Drawing

function Fix-IconBackground {
    param(
        [string]$imgPath,
        [int]$threshold = 80
    )

    $tmpPath = $imgPath + ".tmp.png"

    $src = [System.Drawing.Image]::FromFile($imgPath)
    $bmp = New-Object System.Drawing.Bitmap($src.Width, $src.Height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.DrawImage($src, 0, 0)
    $g.Dispose()
    $src.Dispose()

    for ($y = 0; $y -lt $bmp.Height; $y++) {
        for ($x = 0; $x -lt $bmp.Width; $x++) {
            $pixel = $bmp.GetPixel($x, $y)
            $r = $pixel.R
            $g2 = $pixel.G
            $b = $pixel.B

            $minChannel = [Math]::Min($r, [Math]::Min($g2, $b))
            $maxChannel = [Math]::Max($r, [Math]::Max($g2, $b))
            $satRange   = $maxChannel - $minChannel

            # Replace grey/whitish background pixels (not the bright white icon lines)
            if ($minChannel -gt $threshold -and $satRange -lt 40 -and $maxChannel -lt 240) {
                $bmp.SetPixel($x, $y, [System.Drawing.Color]::Black)
            }
        }
    }

    $bmp.Save($tmpPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()

    Remove-Item $imgPath -Force
    Rename-Item $tmpPath $imgPath
    Write-Host "Fixed: $imgPath"
}

$icons = @(
    "C:\melodix\assets\images\icon.png",
    "C:\melodix\assets\images\adaptive-icon.png",
    "C:\melodix\assets\images\splash-icon.png",
    "C:\melodix\assets\images\android-icon-foreground.png",
    "C:\melodix\assets\images\android-icon-monochrome.png"
)

foreach ($icon in $icons) {
    Fix-IconBackground -imgPath $icon
}

Write-Host "All icons fixed!"
