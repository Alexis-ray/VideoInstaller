# VideoInstaller

VideoInstaller 是一个面向 Windows 本地环境的网页式视频解析下载器，基于 `Express + yt-dlp + ffmpeg` 构建，当前支持 YouTube 与 Bilibili 双站点下载。

当前版本：`v1.1.2`

[更新日志](CHANGELOG.md)

## 项目特性

- 支持 YouTube 与 Bilibili 视频链接解析
- 支持 `b23.tv` 短链自动展开
- 支持 Bilibili 普通视频、多 P、番剧 `ep/ss`、合集 `ml`
- 支持原始格式下载
- 支持下载后转码为 H.264 MP4
- 支持保存封面到视频目录
- 支持下载完成后自动打开目标文件夹
- 支持代理、Cookie 与健康检查接口
- 所有视频相关文件统一保存到 `tmp/<视频标题>/`

## Release 概览

当前发布版的目标是提供一个可直接发布到 GitHub 的 Windows 目录版和安装包版：

- 目录版可直接解压运行
- 安装包版提供桌面/开始菜单入口
- 配置和数据文件按发布场景分离

## 适用场景

这个项目适合在 Windows 本地部署，作为一个轻量、可控、可自定义配置的视频下载工具使用。

你可以通过浏览器访问本地 Web UI，完成以下流程：

1. 输入 YouTube 或 Bilibili 视频链接
2. 查看可用音频 / 视频格式
3. 选择原始下载，或下载后转码为 H.264 MP4
4. 保存封面、查看元数据，并直接打开落盘目录

## 环境要求

- Windows 10 / 11
- Node.js 18+
- `yt-dlp.exe`
- `ffmpeg.exe`

开发环境推荐工具路径：

- `C:/Tools/yt-dlp.exe`
- `C:/Tools/ffmpeg/bin/ffmpeg.exe`

## 安装

```powershell
git clone https://github.com/Alexis-ray/VideoInstaller.git
cd VideoInstaller
npm install
```

## 快速开始

1. 根据你的环境修改根目录 `config.json`
2. 确认 `yt-dlp` 与 `ffmpeg` 可执行文件路径正确
3. 启动服务：

```powershell
npm start
```

默认访问地址：

- `http://127.0.0.1:2878`

## 配置说明

项目根目录下的 `config.json` 用于管理主要配置：

```json
{
  "port": 2878,
  "address": "127.0.0.1",
  "runtimeMode": "portable",
  "tmpDir": "tmp",
  "cookie": "cookies.txt",
  "disable": false,
  "proxy": "http://127.0.0.1:7890",
  "proxyFallbackDirect": true,
  "ytDlpPath": "C:/Tools/yt-dlp.exe",
  "ffmpegPath": "C:/Tools/ffmpeg/bin/ffmpeg.exe",
  "thumbnailTimeout": 8000,
  "taskTimeout": {
    "parse": 60000,
    "download": 3600000
  },
  "diskCleanupThreshold": 90
}
```

### 关键字段

| 字段 | 说明 |
| --- | --- |
| `port` / `address` | 服务监听地址 |
| `runtimeMode` | 运行模式：`portable` 写程序目录，`installed` 优先写 `%LOCALAPPDATA%\VideoInstaller\` |
| `tmpDir` | 下载与相关文件保存目录 |
| `cookie` | Cookie 文件路径 |
| `proxy` | 代理地址 |
| `proxyFallbackDirect` | 代理失败后是否回退直连 |
| `ytDlpPath` | `yt-dlp` 可执行文件路径 |
| `ffmpegPath` | `ffmpeg` 可执行文件路径 |
| `thumbnailTimeout` | 封面抓取超时时间（毫秒） |
| `taskTimeout.parse` | 解析任务超时 |
| `taskTimeout.download` | 下载 / 转码任务超时 |
| `diskCleanupThreshold` | 临时目录所在磁盘占用超过该阈值时，空闲状态下自动清理 `tmp` |

## 站点支持范围

### YouTube

- 标准视频页
- Shorts
- `youtu.be` 短链

来源类型：

- `youtube-watch`
- `youtube-short`
- `youtube-shortlink`

### Bilibili

- 普通视频：`video/BV...`、`video/av...`
- 短链：`b23.tv`
- 分 P / 多 P 视频
- 番剧：`bangumi/play/ep...`、`bangumi/play/ss...`
- 合集：`medialist/play/ml...`

来源类型：

- `bilibili-video`
- `bilibili-short`
- `bilibili-part`
- `bilibili-multi-part`
- `bilibili-bangumi-episode`
- `bilibili-bangumi-season`
- `bilibili-medialist`

## 下载与文件保存规则

- 所有视频相关文件保存到 `tmp/<视频标题>/`
- 同一目录中可能包含：视频文件、音频文件、封面图、`*.info.json` 元数据文件
- 转码模式下会额外生成最终 `H.264 MP4` 文件
- 下载完成后，接口返回的 `video` / `audio` 字段基于实际落盘文件检测结果生成

## 代理与 Cookie 策略

默认策略如下：

- YouTube：默认走代理
- Bilibili：默认直连

更多细节：

- 健康检查接口会返回 `sitePolicy`，可直接查看不同站点的代理策略
- Bilibili 部分清晰度、会员内容或区域限制内容可能要求登录态
- 建议使用浏览器导出的 Netscape 格式 `cookies.txt`
- 源码运行、便携版和安装版在缺少 `cookies.txt` 时都会自动生成空白模板

## Web UI 说明

前端页面支持：

- 解析结果展示
- 音频 / 视频格式选择
- 分 P 选择与重新解析
- 来源类型标签展示
- 原始下载与转码下载
- 单独流下载
- 封面保存
- 下载完成态结果展示

## 接口说明

### 健康检查

```text
GET /y2b/health
```

返回服务运行状态、工具状态、代理配置、运行目录、Cookie 状态与当前任务信息。

### 解析视频

```text
GET /y2b/parse?url=<视频链接>
```

返回结果中会包含：

- `source`
- `sourceType`
- `parts`

### 下载视频

```text
GET /y2b/download?website=y2b|b2b&v=<id>&format=<videoId>x<audioId>&transcode=0|1&source=<源链接可选>
```

说明：

- `transcode=0`：原始下载
- `transcode=1`：下载后转码为 H.264 MP4
- 当解析来源为番剧、合集或分 P 页面时，建议携带 `source` 参数保持来源上下文

### 保存封面

```text
GET /y2b/thumbnail?website=y2b|b2b&v=<id>&title=<标题>&src=<封面源>&save=1
```

## 常用命令

```powershell
npm run check
npm run health
npm start
npm run release:tools
npm run release:portable
npm run release:installer
```

## Windows 发布

推荐顺序：先目录版，再安装包版。

1. 运行 `npm install`
2. 运行 `npm run release:tools`
3. 运行 `npm run release:portable`
4. 运行 `npm run release:installer`

目录版输出：

```text
release/
  VideoInstaller-win-x64/
    VideoInstaller.exe
    config.json
    cookies.txt
    static/
    tools/
    tmp/
```

安装包版会创建开始菜单入口、可选桌面快捷方式和卸载入口。

## 发布前验证建议

1. 执行 `npm run check`
2. 启动服务并访问首页
3. 执行 `npm run health`
4. 手动测试一个 YouTube 链接解析与下载
5. 手动测试一个 Bilibili 链接解析与下载
6. 验证原始下载、转码下载、封面保存与分 P 切换

## 版本说明

- `v1.1.0`：完成 YouTube / Bilibili 双站点能力整合
- `v1.1.1`：聚焦稳定性、交互反馈与项目文档成品化整理
- `v1.1.2`：清理 blacklist 链路，整理发布文档并强化 GitHub 发布呈现
