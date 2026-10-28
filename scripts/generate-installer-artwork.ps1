$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path -Parent $PSScriptRoot
$assetDirectory = Join-Path $projectRoot 'src-tauri\installer'
[System.IO.Directory]::CreateDirectory($assetDirectory) | Out-Null
$logo = [System.Drawing.Image]::FromFile((Join-Path $projectRoot 'src-tauri\icons\icon.png'))

function Write-InstallerBitmap([string]$Name, [int]$Width, [int]$Height, [scriptblock]$Paint) {
  $bitmap = [System.Drawing.Bitmap]::new($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    & $Paint $graphics
    $bitmap.Save((Join-Path $assetDirectory $Name), [System.Drawing.Imaging.ImageFormat]::Bmp)
  } finally { $graphics.Dispose(); $bitmap.Dispose() }
}

$titleFont = [System.Drawing.Font]::new('Segoe UI', 21, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$headerFont = [System.Drawing.Font]::new('Segoe UI', 16, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$bodyFont = [System.Drawing.Font]::new('Segoe UI', 11, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$darkBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#181818'))
$lightBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#ededed'))
$mutedBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#a0a0a0'))
$line = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#303030'))
try {
  Write-InstallerBitmap 'header.bmp' 150 57 {
    param($g)
    $g.Clear([System.Drawing.Color]::White)
    $g.DrawImage($logo, 2, 9, 40, 40)
    $g.DrawString('CentralHub', $headerFont, $darkBrush, [single]46, [single]18)
  }
  Write-InstallerBitmap 'sidebar.bmp' 164 314 {
    param($g)
    $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#0d0d0d'))
    $g.DrawImage($logo, 37, 45, 90, 90)
    $format = [System.Drawing.StringFormat]::new()
    try {
      $format.Alignment = [System.Drawing.StringAlignment]::Center
      $g.DrawString('CentralHub', $titleFont, $lightBrush, [System.Drawing.RectangleF]::new(4, 147, 156, 34), $format)
      $g.DrawLine($line, 24, 203, 140, 203)
      $g.DrawString("Seus periféricos.`nUm só lugar.", $bodyFont, $mutedBrush, [System.Drawing.RectangleF]::new(10, 223, 144, 45), $format)
      $g.DrawString('WINDOWS', $bodyFont, $mutedBrush, [System.Drawing.RectangleF]::new(10, 285, 144, 20), $format)
    } finally { $format.Dispose() }
  }
} finally {
  $logo.Dispose(); $titleFont.Dispose(); $headerFont.Dispose(); $bodyFont.Dispose()
  $darkBrush.Dispose(); $lightBrush.Dispose(); $mutedBrush.Dispose(); $line.Dispose()
}
Write-Output 'Imagens do instalador geradas a partir da logo do projeto.'
