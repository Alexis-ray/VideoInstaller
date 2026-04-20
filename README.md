# YoutubeVideoInstaller

Windows 下的 YouTube 视频解析下载器，基于 `Express + yt-dlp + ffmpeg`。

当前版本专注于 YouTube 下载流程，支持：

- 解析视频并列出可用音频 / 视频格式
- 原始格式下载
- 下载后转码为 H.264 MP4
- 封面保存到视频同目录
- 所有文件统一保存到 `tmp/<视频标题>/`
- 代理支持，默认端口 `7890`

## 当前已实现

- 本地网页界面操作
- 解析结果展示
- 音频 / 视频格式选择
- 两种下载模式：
  - 原始下载
  - 下载并转码为 H.264 MP4
- 封面保存到视频同目录
- 下载中 / 转码中分离提示
- 自动保留原始下载文件与最终转码文件

## 环境要求

- Windows 10 / 11
- Node.js 18+
- `yt-dlp.exe`
- `ffmpeg.exe`

建议工具路径：

- `C:/Tools/yt-dlp.exe`
- `C:/Tools/ffmpeg/bin/ffmpeg.exe`

## 安装

```powershell
git clone https://github.com/develon2015/Youtube-dl-REST.git
cd Youtube-dl-REST
npm install
```

## 配置

项目根目录下的 `config.json` 负责主要配置：

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

- `port` / `address`: 服务监听地址
- `tmpDir`: 临时下载目录
- `proxy`: 代理地址
- `proxyFallbackDirect`: 代理失败时是否回退直连
- `cookie`: Cookie 文件路径
- `thumbnailTimeout`: 封面抓取超时时间（毫秒）
- `diskCleanupThreshold`: 磁盘占用超过该百分比时自动清理 `tmp`
- `ytDlpPath`: `yt-dlp` 可执行文件路径
- `ffmpegPath`: `ffmpeg` 可执行文件路径

## 启动

```powershell
npm start
```

启动后访问：

- `http://127.0.0.1:2878`

## 常用命令

```powershell
npm run check
npm run health
```

## API

- `GET /y2b/health`：健康状态与工具可用性
- `GET /y2b/parse?url=<视频链接>`：解析视频
- `GET /y2b/download?website=y2b&v=<id>&format=<videoId>x<audioId>&transcode=0|1`：下载
- `GET /y2b/thumbnail?website=y2b&v=<id>&title=<标题>&src=<封面源>&save=1`：保存封面到视频同目录

## 文件保存规则

- 所有视频相关文件保存到 `tmp/<视频标题>/`
- 同一目录下包含：视频文件、音频文件、封面图、`info.json`
- 转码模式下会额外生成最终 `H.264 MP4` 文件
- 不再提供字幕下载

## 说明

- 当前仓库只对外强调 YouTube 流程
- 如果封面图获取失败，页面会自动切换后续候选图
