$port = 8000
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
try {
    $listener.Start()
    Write-Output "Local web server started at http://localhost:$port/"
} catch {
    Write-Error "Failed to start listener on port $port. Check if port is already in use."
    exit 1
}

$baseDir = "c:/Users/tinit/Documents/webtoon-project"

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $rawUrl = $request.Url.LocalPath
        $cleanUrl = $rawUrl.TrimEnd('/')
        Write-Output "DEBUG: Incoming request: rawUrl='$rawUrl', cleanUrl='$cleanUrl'"
        if ($rawUrl -eq "/") { $rawUrl = "/home.html" }
        
        if ($cleanUrl -eq "/api/episodes") {
            $files = Get-ChildItem -Path $baseDir -Filter "*.json"
            $jsonItems = @()
            if ($null -ne $files) {
                foreach ($file in $files) {
                    if ($file.Name -match "^.+_\d+.+\.json$") {
                        $escapedName = $file.Name -replace '"', '\"'
                        $jsonItems += ('"{0}"' -f $escapedName)
                    }
                }
            }
            $jsonResponse = "[" + ($jsonItems -join ",") + "]"
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonResponse)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.OutputStream.Close()
        } else {
            $filePath = Join-Path $baseDir $rawUrl.TrimStart('/')
            
            if (Test-Path $filePath -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $contentType = "application/octet-stream"
                if ($ext -eq ".html" -or $ext -eq ".htm") { $contentType = "text/html; charset=utf-8" }
                elseif ($ext -eq ".js") { $contentType = "application/javascript; charset=utf-8" }
                elseif ($ext -eq ".css") { $contentType = "text/css; charset=utf-8" }
                elseif ($ext -eq ".json") { $contentType = "application/json; charset=utf-8" }
                elseif ($ext -eq ".png") { $contentType = "image/png" }
                elseif ($ext -eq ".jpg" -or $ext -eq ".jpeg") { $contentType = "image/jpeg" }
                elseif ($ext -eq ".mp3") { $contentType = "audio/mpeg" }
                elseif ($ext -eq ".m4a") { $contentType = "audio/mp4" }
                
                $response.ContentType = $contentType
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $response.StatusCode = 404
                $bytes = [System.Text.Encoding]::UTF8.GetBytes("File Not Found")
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
        }
    } catch {
        Write-Output "Error serving request: $_"
    } finally {
        if ($response) {
            $response.Close()
        }
    }
}
