param(
    [Parameter(Mandatory = $true)]
    [string]$Exam
)

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
$imageRoot = Join-Path $projectRoot "public\mas202\exams\$Exam\images"
$outputRoot = Join-Path $projectRoot "data\mas202\ocr-windows"
$outputPath = Join-Path $outputRoot "$Exam.json"

if (-not (Test-Path -LiteralPath $imageRoot -PathType Container)) {
    throw "$Exam`: image directory does not exist"
}

$images = Get-ChildItem -LiteralPath $imageRoot -File |
    Where-Object { $_.BaseName -match "^Q\d+$" } |
    Sort-Object { [int]($_.BaseName.Substring(1)) }

if ($images.Count -ne 50) {
    throw "$Exam`: expected 50 images, found $($images.Count)"
}

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if ($null -eq $engine) {
    throw "Windows OCR engine is unavailable"
}

$records = [System.Collections.Generic.List[object]]::new()

foreach ($image in $images) {
    $number = [int]$image.BaseName.Substring(1)
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

    $records.Add(
        [ordered]@{
            question = $number
            image = "/mas202/exams/$Exam/images/$($image.Name)"
            text = $result.Text
            lines = @($lines)
        }
    )

    $stream.Dispose()
    $bitmap.Dispose()
    Write-Output "$Exam`: $number/50"
}

New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
$records |
    ConvertTo-Json -Depth 8 |
    Set-Content -LiteralPath $outputPath -Encoding utf8

Write-Output $outputPath
