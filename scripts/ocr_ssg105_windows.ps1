$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Runtime.WindowsRuntime

function Await-WinRt {
    param(
        [Parameter(Mandatory = $true)] $Operation,
        [Parameter(Mandatory = $true)] [Type] $ResultType
    )

    $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() |
        Where-Object {
            $_.Name -eq "AsTask" -and
            $_.IsGenericMethod -and
            $_.GetParameters().Count -eq 1
        } |
        Select-Object -First 1
    $task = $asTask.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
    $task.Wait()
    return $task.Result
}

$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrResult, Windows.Foundation, ContentType = WindowsRuntime]

$projectRoot = Split-Path -Parent $PSScriptRoot
$publicRoot = Join-Path $projectRoot "public\ssg105\source"
$nativeRoot = Join-Path $projectRoot ".tmp-ssg105-native"
$outputRoot = Join-Path $projectRoot "data\ssg105\ocr-raw"
$outputPath = Join-Path $outputRoot "windows.json"
$partialPath = Join-Path $outputRoot "windows.partial.json"

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if ($null -eq $engine) {
    throw "Windows OCR engine is unavailable"
}

New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
$records = [System.Collections.Generic.List[object]]::new()
if (Test-Path -LiteralPath $partialPath) {
    foreach ($record in @(Get-Content -LiteralPath $partialPath -Raw -Encoding utf8 | ConvertFrom-Json)) {
        $records.Add($record)
    }
}
elseif (Test-Path -LiteralPath $outputPath) {
    foreach ($record in @(Get-Content -LiteralPath $outputPath -Raw -Encoding utf8 | ConvertFrom-Json)) {
        $records.Add($record)
    }
}

for ($slide = 378; $slide -le 507; $slide += 1) {
    $name = "slide-{0:D4}.png" -f $slide
    $nativePath = Join-Path $nativeRoot $name
    $publicPath = Join-Path $publicRoot $name
    $imagePath = if (Test-Path -LiteralPath $nativePath) { $nativePath } else { $publicPath }
    if (-not (Test-Path -LiteralPath $imagePath)) {
        throw "Missing source image: $name"
    }

    $index = $slide - 378
    if ($index -lt $records.Count -and [int]$records[$index].sourceSlide -eq $slide) {
        Write-Output "SSG105 $($index + 1)/130 cached"
        continue
    }

    $storageFile = Await-WinRt (
        [Windows.Storage.StorageFile]::GetFileFromPathAsync($imagePath)
    ) ([Windows.Storage.StorageFile])
    $stream = Await-WinRt (
        $storageFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)
    ) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = Await-WinRt (
        [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
    ) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await-WinRt ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $result = Await-WinRt ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])

    $lines = foreach ($line in $result.Lines) {
        $words = @($line.Words | ForEach-Object {
            [ordered]@{
                text = $_.Text
                x = [math]::Round($_.BoundingRect.X, 2)
                y = [math]::Round($_.BoundingRect.Y, 2)
                width = [math]::Round($_.BoundingRect.Width, 2)
                height = [math]::Round($_.BoundingRect.Height, 2)
            }
        })
        $first = $words | Sort-Object y, x | Select-Object -First 1
        [ordered]@{
            text = $line.Text
            x = if ($null -ne $first) { $first.x } else { 0 }
            y = if ($null -ne $first) { $first.y } else { 0 }
            words = $words
        }
    }

    $record = [ordered]@{
        sourceSlide = $slide
        image = "/ssg105/source/$name"
        imageVariant = if ($imagePath -eq $nativePath) { "native-1280" } else { "public-960" }
        engine = "Windows.Media.Ocr.OcrEngine"
        text = $result.Text
        lines = @($lines)
    }
    if ($index -lt $records.Count) { $records[$index] = $record } else { $records.Add($record) }

    $stream.Dispose()
    $bitmap.Dispose()
    Write-Output "SSG105 $($index + 1)/130"
    if ((($index + 1) % 10) -eq 0) {
        $records | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $partialPath -Encoding utf8
    }
}

$records | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $outputPath -Encoding utf8
Remove-Item -LiteralPath $partialPath -Force -ErrorAction SilentlyContinue
Write-Output $outputPath
