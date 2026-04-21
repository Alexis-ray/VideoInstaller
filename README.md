# YoutubeVideoInstaller

Windows 下的 YouTube / Bilibili 视频解析下载器，基于 `Express + yt-dlp + ffmpeg`。

当前版本：`v1.1.0`

更新日志：[`CHANGELOG.md`](CHANGELOG.md)

## 功能

当前版本提供以下下载能力：

- 解析视频并列出可用音频 / 视频格式
- 原始格式下载
- 下载后转码为 H.264 MP4
- 封面保存到视频同目录
- 所有文件统一保存到 `tmp/<视频标题>/`
- 支持 YouTube 与 Bilibili 视频 URL 解析
- 支持 `b23.tv` 短链、番剧、合集、多P、分P
- 代理支持，默认端口 `7890`
- 支持 Cookie 文件
- 支持健康检查接口
- 支持下载完成后自动打开目标文件夹
- 支持下载并转码完成后自动打开目标文件夹

## 功能实现

- 本地网页界面操作
- 解析结果展示
- 音频 / 视频格式选择
- 支持原始下载
- 支持下载并转码为 H.264 MP4
- 封面保存到视频同目录
- 下载中 / 转码中分离提示
- 自动保留原始下载文件与最终转码文件

## 环境要求

- Windows 10 / 11
- Node.js 18+
- `yt-dlp.exe`
- `ffmpeg.exe`

推荐工具路径：

- `C:/Tools/yt-dlp.exe`
- `C:/Tools/ffmpeg/bin/ffmpeg.exe`

## 安装

```powershell
git clone https://github.com/Alexis-ray/YoutubeVideoInstaller.git
cd YoutubeVideoInstaller
npm install
```

## 配置

项目根目录下的 `config.json` 用于管理主要配置：

```json
{
  "port": 2878,
  "address": "127.0.0.1",
  "tmpDir": "tmp",
  "blacklist": "blacklist.txt",
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

字段说明：

- `port` / `address`：服务监听地址
- `tmpDir`：临时下载目录
- `proxy`：代理地址
- `proxyFallbackDirect`：代理失败时的回退策略
- `cookie`：Cookie 文件路径（YouTube / Bilibili 都可复用）
- `thumbnailTimeout`：封面抓取超时时间（毫秒）
- `diskCleanupThreshold`：磁盘占用超过该百分比时自动清理 `tmp`
- `ytDlpPath`：`yt-dlp` 可执行文件路径
- `ffmpegPath`：`ffmpeg` 可执行文件路径

## 代理说明

本项目的下载代理由后端程序直接传给 `yt-dlp` 和封面下载工具。

代理配置需要提供：

- 一个可用的本地代理地址
- 代理协议对应的访问方式
- `config.json` 中填写正确的 `proxy` 值
- 默认代理地址为 `http://127.0.0.1:7890`
- 当前默认策略：YouTube 下载与封面抓取使用代理，Bilibili 下载与封面抓取默认直连

## Cookie 说明

- 项目默认读取根目录 `cookies.txt`
- 对于 Bilibili，部分清晰度、会员内容、分区限制内容可能要求登录态
- 当出现 403、权限不足、需要登录等报错时，优先更新 `cookies.txt`
- 建议使用浏览器导出的 Netscape 格式 Cookie 文件

## 启动

```powershell
npm start
```

启动后访问以下地址：

- `http://127.0.0.1:2878`

## 常用命令

```powershell
npm run check
npm run health
```

## 接口说明

- `GET /y2b/health`：健康状态与工具可用性
- `GET /y2b/parse?url=<视频链接>`：解析 YouTube 或 Bilibili 视频（返回 `source` / `sourceType` / `parts`）
- `GET /y2b/download?website=y2b|b2b&v=<id>&format=<videoId>x<audioId>&transcode=0|1&source=<源链接可选>`：下载任务
- `GET /y2b/thumbnail?website=y2b|b2b&v=<id>&title=<标题>&src=<封面源>&save=1`：保存封面到视频同目录

### 前后端同步说明

- 前端会根据 `parse` 返回的 `sourceType` 显示来源标签（YouTube 标准页 / Shorts / 短链；Bilibili 视频 / 短链 / 番剧 / 合集 / 分P）
- 前端分P切换使用 `parts` 列表并触发重新解析，下载时会透传 `source` 保持来源上下文
- 后端下载完成态中的 `video` / `audio` 字段基于实际落盘文件检测结果返回，不再依赖固定命名拼接

### Bilibili 边界支持

- 支持 `b23.tv` 短链解析（服务端自动展开）
- 支持 `video/BV...`、`video/av...`、`bangumi/play/ep...`、`bangumi/play/ss...`、`medialist/play/ml...`
- 当解析来源为番剧/合集时，下载接口建议携带 `source` 参数以保持来源上下文
- 分P信息会在解析结果中返回 `parts` 列表，前端可按 `p` 切换后重新解析

## 文件保存规则

- 所有视频相关文件保存到 `tmp/<视频标题>/`
- 同一目录下包含：视频文件、音频文件、封面图、`info.json`
- 转码模式下会额外生成最终 `H.264 MP4` 文件
- 字幕下载与自动转录不在本项目内提供

## 字幕与转录

如需将视频内容转为字幕或文本，可使用外部转录服务，例如：

- `https://turboscribe.ai/zh-CN/dashboard`

该网站支持在线视频转录，可作为补充工具使用。

- 免费额度：每 24 小时 3 个任务
- 单个任务时长限制：不超过 30 分钟
- 付费后可获得更多转录额度

建议将其作为本项目的补充工具。

## 说明

- 当前版本支持 YouTube 与 Bilibili 的视频下载流程，已作为 `v1.1.0` 正式稳定发布
- 如果封面图获取失败，页面会自动切换后续候选图
