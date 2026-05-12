# VideoInstaller

Windows 原生桌面视频下载器，支持 YouTube 与 Bilibili 链接解析、格式选择和本地下载。

[更新日志](CHANGELOG.md) · [发布说明](docs/release-notes-v2.2.0.md)

## 简介

VideoInstaller 当前主线是基于 `WPF + .NET 8 + yt-dlp + ffmpeg` 的 Windows 桌面应用，目标是提供一个不依赖浏览器界面、开箱即用的本地下载器。

## 特性

- 原生 Windows 桌面界面，不使用 Electron 或 WebView
- 支持 YouTube、YouTube Shorts、`youtu.be`、Bilibili 普通视频、多 P、番剧和短链
- 支持在下载前分别选择音频与视频格式
- 支持原始格式下载，或下载后转码为 H.264 MP4
- 支持封面保存、下载目录管理、代理配置、Cookie 导入与工具健康检查
- 安装版支持在安装阶段预先设置下载目录与代理

## 下载

当前推荐版本：`v2.2.0`

### Native 桌面版

- 目录版：`VideoInstaller-v2.2.0-win-x64.zip`
- 安装包版：`VideoInstaller-v2.2.0-win-x64-setup.exe`

解压或安装后直接运行 `VideoInstaller.exe`。

### Legacy Web 兼容版

- 目录版：`VideoInstaller-legacy-v2.2.0-win-x64.zip`
- 安装包版：`VideoInstaller-legacy-v2.2.0-win-x64-setup.exe`

Legacy 版本仅用于兼容保留，不是当前主发布形态。

## 运行要求

- Windows 10 / 11 x64
- 发布包已附带 `yt-dlp.exe`、`ffmpeg.exe` 和 Deno JavaScript 运行时
- 目录版与安装包版均不要求用户额外安装 Node.js 或 .NET Runtime

## 使用方式

1. 启动 `VideoInstaller.exe`
2. 粘贴 YouTube 或 Bilibili 链接
3. 等待解析完成后选择音频和视频格式
4. 选择原始下载或转码下载
5. 按需保存封面或打开输出目录

## 配置与 Cookie

- 首次启动会自动准备 `config.json` 与 `cookies.txt`
- Cookie 使用 Netscape 格式
- 遇到 YouTube 登录验证、地区限制或 Bilibili 会员内容时，可导入已登录浏览器导出的 Cookie
- 安装版配置默认保存在 `%LOCALAPPDATA%\VideoInstaller\`

## 仓库结构

- `desktop-native/`: 当前主线桌面应用与测试工程
- `scripts/`: native / legacy 构建与安装脚本
- `static/` 与 `index.js`: legacy Web 兼容线
- `docs/`: 发布说明与历史迁移文档

## 开发与构建

```powershell
dotnet test desktop-native/VideoInstaller.Desktop.sln
npm run check
powershell -ExecutionPolicy Bypass -File scripts/build-native-portable.ps1
powershell -ExecutionPolicy Bypass -File scripts/build-native-installer.ps1
```

## 说明

- `release/` 是正式发布资产输出目录
- `release-build/` 是构建过程中的中间输出目录，不应作为最终发布入口
- `npm start` 启动的是 legacy Web 兼容线，不是 native 桌面版
