$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
$androidRoot = Join-Path $projectRoot 'android'
$propertiesPath = Join-Path $androidRoot 'keystore.properties'
$defaultKeyDirectory = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Tindaryo Release Key'
$defaultKeyPath = Join-Path $defaultKeyDirectory 'tindaryo-upload.jks'
$keyAlias = 'tindaryo-upload'

function Find-Keytool {
    $candidates = @(
        $(if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME 'bin\keytool.exe' }),
        'C:\Program Files\Android\openjdk\jdk-21.0.8\bin\keytool.exe',
        'C:\Program Files\Microsoft\jdk-21\bin\keytool.exe',
        'C:\Program Files\Microsoft\jdk-17\bin\keytool.exe'
    ) | Where-Object { $_ }

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }

    throw 'keytool was not found. Install OpenJDK 17 or newer, then set JAVA_HOME.'
}

function ConvertTo-PlainText {
    param([Security.SecureString]$SecureValue)

    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

$enteredPath = Read-Host "Upload-key location [$defaultKeyPath]"
$keyPath = if ([string]::IsNullOrWhiteSpace($enteredPath)) { $defaultKeyPath } else { $enteredPath.Trim() }
$keyPath = [IO.Path]::GetFullPath($keyPath)
$keyDirectory = Split-Path -Parent $keyPath

$securePassword = Read-Host 'Choose the upload-key password (save it in your password manager)' -AsSecureString
$secureConfirmation = Read-Host 'Enter the password again' -AsSecureString
$password = ConvertTo-PlainText $securePassword
$confirmation = ConvertTo-PlainText $secureConfirmation

try {
    if ($password.Length -lt 6) {
        throw 'The upload-key password must contain at least 6 characters.'
    }
    if ($password -cne $confirmation) {
        throw 'The passwords did not match.'
    }

    $keytool = Find-Keytool
    New-Item -ItemType Directory -Path $keyDirectory -Force | Out-Null

    if (Test-Path -LiteralPath $keyPath) {
        & $keytool -list -keystore $keyPath -alias $keyAlias -storepass $password | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw 'The existing upload key or password could not be verified.'
        }
        Write-Host 'Using the existing verified upload key.' -ForegroundColor Yellow
    }
    else {
        & $keytool -genkeypair -v -storetype PKCS12 -keystore $keyPath -alias $keyAlias -keyalg RSA -keysize 2048 -validity 10000 -storepass $password -keypass $password -dname 'CN=Tindaryo Upload Key, O=Tindaryo, C=PH'
        if ($LASTEXITCODE -ne 0) {
            throw "keytool failed with exit code $LASTEXITCODE."
        }
    }

    $portableKeyPath = $keyPath.Replace('\', '/')
    $properties = @(
        "storeFile=$portableKeyPath",
        "storePassword=$password",
        "keyAlias=$keyAlias",
        "keyPassword=$password"
    )
    # Windows PowerShell's UTF8 encoding adds a BOM. Java Properties treats
    # those bytes as part of the first key, so Gradle cannot find storeFile.
    $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllLines($propertiesPath, $properties, $utf8WithoutBom)

    Write-Host "`nSigning is configured locally." -ForegroundColor Green
    Write-Host "Key: $keyPath"
    Write-Host "Local settings: $propertiesPath"
    Write-Warning 'Back up the .jks file and its password somewhere secure. Neither file is committed to Git.'
}
finally {
    $password = $null
    $confirmation = $null
}
