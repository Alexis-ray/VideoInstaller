# VideoInstaller

Windows 原生桌面视频下载器，基于 `WPF + .NET 8 + yt-dlp + ffmpeg` 构建。

当前稳定版本：`v2.0.1`  
[更新日志](CHANGELOG.md) · [发布说明](docs/release-notes-v2.0.1.md)

## 发布资产

### 主发布线：Native 桌面版

- 目录版：`VideoInstaller-v2.0.1-win-x64.zip`
- 安装包版：`VideoInstaller-v2.0.1-win-x64-setup.exe`

### 兼容产物：Legacy Web 版

- 目录版：`VideoInstaller-legacy-v2.0.1-win-x64/`
- 安装包版：`VideoInstaller-legacy-v2.0.1-win-x64-setup.exe`

## 特性

- 原生 Windows 桌面窗口，不使用浏览器、不使用 Electron、不使用 WebView
- 支持 YouTube 与 Bilibili 链接解析
- 支持 `youtu.be`、YouTube Shorts、`b23.tv`、Bilibili 多 P、番剧 `ep/ss`、合集 `ml`
- 支持在下载前分别选择音频品质和视频品质
- 支持原始格式下载
- 支持下载后转码为 H.264 MP4
- 支持下载中、转码中和完成/失败状态在按钮附近显示
- 支持保存封面到视频目录
- 支持下载完成后打开目录
- 支持代理、Cookie、日志、Deno JavaScript 运行时和工具健康检查
- 所有下载相关文件统一写入 `tmp/<视频标题>/`

## 运行要求

- Windows 10 / 11 x64
- 发布包内已附带 `yt-dlp.exe`、`ffmpeg.exe` 与供 `yt-dlp` 解析 YouTube 使用的 Deno JavaScript 运行时
- 目录版和安装包版都不要求用户安装 Node.js
- 目录版和安装包版都不要求用户额外安装 .NET Runtime

## 使用方式

1. 启动 `VideoInstaller.exe`
2. 粘贴 YouTube 或 Bilibili 链接
3. 等待解析结果加载完成
4. 选择原始下载，或选择下载并转码为 H.264 MP4
5. 用音频/视频下拉框确认当前组合后开始下载
6. 按需保存封面或打开输出目录

## Native 目录版

目录结构：

```text
VideoInstaller-v2.0.1-win-x64/
  VideoInstaller.exe
  config.json
  cookies.txt
  logs/
  tmp/
  tools/
    yt-dlp.exe
    ffmpeg.exe
    js-runtime/
      deno.exe
```

说明：

- 解压后直接运行 `VideoInstaller.exe`
- 配置、Cookie、日志和下载目录都保存在目录版自身目录下
- 目录版运行模式会优先识别发布目录，不会再误回退到仓库根目录
- 适合直接解压使用，或手动管理程序与数据目录

## Native 安装包版

说明：

- 默认安装到 `%ProgramFiles%\VideoInstaller`
- 用户配置写入 `%LOCALAPPDATA%\VideoInstaller\config.json`
- Cookie 写入 `%LOCALAPPDATA%\VideoInstaller\cookies.txt`
- 下载目录写入 `%LOCALAPPDATA%\VideoInstaller\tmp\`
- 日志目录写入 `%LOCALAPPDATA%\VideoInstaller\logs\`
- 程序文件仍从安装目录下 `tools\` 读取 `yt-dlp.exe`、`ffmpeg.exe` 与 Deno JavaScript 运行时

## 配置文件

默认 `config.json`：

```json
{
  "runtimeMode": "portable",
  "tmpDir": "tmp",
  "cookie": "cookies.txt",
  "proxy": "",
  "proxyFallbackDirect": true,
  "ytDlpPath": "tools/yt-dlp.exe",
  "ffmpegPath": "tools/ffmpeg.exe",
  "jsRuntimePath": "tools/js-runtime/deno.exe",
  "thumbnailTimeout": 8000,
  "taskTimeout": {
    "parse": 60000,
    "download": 3600000
  },
  "diskCleanupThreshold": 90
}
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `runtimeMode` | `portable` 或 `installed` |
| `tmpDir` | 下载目录 |
| `cookie` | Cookie 文件路径 |
| `proxy` | 代理地址，留空表示直连 |
| `proxyFallbackDirect` | 代理失败后是否回退直连 |
| `ytDlpPath` | `yt-dlp.exe` 路径 |
| `ffmpegPath` | `ffmpeg.exe` 路径 |
| `jsRuntimePath` | Deno JavaScript 运行时路径，供 yt-dlp 解析 YouTube 使用 |
| `thumbnailTimeout` | 封面抓取超时，单位毫秒 |
| `taskTimeout.parse` | 解析超时，单位毫秒 |
| `taskTimeout.download` | 下载和转码超时，单位毫秒 |
| `diskCleanupThreshold` | 磁盘清理阈值 |

## Cookie

- 首次启动会自动生成空白 `cookies.txt`
- 文件采用 Netscape Cookie 格式
- 遇到 YouTube 真人验证、登录验证、会员内容、区域限制或 Bilibili 需要登录态的内容时，可替换为浏览器导出的 Cookie 文件
- Cookie 文件路径可在设置页查看；目录版位于解压目录，安装版位于 `%LOCALAPPDATA%\VideoInstaller\cookies.txt`

## YouTube 常见失败处理

- 默认不配置代理，直接访问网络；如果你的网络环境需要代理，可在设置页按需填写代理地址
- 如果提示需要登录或确认不是机器人，请把已登录浏览器导出的 Netscape 格式 Cookie 保存到设置页显示的 Cookie 路径
- 如果提示 JavaScript 运行时不可用，请确认发布包内存在 `tools/js-runtime/deno.exe`
- 如果出现 SSL/EOF/TLS 相关错误，优先检查代理设置、代理证书和本机网络环境；未使用代理时请保持代理地址为空

## 常见问题

- `yt-dlp.exe` 缺失：请确认 `tools/yt-dlp.exe` 存在
- `ffmpeg.exe` 缺失：请确认 `tools/ffmpeg.exe` 存在
- `config.json` 损坏：程序会自动备份并重建默认配置
- 代理不可用：可清空 `proxy` 改为直连，或确认代理软件和证书配置正常
- YouTube 提示不是机器人：请导入有效 YouTube Cookie 后重试
- YouTube 提示缺少 JavaScript 运行时：请确认 `tools/js-runtime/deno.exe` 存在
- Bilibili 内容解析失败：可能需要有效 Cookie

## 验证与构建

仓库内发布前自动验证命令：

```powershell
dotnet test desktop-native/VideoInstaller.Desktop.sln
dotnet build desktop-native/VideoInstaller.Desktop.sln -c Release
npm run check
powershell -ExecutionPolicy Bypass -File scripts/build-native-portable.ps1
powershell -ExecutionPolicy Bypass -File scripts/build-native-installer.ps1
```

## Legacy Web 版

仓库仍保留旧 `Node.js + Express + 浏览器 Web UI` 实现，作为兼容发布线：

- `index.js`
- `static/`
- `scripts/build-portable.ps1`
- `scripts/build-installer.ps1`

说明：

- Native 桌面版是当前主发布线
- Legacy 产物继续跟随 `v2.0.1` 版本号发布，并统一使用 `legacy` 文件名前缀
- Deno JavaScript 运行时是 native 发布线为 YouTube 兼容性补充的保障项，不属于 legacy Web 线运行前提
