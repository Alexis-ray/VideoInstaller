# VideoInstaller Native Desktop

This directory contains the native Windows desktop application for `VideoInstaller`.

## Scope

- Framework: `WPF + .NET 8`
- Target: `win-x64`
- Runtime model: self-contained desktop release
- UI rule: no browser, no Electron, no WebView

## Current status

- `S00` baseline documentation is recorded under `docs/native-migration/`.
- `S01-S13` core desktop migration is implemented in `src/` and covered by unit tests.
- Native release packaging is driven by `scripts/build-native-portable.ps1` and `scripts/build-native-installer.ps1`.

## Projects

- `src/VideoInstaller.Desktop/`: WPF application
- `src/VideoInstaller.Desktop.Tests/`: unit tests for non-UI logic

## Build

From the repository root:

- `dotnet test desktop-native/VideoInstaller.Desktop.sln`
- `powershell -ExecutionPolicy Bypass -File scripts/build-native-portable.ps1`
- `powershell -ExecutionPolicy Bypass -File scripts/build-native-installer.ps1`
