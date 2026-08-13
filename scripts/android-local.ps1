param(
    [Parameter(Position = 0)]
    [ValidateSet('dev', 'test', 'apk', 'aab')]
    [string]$Action = 'test'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
$androidRoot = Join-Path $projectRoot 'android'
$appConfigPath = Join-Path $projectRoot 'app.json'

function Find-JavaHome {
    $candidates = @(
        $env:JAVA_HOME,
        'C:\Program Files\Android\openjdk\jdk-21.0.8',
        'C:\Program Files\Microsoft\jdk-21',
        'C:\Program Files\Microsoft\jdk-17'
    ) | Where-Object { $_ }

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath (Join-Path $candidate 'bin\java.exe')) {
            return $candidate
        }
    }

    throw 'OpenJDK was not found. Install JDK 17 or newer, then set JAVA_HOME.'
}

function Find-AndroidSdk {
    $candidates = @(
        $env:ANDROID_HOME,
        $env:ANDROID_SDK_ROOT,
        'C:\Program Files (x86)\Android\android-sdk',
        (Join-Path $env:LOCALAPPDATA 'Android\Sdk')
    ) | Where-Object { $_ }

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath (Join-Path $candidate 'platform-tools\adb.exe')) {
            # CMake can shorten clang++.exe incorrectly when the SDK path has
            # spaces/parentheses, causing native C++ linker failures on Windows.
            if ($candidate -match '[\s()]') {
                $safeSdkPath = Join-Path $projectRoot '.android-sdk'
                if (-not (Test-Path -LiteralPath $safeSdkPath)) {
                    New-Item -ItemType Junction -Path $safeSdkPath -Target $candidate | Out-Null
                }
                return $safeSdkPath
            }

            return $candidate
        }
    }

    throw 'Android SDK was not found. Install Android SDK platform-tools and set ANDROID_HOME.'
}

if (-not (Test-Path -LiteralPath $androidRoot)) {
    throw 'The native android directory is missing. Run npx expo prebuild --platform android once.'
}

$env:JAVA_HOME = Find-JavaHome
$env:ANDROID_HOME = Find-AndroidSdk
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$(Join-Path $env:JAVA_HOME 'bin');$(Join-Path $env:ANDROID_HOME 'platform-tools');$env:Path"
$env:NODE_ENV = if ($Action -eq 'dev') { 'development' } else { 'production' }

$appConfig = Get-Content -LiteralPath $appConfigPath -Raw | ConvertFrom-Json
$versionName = [string]$appConfig.expo.version
$versionCode = [int]$appConfig.expo.android.versionCode
$gradleVersionArgs = @(
    "-PtindaryoVersionName=$versionName",
    "-PtindaryoVersionCode=$versionCode"
)
$gradle = Join-Path $androidRoot 'gradlew.bat'
$artifactRoot = Join-Path $projectRoot 'artifacts\android'

function Invoke-Gradle {
    param([string[]]$Tasks)

    Push-Location $androidRoot
    try {
        & $gradle @Tasks @gradleVersionArgs
        if ($LASTEXITCODE -ne 0) {
            throw "Gradle failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}

function Copy-BuildArtifact {
    param(
        [string]$Source,
        [string]$Extension
    )

    New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null
    $destination = Join-Path $artifactRoot "Tindaryo-$versionName-$versionCode.$Extension"
    Copy-Item -LiteralPath $Source -Destination $destination -Force
    Write-Host "`nCreated: $destination" -ForegroundColor Green
}

switch ($Action) {
    'dev' {
        Push-Location $projectRoot
        try {
            npx.cmd expo run:android
            if ($LASTEXITCODE -ne 0) {
                throw "Android development build failed with exit code $LASTEXITCODE."
            }
        }
        finally {
            Pop-Location
        }
    }
    'test' {
        $adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
        $devices = & $adb devices
        if (-not ($devices -match "`tdevice$")) {
            throw 'No Android emulator or USB-debugging phone is connected.'
        }

        Invoke-Gradle -Tasks @('app:installPreview')
        & $adb shell am force-stop com.roden.tindaryo | Out-Null
        & $adb shell monkey -p com.roden.tindaryo -c android.intent.category.LAUNCHER 1 | Out-Null
        Write-Host "`nTindaryo $versionName ($versionCode) is installed and running without Expo Go." -ForegroundColor Green
    }
    'apk' {
        Invoke-Gradle -Tasks @('app:assemblePreview')
        $source = Join-Path $androidRoot 'app\build\outputs\apk\preview\app-preview.apk'
        Copy-BuildArtifact -Source $source -Extension 'apk'
    }
    'aab' {
        $signingProperties = Join-Path $androidRoot 'keystore.properties'
        if (-not (Test-Path -LiteralPath $signingProperties)) {
            throw 'Play signing is not configured. Run: npm run android:signing'
        }

        Invoke-Gradle -Tasks @('app:bundleRelease')
        $source = Join-Path $androidRoot 'app\build\outputs\bundle\release\app-release.aab'
        Copy-BuildArtifact -Source $source -Extension 'aab'
    }
}
