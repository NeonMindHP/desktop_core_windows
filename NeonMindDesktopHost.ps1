param([switch]$DesktopMode)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName Microsoft.VisualBasic
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NeonMindNative {
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    public struct SHFILEINFO {
        public IntPtr hIcon;
        public int iIcon;
        public uint dwAttributes;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
        public string szDisplayName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 80)]
        public string szTypeName;
    }
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
    [DllImport("shell32.dll", CharSet = CharSet.Auto)]
    public static extern IntPtr SHGetFileInfo(string pszPath, uint dwFileAttributes, ref SHFILEINFO psfi, uint cbFileInfo, uint uFlags);
    [DllImport("user32.dll")]
    public static extern bool DestroyIcon(IntPtr hIcon);
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
    [DllImport("user32.dll")]
    public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint flags);
}
"@

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NeonMindAudio {
  enum EDataFlow { eRender, eCapture, eAll }
  enum ERole { eConsole, eMultimedia, eCommunications }
  [Flags] enum CLSCTX : uint { ALL = 23 }
  [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDevice {
    int Activate(ref Guid id, CLSCTX context, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object instance);
  }
  [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceEnumerator {
    int NotImpl1();
    int GetDefaultAudioEndpoint(EDataFlow flow, ERole role, out IMMDevice device);
  }
  [ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioEndpointVolume {
    int RegisterControlChangeNotify(IntPtr notify);
    int UnregisterControlChangeNotify(IntPtr notify);
    int GetChannelCount(out uint count);
    int SetMasterVolumeLevel(float level, Guid context);
    int SetMasterVolumeLevelScalar(float level, Guid context);
    int GetMasterVolumeLevel(out float level);
    int GetMasterVolumeLevelScalar(out float level);
    int SetChannelVolumeLevel(uint channel, float level, Guid context);
    int SetChannelVolumeLevelScalar(uint channel, float level, Guid context);
    int GetChannelVolumeLevel(uint channel, out float level);
    int GetChannelVolumeLevelScalar(uint channel, out float level);
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, Guid context);
    int GetMute(out bool mute);
  }
  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
  class MMDeviceEnumerator {}
  static IAudioEndpointVolume Endpoint() {
    var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumerator();
    IMMDevice device;
    Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(EDataFlow.eRender, ERole.eMultimedia, out device));
    object endpoint;
    Guid iid = typeof(IAudioEndpointVolume).GUID;
    Marshal.ThrowExceptionForHR(device.Activate(ref iid, CLSCTX.ALL, IntPtr.Zero, out endpoint));
    return (IAudioEndpointVolume)endpoint;
  }
  public static int GetVolume() {
    float value;
    Marshal.ThrowExceptionForHR(Endpoint().GetMasterVolumeLevelScalar(out value));
    return Math.Max(0, Math.Min(100, (int)Math.Round(value * 100)));
  }
  public static void SetVolume(int value) {
    float scalar = Math.Max(0, Math.Min(100, value)) / 100f;
    Marshal.ThrowExceptionForHR(Endpoint().SetMasterVolumeLevelScalar(scalar, Guid.Empty));
  }
  public static bool GetMute() {
    bool muted;
    Marshal.ThrowExceptionForHR(Endpoint().GetMute(out muted));
    return muted;
  }
}
"@

$script:Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:ConfigPath = Join-Path $script:Root "desktop-config.json"
$script:Running = $true
$script:Port = 47831
$script:Token = [Guid]::NewGuid().ToString("N")

function Get-DefaultConfig {
  $downloads = Join-Path ([Environment]::GetFolderPath("UserProfile")) "Downloads"
  return [ordered]@{
    ClaimVisible = $false
    RightPanelMode = "system"
    BackgroundPath = ""
    WeatherCity = "Berlin"
    Shortcuts = @(
      [ordered]@{ Name="Dieser PC"; Kind="Shell"; Target="shell:MyComputerFolder"; Glyph="▣" },
      [ordered]@{ Name="Bilder"; Kind="Folder"; Target=[Environment]::GetFolderPath("MyPictures"); Glyph="◇" },
      [ordered]@{ Name="Downloads"; Kind="Folder"; Target=$downloads; Glyph="↓" },
      [ordered]@{ Name="Projekte"; Kind="Folder"; Target=(Join-Path ([Environment]::GetFolderPath("MyDocuments")) "NeonMind Projekte"); Glyph="⌘" },
      [ordered]@{ Name="Papierkorb"; Kind="Shell"; Target="shell:RecycleBinFolder"; Glyph="♲" }
    )
  }
}

function Save-Config {
  $script:Config | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $script:ConfigPath -Encoding UTF8
}

if (Test-Path -LiteralPath $script:ConfigPath) {
  try {
    $script:Config = Get-Content -LiteralPath $script:ConfigPath -Raw | ConvertFrom-Json
  } catch {
    $script:Config = Get-DefaultConfig
    Save-Config
  }
} else {
  $script:Config = Get-DefaultConfig
  Save-Config
}
if ($null -eq $script:Config.RightPanelMode) {
  $script:Config | Add-Member -NotePropertyName RightPanelMode -NotePropertyValue $(if ($script:Config.ClaimVisible) { "claim" } else { "system" })
  Save-Config
}
if ($null -eq $script:Config.BackgroundPath) {
  $script:Config | Add-Member -NotePropertyName BackgroundPath -NotePropertyValue ""
  Save-Config
}
if ($null -eq $script:Config.WeatherCity) {
  $script:Config | Add-Member -NotePropertyName WeatherCity -NotePropertyValue "Berlin"
  Save-Config
}

function Write-Response {
  param($Response, [int]$Status, [string]$ContentType, [byte[]]$Bytes)
  $Response.StatusCode = $Status
  $Response.ContentType = $ContentType
  $Response.ContentLength64 = $Bytes.Length
  $Response.Headers["Cache-Control"] = "no-store"
  $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
  $Response.OutputStream.Close()
}

function Write-Json {
  param($Response, $Value, [int]$Status = 200)
  $json = $Value | ConvertTo-Json -Depth 7 -Compress
  Write-Response $Response $Status "application/json; charset=utf-8" ([Text.Encoding]::UTF8.GetBytes($json))
}

function Read-JsonBody {
  param($Request)
  $reader = New-Object IO.StreamReader($Request.InputStream, $Request.ContentEncoding)
  $raw = $reader.ReadToEnd()
  $reader.Close()
  if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
  return $raw | ConvertFrom-Json
}

function Show-NeonDialog {
  param($Dialog)
  $owner = New-Object Windows.Forms.Form
  $owner.Text = "NeonMind Desktop Core"
  $owner.ShowInTaskbar = $false
  $owner.TopMost = $true
  $owner.StartPosition = [Windows.Forms.FormStartPosition]::CenterScreen
  $owner.Size = New-Object Drawing.Size 1,1
  $owner.Opacity = 0
  try {
    $owner.Show()
    $owner.Activate()
    return $Dialog.ShowDialog($owner)
  } finally {
    $owner.Close()
    $owner.Dispose()
  }
}

function Open-Target {
  param([string]$Kind, [string]$Target)
  switch ($Kind) {
    "Shell" { Start-Process explorer.exe -ArgumentList $Target }
    "Folder" {
      if (-not (Test-Path -LiteralPath $Target)) {
        New-Item -ItemType Directory -Path $Target -Force | Out-Null
      }
      Start-Process explorer.exe -ArgumentList "`"$Target`""
    }
    "Url" { Start-Process $Target }
    "App" { Start-Process -FilePath $Target }
    "File" { Start-Process -FilePath $Target }
  }
}

function Assert-ValidFileName {
  param([string]$Name)
  if ([string]::IsNullOrWhiteSpace($Name) -or $Name.IndexOfAny([IO.Path]::GetInvalidFileNameChars()) -ge 0) {
    throw "Der Name enthält ungültige Zeichen."
  }
}

function Assert-EditablePath {
  param([string]$Path)
  if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path)) {
    throw "Datei oder Ordner wurde nicht gefunden."
  }
  if ([string]::IsNullOrWhiteSpace((Split-Path -Parent $Path))) {
    throw "Ein Laufwerk kann hier nicht verändert werden."
  }
}

function Get-FileVisualBytes {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { throw "Symbolquelle wurde nicht gefunden." }
  $extension = [IO.Path]::GetExtension($Path).ToLowerInvariant()
  $stream = New-Object IO.MemoryStream
  try {
    if (@(".jpg",".jpeg",".png",".bmp",".gif") -contains $extension) {
      $source = [Drawing.Image]::FromFile($Path)
      try {
        $canvas = New-Object Drawing.Bitmap 72,72
        $graphics = [Drawing.Graphics]::FromImage($canvas)
        try {
          $graphics.Clear([Drawing.Color]::Transparent)
          $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
          $scale = [Math]::Min(68.0 / $source.Width, 68.0 / $source.Height)
          $width = [Math]::Max(1, [int]($source.Width * $scale))
          $height = [Math]::Max(1, [int]($source.Height * $scale))
          $x = [int]((72 - $width) / 2)
          $y = [int]((72 - $height) / 2)
          $graphics.DrawImage($source, $x, $y, $width, $height)
        } finally {
          $graphics.Dispose()
        }
        try {
          $canvas.Save($stream, [Drawing.Imaging.ImageFormat]::Png)
        } finally {
          $canvas.Dispose()
        }
      } finally {
        $source.Dispose()
      }
    } else {
      $resolvedIconPath = $Path
      if ($extension -eq ".lnk") {
        try {
          $link = (New-Object -ComObject WScript.Shell).CreateShortcut($Path)
          if ($link.TargetPath -and (Test-Path -LiteralPath $link.TargetPath)) {
            $resolvedIconPath = $link.TargetPath
          }
        } catch {}
      }

      $icon = $null
      if (Test-Path -LiteralPath $resolvedIconPath -PathType Leaf) {
        try { $icon = [Drawing.Icon]::ExtractAssociatedIcon($resolvedIconPath) } catch {}
      }

      if (-not $icon) {
        $info = New-Object NeonMindNative+SHFILEINFO
        $size = [Runtime.InteropServices.Marshal]::SizeOf($info.GetType())
        $isDirectory = Test-Path -LiteralPath $resolvedIconPath -PathType Container
        $attributes = $(if ($isDirectory) { 0x00000010 } else { 0 })
        $flags = $(if ($isDirectory) { 0x00000110 } else { 0x00000100 })
        [NeonMindNative]::SHGetFileInfo($resolvedIconPath, $attributes, [ref]$info, $size, $flags) | Out-Null
        if ($info.hIcon -eq [IntPtr]::Zero) { throw "Windows konnte kein Symbol liefern." }
        try {
          $icon = ([Drawing.Icon]::FromHandle($info.hIcon)).Clone()
        } finally {
          [NeonMindNative]::DestroyIcon($info.hIcon) | Out-Null
        }
      }

      try {
        $bitmap = $icon.ToBitmap()
        try {
          $bitmap.Save($stream, [Drawing.Imaging.ImageFormat]::Png)
        } finally {
          $bitmap.Dispose()
        }
      } finally {
        $icon.Dispose()
      }
    }
    [byte[]]$bytes = $stream.ToArray()
    Write-Output -NoEnumerate $bytes
  } finally {
    $stream.Dispose()
  }
}

function Get-WindowPreviewBytes {
  param([IntPtr]$Handle)
  $rect = New-Object NeonMindNative+RECT
  if ($Handle -eq [IntPtr]::Zero -or -not [NeonMindNative]::GetWindowRect($Handle, [ref]$rect)) {
    throw "Fenstervorschau ist nicht verfügbar."
  }
  $width = [Math]::Max(1, $rect.Right - $rect.Left)
  $height = [Math]::Max(1, $rect.Bottom - $rect.Top)
  $bitmap = New-Object Drawing.Bitmap $width,$height
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  $hdc = $graphics.GetHdc()
  try {
    [NeonMindNative]::PrintWindow($Handle, $hdc, 2) | Out-Null
  } finally {
    $graphics.ReleaseHdc($hdc)
    $graphics.Dispose()
  }
  $preview = New-Object Drawing.Bitmap 300,170
  $previewGraphics = [Drawing.Graphics]::FromImage($preview)
  $stream = New-Object IO.MemoryStream
  try {
    $previewGraphics.Clear([Drawing.Color]::FromArgb(1,3,10))
    $previewGraphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $scale = [Math]::Min(300.0 / $width, 170.0 / $height)
    $drawWidth = [Math]::Max(1, [int]($width * $scale))
    $drawHeight = [Math]::Max(1, [int]($height * $scale))
    $previewGraphics.DrawImage($bitmap, [int]((300-$drawWidth)/2), [int]((170-$drawHeight)/2), $drawWidth, $drawHeight)
    $preview.Save($stream, [Drawing.Imaging.ImageFormat]::Png)
    [byte[]]$bytes = $stream.ToArray()
    Write-Output -NoEnumerate $bytes
  } finally {
    $stream.Dispose()
    $previewGraphics.Dispose()
    $preview.Dispose()
    $bitmap.Dispose()
  }
}

function Send-MediaCommand {
  param([int]$Command)
  $target = [NeonMindNative]::GetForegroundWindow()
  [NeonMindNative]::SendMessage($target, 0x0319, $target, [IntPtr]($Command -shl 16)) | Out-Null
}

function Get-OpenWindows {
  return @(Get-Process | Where-Object {
    $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -and
    $_.ProcessName -notin @("NeonMindDesktopCore","NeonMindWebViewRuntime")
  } | Sort-Object ProcessName | Select-Object -First 24 | ForEach-Object {
    $executablePath = ""
    try { $executablePath = $_.Path } catch {}
    [ordered]@{ Id=$_.Id; Title=$_.MainWindowTitle; Process=$_.ProcessName; Path=$executablePath }
  })
}

function Handle-Api {
  param($Context)
  $request = $Context.Request
  $response = $Context.Response
  if ($request.QueryString["token"] -ne $script:Token) {
    Write-Json $response @{ error="Nicht autorisiert" } 403
    return
  }
  $path = $request.Url.AbsolutePath.ToLowerInvariant()
  try {
    switch ($path) {
      "/api/icon" {
        $iconPath = [string]$request.QueryString["path"]
        [byte[]]$iconBytes = Get-FileVisualBytes $iconPath
        Write-Response $response 200 "image/png" $iconBytes
      }
      "/api/window-preview" {
        $process = Get-Process -Id ([int]$request.QueryString["id"]) -ErrorAction Stop
        [byte[]]$previewBytes = Get-WindowPreviewBytes $process.MainWindowHandle
        Write-Response $response 200 "image/png" $previewBytes
      }
      "/api/state" {
        $backgroundExists = -not [string]::IsNullOrWhiteSpace([string]$script:Config.BackgroundPath) -and (Test-Path -LiteralPath ([string]$script:Config.BackgroundPath) -PathType Leaf)
        $backgroundVersion = $(if ($backgroundExists) { (Get-Item -LiteralPath ([string]$script:Config.BackgroundPath)).LastWriteTimeUtc.Ticks } else { 0 })
        Write-Json $response @{ claimVisible=[bool]$script:Config.ClaimVisible; rightPanelMode=[string]$script:Config.RightPanelMode; shortcuts=@($script:Config.Shortcuts); openWindows=@(Get-OpenWindows); customBackground=$backgroundExists; backgroundVersion=$backgroundVersion; weatherCity=[string]$script:Config.WeatherCity }
      }
      "/api/windows" {
        Write-Json $response @{ openWindows=@(Get-OpenWindows) }
      }
      "/api/open" {
        $body = Read-JsonBody $request
        Open-Target ([string]$body.kind) ([string]$body.target)
        Write-Json $response @{ ok=$true }
      }
      "/api/focus" {
        $body = Read-JsonBody $request
        $process = Get-Process -Id ([int]$body.id) -ErrorAction Stop
        [NeonMindNative]::ShowWindowAsync($process.MainWindowHandle, 9) | Out-Null
        [NeonMindNative]::SetForegroundWindow($process.MainWindowHandle) | Out-Null
        Write-Json $response @{ ok=$true }
      }
      "/api/window-action" {
        $body = Read-JsonBody $request
        $process = Get-Process -Id ([int]$body.id) -ErrorAction Stop
        $action = [string]$body.action
        switch ($action) {
          "focus" {
            [NeonMindNative]::ShowWindowAsync($process.MainWindowHandle, 9) | Out-Null
            [NeonMindNative]::SetForegroundWindow($process.MainWindowHandle) | Out-Null
          }
          "minimize" {
            [NeonMindNative]::ShowWindowAsync($process.MainWindowHandle, 6) | Out-Null
          }
          "close" {
            $process.CloseMainWindow() | Out-Null
          }
          default { throw "Unbekannte Fensteraktion." }
        }
        Write-Json $response @{ ok=$true }
      }
      "/api/media" {
        $body = Read-JsonBody $request
        $commands = @{ previous=12; playpause=14; next=11; mute=8 }
        Send-MediaCommand ([int]$commands[[string]$body.command])
        Write-Json $response @{ ok=$true }
      }
      "/api/media-status" {
        $handle = [NeonMindNative]::GetForegroundWindow()
        $active = Get-Process | Where-Object { $_.MainWindowHandle -eq $handle } | Select-Object -First 1
        if (-not $active -or $active.ProcessName -in @("NeonMindDesktopCore","NeonMindWebViewRuntime")) {
          $mediaNames = @("spotify","vlc","wmplayer","music.ui","aimp","winamp","foobar2000","mpc-hc","mpc-hc64","msedge","chrome","firefox")
          $active = Get-Process | Where-Object { $_.MainWindowTitle -and $_.ProcessName.ToLowerInvariant() -in $mediaNames } | Select-Object -First 1
        }
        Write-Json $response @{
          title=$(if ($active) { [string]$active.MainWindowTitle } else { "" })
          process=$(if ($active) { [string]$active.ProcessName } else { "" })
        }
      }
      "/api/volume-state" {
        Write-Json $response @{ volume=[NeonMindAudio]::GetVolume(); muted=[NeonMindAudio]::GetMute() }
      }
      "/api/volume" {
        $body = Read-JsonBody $request
        [NeonMindAudio]::SetVolume([int]$body.value)
        Write-Json $response @{ ok=$true; volume=[NeonMindAudio]::GetVolume() }
      }
      "/api/system" {
        $cpu = [Math]::Round((Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average)
        $os = Get-CimInstance Win32_OperatingSystem
        $ram = [Math]::Round((1 - ($os.FreePhysicalMemory / $os.TotalVisibleMemorySize)) * 100)
        Write-Json $response @{ cpu=$cpu; ram=$ram }
      }
      "/api/weather" {
        $body = Read-JsonBody $request
        $city = [string]$body.city
        if ([string]::IsNullOrWhiteSpace($city)) { $city = [string]$script:Config.WeatherCity }
        if ([string]::IsNullOrWhiteSpace($city)) { $city = "Berlin" }
        $encodedCity = [Uri]::EscapeDataString($city)
        $geocodingUrl = "https://geocoding-api.open-meteo.com/v1/search?name=$encodedCity&count=1&language=de&format=json"
        $geo = Invoke-RestMethod -Uri $geocodingUrl -Method Get -TimeoutSec 4
        if ($null -eq $geo.results -or @($geo.results).Count -eq 0) { throw "Der Wetterort wurde nicht gefunden." }
        $place = @($geo.results)[0]
        $latitude = [string]$place.latitude
        $longitude = [string]$place.longitude
        $forecastUrl = "https://api.open-meteo.com/v1/forecast?latitude=$latitude&longitude=$longitude&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3"
        $forecast = Invoke-RestMethod -Uri $forecastUrl -Method Get -TimeoutSec 4
        $script:Config.WeatherCity = [string]$place.name
        Save-Config
        Write-Json $response @{
          location="$($place.name)$(if ($place.admin1) { ", $($place.admin1)" })"
          country=[string]$place.country
          temperature=[Math]::Round([double]$forecast.current.temperature_2m)
          feels=[Math]::Round([double]$forecast.current.apparent_temperature)
          wind=[Math]::Round([double]$forecast.current.wind_speed_10m)
          code=[int]$forecast.current.weather_code
          isDay=[int]$forecast.current.is_day
          max=[Math]::Round([double]($forecast.daily.temperature_2m_max[0]))
          min=[Math]::Round([double]($forecast.daily.temperature_2m_min[0]))
        }
      }
      "/api/news" {
        $rssUrl = "https://www.tagesschau.de/index~rss2.xml"
        $responseData = Invoke-WebRequest -Uri $rssUrl -UseBasicParsing -TimeoutSec 4
        [xml]$feed = $responseData.Content
        $items = @($feed.rss.channel.item | Select-Object -First 12 | ForEach-Object {
          $description = [regex]::Replace([string]$_.description, "<[^>]+>", " ")
          $description = [Net.WebUtility]::HtmlDecode($description)
          if ($description.Length -gt 180) { $description = $description.Substring(0, 177) + "..." }
          [ordered]@{
            title=[Net.WebUtility]::HtmlDecode([string]$_.title)
            link=[string]$_.link
            description=$description.Trim()
            date=$(try { ([DateTime][string]$_.pubDate).ToString("dd.MM. HH:mm") } catch { "" })
          }
        })
        Write-Json $response @{ source="tagesschau.de"; items=$items }
      }
      "/api/session" {
        $body = Read-JsonBody $request
        switch ([string]$body.action) {
          "logout" { Start-Process shutdown.exe -ArgumentList "/l" }
          "restart" { Start-Process shutdown.exe -ArgumentList "/r /t 0" }
          "shutdown" { Start-Process shutdown.exe -ArgumentList "/s /t 0" }
          default { throw "Unbekannte Windows-Sitzungsaktion." }
        }
        Write-Json $response @{ ok=$true }
      }
      "/api/exit" {
        Write-Json $response @{ ok=$true; closing=$true }
        $script:Running = $false
      }
      "/api/drives" {
        $drives = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {
          $size = [double]$_.Size
          $free = [double]$_.FreeSpace
          [ordered]@{
            name = $_.DeviceID
            label = $(if ($_.VolumeName) { $_.VolumeName } else { "Lokaler Datenträger" })
            path = "$($_.DeviceID)\"
            freeGb = [Math]::Round($free / 1GB, 1)
            totalGb = [Math]::Round($size / 1GB, 1)
            usedPercent = $(if ($size -gt 0) { [Math]::Round((1 - ($free / $size)) * 100) } else { 0 })
          }
        })
        Write-Json $response @{ drives=$drives }
      }
      "/api/desktop-items" {
        $desktopPath = [Environment]::GetFolderPath("Desktop")
        $items = @()
        if (Test-Path -LiteralPath $desktopPath -PathType Container) {
          $items = @(Get-ChildItem -LiteralPath $desktopPath -Force -ErrorAction SilentlyContinue | Where-Object { -not $_.Attributes.ToString().Contains("Hidden") } | Sort-Object @{Expression={$_.PSIsContainer};Descending=$true}, Name | Select-Object -First 40 | ForEach-Object {
            [ordered]@{ name=$_.Name; path=$_.FullName; directory=[bool]$_.PSIsContainer; extension=$_.Extension; modified=$_.LastWriteTimeUtc.Ticks }
          })
        }
        Write-Json $response @{ path=$desktopPath; items=$items }
      }
      "/api/background" {
        $backgroundPath = [string]$script:Config.BackgroundPath
        if ([string]::IsNullOrWhiteSpace($backgroundPath) -or -not (Test-Path -LiteralPath $backgroundPath -PathType Leaf)) {
          Write-Json $response @{ error="Kein eigenes Hintergrundbild ausgewählt." } 404
          break
        }
        $extension = [IO.Path]::GetExtension($backgroundPath).ToLowerInvariant()
        $mime = switch ($extension) {
          ".png" { "image/png" }
          ".webp" { "image/webp" }
          default { "image/jpeg" }
        }
        Write-Response $response 200 $mime ([IO.File]::ReadAllBytes($backgroundPath))
      }
      "/api/list" {
        $body = Read-JsonBody $request
        $pathValue = [string]$body.path
        if ($pathValue -eq "::recycle") {
          $shell = New-Object -ComObject Shell.Application
          $recycleFolder = $shell.Namespace(10)
          $items = @()
          if ($null -ne $recycleFolder) {
            $items = @($recycleFolder.Items() | Select-Object -First 200 | ForEach-Object {
              [ordered]@{ name=$_.Name; path=$_.Path; directory=[bool]$_.IsFolder; extension=[IO.Path]::GetExtension($_.Name); size=[long]$_.Size; modified="" }
            })
          }
          Write-Json $response @{ path="Papierkorb"; rawPath="::recycle"; parent="::drives"; items=$items }
          break
        }
        if ($pathValue -eq "::drives") {
          $items = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {
            $driveLabel = if ($_.VolumeName) { $_.VolumeName } else { "Lokaler Datenträger" }
            [ordered]@{ name="$($_.DeviceID)  $driveLabel"; path="$($_.DeviceID)\"; directory=$true; extension=""; size=0; modified="" }
          })
          Write-Json $response @{ path="Dieser PC"; rawPath="::drives"; parent=$null; items=$items }
          break
        }
        if (-not (Test-Path -LiteralPath $pathValue -PathType Container)) { throw "Ordner wurde nicht gefunden." }
        $items = @(Get-ChildItem -LiteralPath $pathValue -ErrorAction Stop | Sort-Object @{Expression={$_.PSIsContainer};Descending=$true}, Name | Select-Object -First 200 | ForEach-Object {
          [ordered]@{ name=$_.Name; path=$_.FullName; directory=[bool]$_.PSIsContainer; extension=$_.Extension; size=$(if ($_.PSIsContainer) { 0 } else { $_.Length }); modified=$_.LastWriteTime.ToString("dd.MM.yyyy HH:mm") }
        })
        $parent = Split-Path -Parent $pathValue
        Write-Json $response @{ path=$pathValue; rawPath=$pathValue; parent=$parent; items=$items }
      }
      "/api/create-folder" {
        $body = Read-JsonBody $request
        $parentPath = [string]$body.path
        $name = [string]$body.name
        if (-not (Test-Path -LiteralPath $parentPath -PathType Container)) { throw "Zielordner wurde nicht gefunden." }
        Assert-ValidFileName $name
        $destination = Join-Path $parentPath $name
        if (Test-Path -LiteralPath $destination) { throw "Dieser Name ist bereits vorhanden." }
        New-Item -ItemType Directory -Path $destination -ErrorAction Stop | Out-Null
        Write-Json $response @{ ok=$true; path=$destination }
      }
      "/api/rename" {
        $body = Read-JsonBody $request
        $source = [string]$body.path
        $name = [string]$body.name
        Assert-EditablePath $source
        Assert-ValidFileName $name
        $destination = Join-Path (Split-Path -Parent $source) $name
        if (Test-Path -LiteralPath $destination) { throw "Dieser Name ist bereits vorhanden." }
        Move-Item -LiteralPath $source -Destination $destination -ErrorAction Stop
        Write-Json $response @{ ok=$true; path=$destination }
      }
      "/api/move" {
        $body = Read-JsonBody $request
        $source = [string]$body.path
        Assert-EditablePath $source
        $dialog = New-Object Windows.Forms.FolderBrowserDialog
        $dialog.Description = "Ziel für Verschieben auswählen"
        if ((Show-NeonDialog $dialog) -eq [Windows.Forms.DialogResult]::OK) {
          $destination = Join-Path $dialog.SelectedPath (Split-Path -Leaf $source)
          if (Test-Path -LiteralPath $destination) { throw "Am Ziel ist dieser Name bereits vorhanden." }
          Move-Item -LiteralPath $source -Destination $destination -ErrorAction Stop
          Write-Json $response @{ ok=$true; path=$destination }
        } else {
          Write-Json $response @{ ok=$false; cancelled=$true }
        }
      }
      "/api/delete" {
        $body = Read-JsonBody $request
        $target = [string]$body.path
        Assert-EditablePath $target
        if (Test-Path -LiteralPath $target -PathType Container) {
          [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory(
            $target,
            [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,
            [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin
          )
        } else {
          [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile(
            $target,
            [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,
            [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin
          )
        }
        Write-Json $response @{ ok=$true }
      }
      "/api/file-action" {
        $body = Read-JsonBody $request
        $target = [string]$body.path
        $action = [string]$body.action
        Assert-EditablePath $target
        switch ($action) {
          "show-windows" {
            Start-Process explorer.exe -ArgumentList "/select,`"$target`""
          }
          "terminal" {
            $workingDirectory = $(if (Test-Path -LiteralPath $target -PathType Container) { $target } else { Split-Path -Parent $target })
            Start-Process powershell.exe -WorkingDirectory $workingDirectory
          }
          "open-with" {
            Start-Process rundll32.exe -ArgumentList "shell32.dll,OpenAs_RunDLL `"$target`""
          }
          "print" {
            Start-Process -FilePath $target -Verb Print
          }
          "properties" {
            $shell = New-Object -ComObject Shell.Application
            $folder = $shell.Namespace((Split-Path -Parent $target))
            $item = $folder.ParseName((Split-Path -Leaf $target))
            if ($null -eq $item) { throw "Eigenschaften konnten nicht geöffnet werden." }
            $item.InvokeVerb("properties")
          }
          "shortcut" {
            $desktopPath = [Environment]::GetFolderPath("Desktop")
            $baseName = [IO.Path]::GetFileNameWithoutExtension($target)
            if (Test-Path -LiteralPath $target -PathType Container) { $baseName = Split-Path -Leaf $target }
            $shortcutPath = Join-Path $desktopPath "$baseName - Verknüpfung.lnk"
            $counter = 2
            while (Test-Path -LiteralPath $shortcutPath) {
              $shortcutPath = Join-Path $desktopPath "$baseName - Verknüpfung ($counter).lnk"
              $counter++
            }
            $wsh = New-Object -ComObject WScript.Shell
            $shortcut = $wsh.CreateShortcut($shortcutPath)
            $shortcut.TargetPath = $target
            $shortcut.WorkingDirectory = $(if (Test-Path -LiteralPath $target -PathType Container) { $target } else { Split-Path -Parent $target })
            $shortcut.Save()
          }
          "set-background" {
            $extension = [IO.Path]::GetExtension($target).ToLowerInvariant()
            if (@(".jpg",".jpeg",".png",".webp") -notcontains $extension) { throw "Diese Datei ist kein unterstütztes Hintergrundbild." }
            $script:Config.BackgroundPath = $target
            Save-Config
          }
          default { throw "Unbekannte Dateifunktion." }
        }
        Write-Json $response @{ ok=$true }
      }
      "/api/clipboard-paste" {
        $body = Read-JsonBody $request
        $source = [string]$body.source
        $destinationFolder = [string]$body.destination
        Assert-EditablePath $source
        if (-not (Test-Path -LiteralPath $destinationFolder -PathType Container)) { throw "Zielordner wurde nicht gefunden." }
        $destination = Join-Path $destinationFolder (Split-Path -Leaf $source)
        if (Test-Path -LiteralPath $destination) { throw "Am Ziel ist dieser Name bereits vorhanden." }
        if ([bool]$body.move) {
          Move-Item -LiteralPath $source -Destination $destination -ErrorAction Stop
        } else {
          Copy-Item -LiteralPath $source -Destination $destination -Recurse -ErrorAction Stop
        }
        Write-Json $response @{ ok=$true; path=$destination }
      }
      "/api/create-desktop-folder" {
        $body = Read-JsonBody $request
        $name = [string]$body.name
        Assert-ValidFileName $name
        $desktopPath = [Environment]::GetFolderPath("Desktop")
        $destination = Join-Path $desktopPath $name
        if (Test-Path -LiteralPath $destination) { throw "Dieser Name ist bereits auf dem Desktop vorhanden." }
        New-Item -ItemType Directory -Path $destination -ErrorAction Stop | Out-Null
        Write-Json $response @{ ok=$true; path=$destination }
      }
      "/api/system-settings" {
        $body = Read-JsonBody $request
        $target = switch ([string]$body.page) {
          "display" { "ms-settings:display" }
          "personalization" { "ms-settings:personalization" }
          default { throw "Unbekannte Windows-Einstellung." }
        }
        Start-Process $target
        Write-Json $response @{ ok=$true }
      }
      "/api/task-manager" {
        Start-Process taskmgr.exe
        Write-Json $response @{ ok=$true }
      }
      "/api/claim" {
        $body = Read-JsonBody $request
        $script:Config.ClaimVisible = [bool]$body.visible
        Save-Config
        Write-Json $response @{ ok=$true; visible=[bool]$script:Config.ClaimVisible }
      }
      "/api/panel" {
        $body = Read-JsonBody $request
        $allowedModes = @("claim","system","music","calendar","notifications","ai","weather","social","news","empty")
        $mode = [string]$body.mode
        if ($allowedModes -notcontains $mode) { throw "Unbekannter Widget-Modus" }
        $script:Config.RightPanelMode = $mode
        $script:Config.ClaimVisible = ($mode -eq "claim")
        Save-Config
        Write-Json $response @{ ok=$true; mode=$mode }
      }
      "/api/pick-folder" {
        $dialog = New-Object Windows.Forms.FolderBrowserDialog
        $dialog.Description = "Ordner für NeonMind Desktop auswählen"
        if ((Show-NeonDialog $dialog) -eq [Windows.Forms.DialogResult]::OK) {
          $name = Split-Path -Leaf $dialog.SelectedPath
          if ([string]::IsNullOrWhiteSpace($name)) { $name = $dialog.SelectedPath }
          $newShortcut = [ordered]@{ Name=$name; Kind="Folder"; Target=$dialog.SelectedPath; Glyph="◇" }
          $script:Config.Shortcuts = @($script:Config.Shortcuts) + $newShortcut
          Save-Config
          Write-Json $response @{ ok=$true; shortcut=$newShortcut }
        } else {
          Write-Json $response @{ ok=$false; cancelled=$true }
        }
      }
      "/api/pick-app" {
        $dialog = New-Object Windows.Forms.OpenFileDialog
        $dialog.Title = "Programm für NeonMind Desktop auswählen"
        $dialog.Filter = "Programme (*.exe)|*.exe|Alle Dateien (*.*)|*.*"
        if ((Show-NeonDialog $dialog) -eq [Windows.Forms.DialogResult]::OK) {
          $newShortcut = [ordered]@{ Name=[IO.Path]::GetFileNameWithoutExtension($dialog.FileName); Kind="App"; Target=$dialog.FileName; Glyph="◈" }
          $script:Config.Shortcuts = @($script:Config.Shortcuts) + $newShortcut
          Save-Config
          Write-Json $response @{ ok=$true; shortcut=$newShortcut }
        } else {
          Write-Json $response @{ ok=$false; cancelled=$true }
        }
      }
      "/api/pick-file" {
        $dialog = New-Object Windows.Forms.OpenFileDialog
        $dialog.Title = "Datei für NeonMind Desktop auswählen"
        $dialog.Filter = "Alle Dateien (*.*)|*.*"
        if ((Show-NeonDialog $dialog) -eq [Windows.Forms.DialogResult]::OK) {
          $newShortcut = [ordered]@{ Name=[IO.Path]::GetFileName($dialog.FileName); Kind="File"; Target=$dialog.FileName; Glyph="▤" }
          $script:Config.Shortcuts = @($script:Config.Shortcuts) + $newShortcut
          Save-Config
          Write-Json $response @{ ok=$true; shortcut=$newShortcut }
        } else {
          Write-Json $response @{ ok=$false; cancelled=$true }
        }
      }
      "/api/pick-background" {
        $dialog = New-Object Windows.Forms.OpenFileDialog
        $dialog.Title = "Hintergrundbild für NeonMind auswählen"
        $dialog.Filter = "Bilder (*.jpg;*.jpeg;*.png;*.webp)|*.jpg;*.jpeg;*.png;*.webp"
        if ((Show-NeonDialog $dialog) -eq [Windows.Forms.DialogResult]::OK) {
          $script:Config.BackgroundPath = $dialog.FileName
          Save-Config
          Write-Json $response @{ ok=$true }
        } else {
          Write-Json $response @{ ok=$false; cancelled=$true }
        }
      }
      "/api/clear-background" {
        $script:Config.BackgroundPath = ""
        Save-Config
        Write-Json $response @{ ok=$true }
      }
      "/api/remove-shortcut" {
        $body = Read-JsonBody $request
        $target = [string]$body.target
        $script:Config.Shortcuts = @($script:Config.Shortcuts | Where-Object { [string]$_.Target -ne $target })
        Save-Config
        Write-Json $response @{ ok=$true }
      }
      "/api/shutdown" {
        Write-Json $response @{ ok=$true }
        $script:Running = $false
      }
      default { Write-Json $response @{ error="Unbekannte API" } 404 }
    }
  } catch {
    Write-Json $response @{ error=$_.Exception.Message } 500
  }
}

function Serve-Static {
  param($Context)
  $requestPath = [Uri]::UnescapeDataString($Context.Request.Url.AbsolutePath.TrimStart("/"))
  if ([string]::IsNullOrWhiteSpace($requestPath)) { $requestPath = "index.html" }
  $rootPath = [IO.Path]::GetFullPath($script:Root)
  $rootPrefix = $rootPath.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  $fullPath = [IO.Path]::GetFullPath((Join-Path $script:Root $requestPath))
  if (-not $fullPath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    Write-Json $Context.Response @{ error="Ungültiger Pfad" } 403
    return
  }
  if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
    Write-Json $Context.Response @{ error="Nicht gefunden" } 404
    return
  }
  $mime = switch ([IO.Path]::GetExtension($fullPath).ToLowerInvariant()) {
    ".html" { "text/html; charset=utf-8" }
    ".css"  { "text/css; charset=utf-8" }
    ".js"   { "application/javascript; charset=utf-8" }
    ".png"  { "image/png" }
    ".webp" { "image/webp" }
    ".ico"  { "image/x-icon" }
    ".mp4"  { "video/mp4" }
    default { "application/octet-stream" }
  }
  Write-Response $Context.Response 200 $mime ([IO.File]::ReadAllBytes($fullPath))
}

$listener = New-Object Net.HttpListener
$listener.Prefixes.Add("http://localhost:$($script:Port)/")
try {
  $listener.Start()
} catch {
  [Windows.Forms.MessageBox]::Show("Der lokale Funktionshost konnte nicht starten.`n`n$($_.Exception.Message)", "NeonMind Desktop Core") | Out-Null
  exit 1
}

$nativeHost = Join-Path $script:Root "NeonMindDesktopCore.exe"
if (-not (Test-Path -LiteralPath $nativeHost -PathType Leaf)) {
  $listener.Stop()
  [Windows.Forms.MessageBox]::Show("NeonMindDesktopCore.exe wurde nicht gefunden.", "NeonMind Desktop Core") | Out-Null
  exit 1
}

$url = "http://localhost:$($script:Port)/?token=$($script:Token)"
$arguments = @("--url", "`"$url`"")
if ($DesktopMode) { $arguments += "--desktop" } else { $arguments += "--safe" }
$script:NativeProcess = Start-Process -FilePath $nativeHost -ArgumentList $arguments -PassThru

$pending = $listener.BeginGetContext($null, $null)
while ($script:Running -and $listener.IsListening) {
  if (-not $pending.AsyncWaitHandle.WaitOne(500)) {
    if ($script:NativeProcess.HasExited) { $script:Running = $false }
    continue
  }
  try {
    $context = $listener.EndGetContext($pending)
    if ($context.Request.Url.AbsolutePath.StartsWith("/api/")) { Handle-Api $context } else { Serve-Static $context }
  } catch {
    if (-not $script:Running) { break }
  }
  if ($script:Running -and $listener.IsListening) { $pending = $listener.BeginGetContext($null, $null) }
}
if ($listener.IsListening) { $listener.Stop() }
$listener.Close()
if ($script:NativeProcess -and -not $script:NativeProcess.HasExited) {
  Stop-Process -Id $script:NativeProcess.Id -Force -ErrorAction SilentlyContinue
}
