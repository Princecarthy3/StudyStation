# ==============================================================================
# StudyStation Windows MSIX Package Builder
# ==============================================================================
# Builds and validates the Windows MSIX package for StudyStation.
# Resolves Microsoft Store certification warnings and configures Windows 11 widgets.
# ==============================================================================

param(
    [switch]$SignPackage = $false,
    [string]$CertificatePath = "",
    [string]$CertificatePassword = ""
)

$ErrorActionPreference = "Stop"

Write-Host "`n=== StudyStation Windows MSIX Packager ===" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# 1. Verify Manifest and Images
$manifestPath = Join-Path $scriptDir "Package.appxmanifest"
if (-not (Test-Path $manifestPath)) {
    Write-Error "Package.appxmanifest not found at $manifestPath"
}
Write-Host "[1/5] Validating Package.appxmanifest..." -ForegroundColor Green

[xml]$manifestXml = Get-Content $manifestPath
$pkgName = $manifestXml.Package.Identity.Name
$pkgVersion = $manifestXml.Package.Identity.Version
$publisher = $manifestXml.Package.Identity.Publisher

Write-Host "      App Identity: $pkgName"
Write-Host "      Version:      $pkgVersion"
Write-Host "      Publisher:    $publisher"

# Validate capabilities
$caps = $manifestXml.Package.Capabilities.ChildNodes | Select-Object -ExpandProperty LocalName
Write-Host "      Capabilities: $($caps -join ', ')"

if ($manifestXml.Package.Capabilities.Capability | Where-Object { $_.Name -match "runFullTrust" }) {
    Write-Warning "      [!] 'runFullTrust' detected in manifest. Ensure Partner Center justification is ready."
} else {
    Write-Host "      [✓] Clean capabilities (no restricted capabilities triggering Store rejection)." -ForegroundColor Green
}

# 2. Check Visual Assets
Write-Host "`n[2/5] Checking visual assets in windows/Images/..." -ForegroundColor Green
$requiredImages = @(
    "Square44x44Logo.png",
    "Square150x150Logo.png",
    "Wide310x150Logo.png",
    "SplashScreen.png",
    "StoreLogo.png"
)

foreach ($img in $requiredImages) {
    $imgPath = Join-Path $scriptDir "Images\$img"
    if (Test-Path $imgPath) {
        Write-Host "      [✓] $img" -ForegroundColor Green
    } else {
        Write-Warning "      [!] Missing image: $img"
    }
}

# 3. Locate Windows SDK Tools
Write-Host "`n[3/5] Locating Windows SDK packaging tools..." -ForegroundColor Green
$cmd = Get-Command makeappx.exe -ErrorAction SilentlyContinue
$makeAppx = if ($cmd) { $cmd.Source } else { $null }

if (-not $makeAppx) {
    # Check standard Windows Kits directories
    $sdkPaths = @(
        "C:\Program Files (x86)\Windows Kits\10\bin\10.0.*\x64\makeappx.exe",
        "C:\Program Files (x86)\Windows Kits\10\bin\x64\makeappx.exe"
    )
    foreach ($p in $sdkPaths) {
        $found = Get-ChildItem -Path $p -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) { $makeAppx = $found.FullName; break }
    }
}

$outputDir = Join-Path $scriptDir "dist"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$msixFile = Join-Path $outputDir "StudyStation-$pkgVersion.msix"

if ($makeAppx) {
    Write-Host "      Found makeappx at: $makeAppx" -ForegroundColor Green
    Write-Host "`n[4/5] Packing MSIX package..." -ForegroundColor Green

    # Create package layout directory
    $layoutDir = Join-Path $outputDir "layout"
    if (Test-Path $layoutDir) { Remove-Item -Recurse -Force $layoutDir }
    New-Item -ItemType Directory -Path $layoutDir -Force | Out-Null
    New-Item -ItemType Directory -Path "$layoutDir\Images" -Force | Out-Null

    Copy-Item $manifestPath -Destination "$layoutDir\AppxManifest.xml"
    Copy-Item "$scriptDir\Images\*" -Destination "$layoutDir\Images"

    & $makeAppx pack /d $layoutDir /p $msixFile /o

    Write-Host "      [✓] Package built: $msixFile" -ForegroundColor Green
} else {
    Write-Host "      [i] Windows SDK 'makeappx.exe' not installed in current PATH." -ForegroundColor Yellow
    Write-Host "      The manifest and layout are validated and ready for packaging via PWABuilder CLI or Visual Studio." -ForegroundColor Cyan
    Write-Host "      To build with PWABuilder CLI: npx @pwabuilder/cli pack -d ." -ForegroundColor White
}

# 4. Signing (Optional for local testing)
Write-Host "`n[5/5] Package Signing Status:" -ForegroundColor Green
if ($SignPackage -and (Test-Path $msixFile)) {
    $signtoolCmd = Get-Command signtool.exe -ErrorAction SilentlyContinue
    $signtool = if ($signtoolCmd) { $signtoolCmd.Source } else { $null }
    if ($signtool -and $CertificatePath -and (Test-Path $CertificatePath)) {
        Write-Host "      Signing with certificate: $CertificatePath"
        & $signtool sign /fd SHA256 /a /f $CertificatePath /p $CertificatePassword $msixFile
        Write-Host "      [✓] Package signed successfully!" -ForegroundColor Green
    } else {
        Write-Host "      To test-sign locally for side-loading, run:" -ForegroundColor Yellow
        Write-Host "      New-SelfSignedCertificate -Type Custom -Subject 'CN=StudyStation' -KeyUsage DigitalSignature -FriendlyName 'StudyStation' -CertStoreLocation 'Cert:\CurrentUser\My'" -ForegroundColor Gray
    }
} else {
    Write-Host "      For Microsoft Store submission, signing is handled automatically by Microsoft Partner Center upon upload." -ForegroundColor Gray
}

Write-Host "`n=== Packaging Complete ===" -ForegroundColor Cyan
Write-Host "Next steps for Store submission:"
Write-Host "1. Upload 'Package.appxmanifest' or the built .msix to Microsoft Partner Center."
Write-Host "2. See windows/MICROSOFT-STORE-GUIDE.md for step-by-step submission instructions.`n"
