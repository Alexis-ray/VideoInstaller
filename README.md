# YoutubeVideoInstaller (Windows)

这是一个专为 Windows 场景整理的视频解析下载服务：

- 输入 YouTube 或 Bilibili 链接
- 选择音频/视频格式并下载
- 自动转码为 H.264 编码的 MP4
- 提供本地网页界面进行操作

## 功能概览

- 支持 YouTube、Bilibili 视频解析
- 展示可用音频流、视频流与清晰度
- 支持单独下载音频/视频或音视频合并下载
- 自动转码为 H.264 + MP4（兼容性优先）
- 支持代理、Cookie、IP 黑名单
- 提供健康检查接口 `/y2b/health`
- 支持一键下载当前可用的最高优先级封面图（走后端回退逻辑）

## Windows 环境要求

- Windows 10/11
- Node.js 18+
- `yt-dlp.exe`
- `ffmpeg.exe`

建议工具路径（可按需修改）：

- `C:/Tools/yt-dlp.exe`
- `C:/Tools/ffmpeg/bin/ffmpeg.exe`

## 安装步骤（Windows）

### 1) 克隆项目并安装依赖

```powershell
git clone https://github.com/develon2015/Youtube-dl-REST.git
cd Youtube-dl-REST
npm install
```

### 2) 安装 yt-dlp 和 ffmpeg

确认以下命令可执行：

```powershell
C:/Tools/yt-dlp.exe --version
C:/Tools/ffmpeg/bin/ffmpeg.exe -version
```

### 3) 配置 `config.json`

默认配置如下（按你的本机路径调整）：

```json
{
  "port": 2878,
  "address": "127.0.0.1",
  "blacklist": "blacklist.txt",
  "cookie": "cookies.txt",
  "disable": false,
  "proxy": "http://127.0.0.1:7987",
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
- `proxy`: yt-dlp 与封面请求使用的代理地址（可留空）
- `proxyFallbackDirect`: 代理失败时自动回退直连
- `cookie`: Cookie 文件路径（相对项目根目录）
- `thumbnailTimeout`: 封面抓取超时时间（毫秒）
- `diskCleanupThreshold`: 磁盘占用超过该百分比时自动清理 `tmp`

### 4) 启动服务

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

## API 简要

- `GET /y2b/health` 健康状态与工具可用性
- `GET /y2b/parse?url=<视频链接>` 解析视频
- `GET /y2b/download?website=y2b|bilibili&v=<id>&format=<videoId>x<audioId>` 下载
- `GET /y2b/thumbnail?website=y2b|bilibili&v=<id>&src=<封面源>&download=1` 获取/下载封面（失败时自动回退）

## 注意事项

- 当前版本不包含字幕下载功能
- 下载目录为项目下 `tmp/`
- 仅保留 Windows 说明，未提供 Linux / Docker 操作指南
- 如果封面图不能稳定显示，页面会自动轮询后续候选图；下载按钮会直接使用当前可用的封面源
