param(
  [ValidateSet("debug", "bundle")]
  [string]$Mode = "debug"
)

$ErrorActionPreference = "Stop"

$javaCandidates = @(@(
  $env:JAVA_HOME,
  "C:\Program Files\Android\Android Studio\jbr"
) | Where-Object { $_ -and (Test-Path (Join-Path $_ "bin\java.exe")) })

if (-not $javaCandidates) {
  throw "Java nao encontrado. Instale o Android Studio ou configure JAVA_HOME."
}

$sdkCandidates = @(@(
  $env:ANDROID_HOME,
  $env:ANDROID_SDK_ROOT,
  (Join-Path $env:LOCALAPPDATA "Android\Sdk")
) | Where-Object { $_ -and (Test-Path $_) })

if (-not $sdkCandidates) {
  throw "Android SDK nao encontrado. Abra o Android Studio e instale o SDK."
}

$env:JAVA_HOME = $javaCandidates[0]
$env:ANDROID_HOME = $sdkCandidates[0]
$env:ANDROID_SDK_ROOT = $sdkCandidates[0]
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"

$androidDir = Join-Path $PSScriptRoot "..\android"

Push-Location $androidDir
try {
  if ($Mode -eq "bundle") {
    .\gradlew.bat bundleRelease
  } else {
    .\gradlew.bat assembleDebug
  }
} finally {
  Pop-Location
}
