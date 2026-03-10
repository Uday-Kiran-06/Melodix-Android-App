Add-Type -AssemblyName System.Drawing
$imgPath = "C:\Users\ASUS\.gemini\antigravity\brain\ec98de25-1996-44f8-ad3f-9917839a4c29\melodix_headphones_uk_between_1772876844536.png"
$src = [System.Drawing.Image]::FromFile($imgPath)
$bmp = New-Object System.Drawing.Bitmap($src)
$pixel = $bmp.GetPixel(0, 0) # Top-left pixel should be background
$src.Dispose()
$bmp.Dispose()
Write-Host "BG_COLOR=$($pixel.R),$($pixel.G),$($pixel.B)"
