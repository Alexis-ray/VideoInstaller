# VideoInstaller

适用于 Windows 的本地视频下载器，支持 YouTube 与 Bilibili 链接解析、格式选择和本地下载。

[更新日志](CHANGELOG.md) · [v2.3.0 发布说明](docs/release-notes-v2.3.0.md) · [发布与验收说明](docs/release-workflow.md)

## 当前版本

当前对外版本：`v2.3.0`

### 可下载版本

- 原生桌面目录版：`VideoInstaller-v2.3.0-win-x64.zip`
- 原生桌面安装版：`VideoInstaller-v2.3.0-win-x64-setup.exe`

### 当前不提供的版本

- `legacy v2.3.0` 暂不提供下载。
- 原因是浏览器兼容线当前存在“启动终端后闪退”的已知问题，不适合作为正式发布资产提供给普通用户。

## 功能概览

- 原生 Windows 桌面界面，不依赖浏览器界面、不使用 Electron、不使用 WebView
- 支持 YouTube、YouTube Shorts、`youtu.be`、Bilibili 普通视频、多 P、番剧和短链
- 支持在下载前分别选择音频与视频格式
- 支持原始格式下载，或下载后转码为 H.264 MP4
- 支持封面保存、下载目录管理、代理配置、Cookie 导入与工具健康检查
- 安装版支持在安装阶段设置数据目录、下载目录与代理
- 设置页支持直接编辑主要路径项，并保留高级工具路径调整入口

## 运行要求

- Windows 10 / 11 x64
- 发布包已附带 `yt-dlp.exe`、`ffmpeg.exe` 和 Deno JavaScript 运行时
- 目录版与安装包版均不要求用户额外安装 Node.js 或 .NET Runtime

## 使用方法

1. 启动 `VideoInstaller.exe`
2. 粘贴 YouTube 或 Bilibili 链接
3. 等待解析完成后选择音频和视频格式
4. 选择原始下载或转码下载
5. 下载完成后按需打开输出目录或保存封面

## Cookie 使用说明

- 首次启动会自动准备 `config.json` 与 `cookies.txt`
- Cookie 文件使用 Netscape 格式
- 遇到 YouTube 登录验证、地区限制或 Bilibili 会员内容时，可以导入已登录浏览器导出的 Cookie
- 目录版默认使用程序目录附近的相对路径
- 安装版会把程序文件放到安装目录，并把配置、Cookie、日志、临时文件和默认下载目录写入安装向导确认的数据目录

### 关于“自动获取 Cookie”

- `v2.3.0` 已提供“重新自动获取 Cookie”入口，便于在遇到登录态问题时重新尝试。
- 该功能目前仍依赖本机浏览器登录态与 `yt-dlp` 的提取能力，因此**并不能保证每次都成功**。
- 如果自动获取失败，最稳定的方式仍然是手动导入浏览器导出的 Netscape 格式 Cookie。

### 手动导入浏览器 Cookie

1. 在常用浏览器中安装支持导出 Netscape Cookie 的扩展，或使用你信任的浏览器开发者工具导出方案。
2. 在目标站点完成登录后，仅导出对应站点的 Cookie，并保存为 Netscape 格式文本文件。
3. 打开 VideoInstaller 设置页，将“Cookie 路径”指向该文件；如果你使用目录版，也可以直接覆盖程序目录或数据目录中的 `cookies.txt`。
4. 重新执行解析或下载，确认登录验证、地区限制或会员内容已恢复可用。

注意事项：

- 不要把 Cookie 文件公开发送给他人。
- 如果浏览器导出的文件不是 Netscape 格式，需要先转换后再导入。
- Cookie 失效后重新导出即可，通常不需要改动其他配置。

## 用户可见目录说明

- `desktop-native/`：原生桌面应用与测试工程
- `scripts/`：构建与打包脚本
- `static/` 与 `index.js`：浏览器兼容线源码
- `docs/`：发布说明与使用注意事项
- `assets/icons/`：仓库内维护的正式图标源文件

`release/`、`release-build/` 和 `release-tools/` 都是本地构建或发布过程中使用的目录，不作为仓库内长期提交的用户资源目录。

## 从源码构建

```powershell
dotnet test desktop-native/VideoInstaller.Desktop.sln
npm run check
powershell -ExecutionPolicy Bypass -File scripts/build-native-portable.ps1
powershell -ExecutionPolicy Bypass -File scripts/build-native-installer.ps1
```

## 发布相关

```powershell
npm run release:clean
npm run release:tools
npm run release:native:portable
npm run release:native:installer
```

如果你需要自行验收发布物，建议同时阅读：

- `docs/release-notes-v2.3.0.md`
- `docs/release-workflow.md`
- `docs/release-acceptance-v2.3.0.md`
