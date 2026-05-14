# VideoInstaller 原生桌面版

本目录包含 VideoInstaller 当前的主发布线，也就是基于 `WPF + .NET 8` 的 Windows 原生桌面应用。

## 概览

- 技术栈：`WPF + .NET 8`
- 目标平台：`win-x64`
- 发布形态：自包含 Windows 桌面应用
- 界面原则：不依赖浏览器界面、不使用 Electron、不使用 WebView

## 项目结构

- `src/VideoInstaller.Desktop/`：桌面应用主工程
- `src/VideoInstaller.Desktop.Tests/`：非 UI 逻辑相关单元测试

## 相关文档

- 根项目总览：`../README.md`
- 当前发布说明：`../docs/release-notes-v2.3.0.md`
- 发布验收清单：`../docs/release-acceptance-v2.3.0.md`
- 原生迁移历史存档：`../docs/native-migration/`

## 用户说明

- 当前推荐下载与使用的都是原生桌面版 `v2.3.0`
- 主页面已经提供“重新自动获取 Cookie”入口，但该能力目前仍不保证每次都成功
- 如果目标站点需要稳定登录态，建议优先按根目录 README 中的说明手动导入浏览器 Cookie

## 构建方式

在仓库根目录执行：

- `dotnet test desktop-native/VideoInstaller.Desktop.sln`
- `powershell -ExecutionPolicy Bypass -File scripts/build-native-portable.ps1`
- `powershell -ExecutionPolicy Bypass -File scripts/build-native-installer.ps1`
