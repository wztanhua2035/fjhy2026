param(
  [string]$GeneratedPlaque = ''
)

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$png = [System.Drawing.Imaging.ImageFormat]::Png

function New-Color([string]$hex) {
  [System.Drawing.ColorTranslator]::FromHtml($hex)
}

function Add-BakedSign(
  [System.Drawing.Graphics]$graphics,
  [System.Drawing.Image]$source,
  [int]$x, [int]$y, [int]$width, [int]$height,
  [string]$title, [string]$panel, [string]$text,
  [System.Drawing.Image]$plaqueTexture
) {
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $outer = [System.Drawing.Rectangle]::new($x, $y, $width, $height)
  $inner = [System.Drawing.Rectangle]::new($x + 7, $y + 7, $width - 14, $height - 14)
  $wood = [System.Drawing.SolidBrush]::new((New-Color '#4d2d1b'))
  $trim = [System.Drawing.Pen]::new((New-Color '#c6924d'), 2)
  $panelBrush = [System.Drawing.SolidBrush]::new((New-Color $panel))
  $graphics.FillRectangle($wood, $outer)
  $graphics.DrawRectangle($trim, $outer)
  if ($null -ne $plaqueTexture) {
    # The centre portion is text-free material generated for this sign; only the
    # panel grain is sampled, so the locked room composition is never altered.
    $sourceRect = [System.Drawing.Rectangle]::new(730, 340, 460, 150)
    $graphics.DrawImage($plaqueTexture, $inner, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
    $tint = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(92, (New-Color $panel)))
    $graphics.FillRectangle($tint, $inner)
    $tint.Dispose()
  } else {
    $graphics.FillRectangle($panelBrush, $inner)
  }
  $graphics.DrawRectangle($trim, $inner)
  $font = [System.Drawing.Font]::new('Microsoft YaHei', 25, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $shadow = [System.Drawing.SolidBrush]::new((New-Color '#2a1b16'))
  $letters = [System.Drawing.SolidBrush]::new((New-Color $text))
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $shadowRect = [System.Drawing.RectangleF]::new($inner.X + 1, $inner.Y + 2, $inner.Width, $inner.Height)
  $textRect = [System.Drawing.RectangleF]::new($inner.X, $inner.Y, $inner.Width, $inner.Height)
  $graphics.DrawString($title, $font, $shadow, $shadowRect, $format)
  $graphics.DrawString($title, $font, $letters, $textRect, $format)
  $format.Dispose(); $letters.Dispose(); $shadow.Dispose(); $font.Dispose()
  $panelBrush.Dispose(); $trim.Dispose(); $wood.Dispose()
}

function Bake-Background([string]$relativeSource, [string]$relativeTarget, [int]$x, [int]$y, [int]$width, [int]$height, [string]$title, [string]$panel, [string]$text, [System.Drawing.Image]$texture) {
  $sourcePath = Join-Path $root $relativeSource
  $targetPath = Join-Path $root $relativeTarget
  $source = [System.Drawing.Image]::FromFile($sourcePath)
  if ($source.Width -ne 768 -or $source.Height -ne 640) { throw "Unexpected room canvas: $relativeSource" }
  $output = [System.Drawing.Bitmap]::new($source.Width, $source.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($output)
  $graphics.DrawImageUnscaled($source, 0, 0)
  Add-BakedSign $graphics $source $x $y $width $height $title $panel $text $texture
  $output.Save($targetPath, $png)
  $graphics.Dispose(); $output.Dispose(); $source.Dispose()
  Write-Host "baked $relativeTarget"
}

$texture = $null
if ($GeneratedPlaque -and (Test-Path -LiteralPath $GeneratedPlaque)) { $texture = [System.Drawing.Image]::FromFile($GeneratedPlaque) }
try {
  # Unicode code points keep title paint deterministic on Windows PowerShell 5 and 7.
  $salonTitle = [string]([char]0x9752) + [char]0x4e1d + [char]0x7f8e + [char]0x53d1 + [char]0x5ba4
  $clothTitle = [string]([char]0x6625) + [char]0x886b + [char]0x8863 + [char]0x574a
  Bake-Background 'assets/remote/world/baishi/interiors/salon/background_v2.png' 'assets/remote/world/baishi/interiors/salon/background_v3.png' 212 55 344 66 $salonTitle '#2f665d' '#fff3d5' $texture
  # This plaque covers only the corrupted title paint on the top wall; racks,
  # counters, doorway, floor plan and all navigation-aligned furniture remain fixed.
  Bake-Background 'assets/remote/world/baishi/interiors/cloth/background_v2.png' 'assets/remote/world/baishi/interiors/cloth/background_v3.png' 546 45 184 66 $clothTitle '#8e6570' '#fff1e4' $null
} finally {
  if ($null -ne $texture) { $texture.Dispose() }
}
