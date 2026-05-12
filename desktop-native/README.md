# VideoInstaller Native Desktop

This directory contains the current primary application for VideoInstaller.

## Overview

- Framework: `WPF + .NET 8`
- Target: `win-x64`
- Release model: self-contained Windows desktop app
- UI rule: no browser, no Electron, no WebView

## Projects

- `src/VideoInstaller.Desktop/`: desktop application
- `src/VideoInstaller.Desktop.Tests/`: unit tests for non-UI logic

## Related docs

- Root project overview: `../README.md`
- Current release notes: `../docs/release-notes-v2.2.0.md`
- Migration archive: `../docs/native-migration/`

## Build

From the repository root:

- `dotnet test desktop-native/VideoInstaller.Desktop.sln`
- `powershell -ExecutionPolicy Bypass -File scripts/build-native-portable.ps1`
- `powershell -ExecutionPolicy Bypass -File scripts/build-native-installer.ps1`
