$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Runtime.WindowsRuntime

function Await-WinRt {
    param(
        [Parameter(Mandatory = $true)]
        $Operation,
        [Parameter(Mandatory = $true)]
        [Type]$ResultType
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
$imageRoot = Join-Path $projectRoot "public\ssg104\source"
$outputRoot = Join-Path $projectRoot "data\ssg104"
$outputPath = Join-Path $outputRoot "ocr-windows-raw.json"
$partialPath = Join-Path $outputRoot "ocr-windows-raw.partial.json"

$images = Get-ChildItem -LiteralPath $imageRoot -File |
    Where-Object { $_.BaseName -match "^slide-(\d{4})$" } |
    Where-Object {
        $slide = [int]$Matches[1]
        $slide -ge 9 -and $slide -le 376
    } |
    Sort-Object { [int]($_.BaseName.Substring(6)) }

$actualSlides = @($images | ForEach-Object { [int]$_.BaseName.Substring(6) })
$expectedSlides = @(9..376)
if ($actualSlides.Count -ne 368 -or (Compare-Object $expectedSlides $actualSlides)) {
    throw "Expected exactly slides 0009-0376, found $($actualSlides.Count) source images"
}

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if ($null -eq $engine) {
    throw "Windows OCR engine is unavailable"
}

New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
$records = [System.Collections.Generic.List[object]]::new()

if (Test-Path -LiteralPath $partialPath) {
    $cached = Get-Content -LiteralPath $partialPath -Raw -Encoding utf8 | ConvertFrom-Json
    foreach ($record in @($cached)) {
        $records.Add($record)
    }
}
elseif (Test-Path -LiteralPath $outputPath) {
    $cached = Get-Content -LiteralPath $outputPath -Raw -Encoding utf8 | ConvertFrom-Json
    foreach ($record in @($cached)) {
        $records.Add($record)
    }
}

for ($index = 0; $index -lt $images.Count; $index += 1) {
    $image = $images[$index]
    $slide = [int]$image.BaseName.Substring(6)
    if ($index -lt $records.Count -and [int]$records[$index].sourceSlide -eq $slide) {
        Write-Output "SSG104 $($index + 1)/368 cached"
        continue
    }

    $storageFile = Await-WinRt (
        [Windows.Storage.StorageFile]::GetFileFromPathAsync($image.FullName)
    ) ([Windows.Storage.StorageFile])
    $stream = Await-WinRt (
        $storageFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)
    ) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = Await-WinRt (
        [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
    ) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await-WinRt (
        $decoder.GetSoftwareBitmapAsync()
    ) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $result = Await-WinRt (
        $engine.RecognizeAsync($bitmap)
    ) ([Windows.Media.Ocr.OcrResult])

    $lines = foreach ($line in $result.Lines) {
        $words = foreach ($word in $line.Words) {
            [ordered]@{
                text = $word.Text
                x = [math]::Round($word.BoundingRect.X, 2)
                y = [math]::Round($word.BoundingRect.Y, 2)
                width = [math]::Round($word.BoundingRect.Width, 2)
                height = [math]::Round($word.BoundingRect.Height, 2)
            }
        }

        [ordered]@{
            text = $line.Text
            words = @($words)
        }
    }

    $record = [ordered]@{
        sourceSlide = $slide
        image = "/ssg104/source/$($image.Name)"
        engine = "Windows.Media.Ocr.OcrEngine"
        text = $result.Text
        lines = @($lines)
    }
    if ($index -lt $records.Count) {
        $records[$index] = $record
    }
    else {
        $records.Add($record)
    }

    $stream.Dispose()
    $bitmap.Dispose()
    Write-Output "SSG104 $($index + 1)/368"

    if ((($index + 1) % 10) -eq 0) {
        $records | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $partialPath -Encoding utf8
    }
}

$records | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $outputPath -Encoding utf8
Remove-Item -LiteralPath $partialPath -Force -ErrorAction SilentlyContinue
Write-Output $outputPath
