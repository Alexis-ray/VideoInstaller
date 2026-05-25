# VideoInstaller

一个本地运行的 YouTube / Bilibili 视频解析与下载工具，提供简洁的 Web 界面，用 `yt-dlp` + `ffmpeg` 完成解析、下载和可选转码。

当前版本以 **Node.js + Express** 为基础，代码集中在 `src/`，静态页面放在 `static/`，所有下载产物统一落到 `temp/`。

## Features

- 支持解析 **YouTube** 与 **Bilibili** 视频链接
- 支持展示可选音频 / 视频格式
- 支持下载单独音频、单独视频或音视频组合格式
- 支持下载后转码为更通用的 **H.264 MP4**
- 支持自动刷新 `cookies.txt`，方便处理需要登录状态的资源
- 所有下载产物统一输出到 `temp/`
- 本地运行，无需额外数据库

## Project Structure

```text
VideoInstaller/
├── src/                # 服务端源码
│   ├── index.js        # 应用入口与配置加载
│   ├── downloader.js   # 解析、下载、转码核心逻辑
│   └── install-tools.js# 安装/准备 yt-dlp
├── static/             # 前端页面与静态资源
├── temp/               # 下载输出目录
├── config.json         # 运行配置
├── package.json
└── cookies.txt         # 运行时 Cookie 文件（默认不提交）
```

## Requirements

- Node.js 18+
- Windows 环境下建议使用项目自动准备的 `yt-dlp.exe`
- `ffmpeg-static` 会作为依赖安装并由程序自动调用

## Quick Start

```bash
npm install
npm start
```

启动后默认访问：

```text
http://127.0.0.1:2878
```

## Configuration

项目使用根目录下的 `config.json`：

```json
{
  "port": 2878,
  "address": "127.0.0.1",
  "tmpDir": "temp",
  "cookie": "cookies.txt",
  "proxy": "http://127.0.0.1:7890"
}
```

### Common Fields

| Field                    | Description                           |
| ------------------------ | ------------------------------------- |
| `port`                 | 本地服务端口                          |
| `address`              | 服务监听地址                          |
| `tmpDir`               | 下载输出目录，当前建议保持为 `temp` |
| `cookie`               | Cookie 文件路径                       |
| `cookieAutoBrowser`    | 自动刷新 Cookie 时使用的浏览器        |
| `cookieAutoProfile`    | 自动刷新 Cookie 时使用的浏览器配置名  |
| `proxy`                | YouTube 请求可选代理                  |
| `taskTimeout.parse`    | 视频解析超时时间                      |
| `taskTimeout.download` | 下载/转码超时时间                     |

## How It Works

1. 前端提交视频链接到 `/y2b/parse`
2. 服务端调用 `yt-dlp --print-json` 解析视频信息
3. 前端展示音频 / 视频可选格式
4. 用户发起 `/y2b/download`
5. 服务端下载文件到 `temp/<视频名>/`
6. 如果启用转码，再调用 `ffmpeg` 输出 H.264 MP4

## API Overview

### `GET /y2b/parse`

解析视频信息。

Query:

- `url`: 视频链接

### `GET /y2b/download`

发起或轮询下载任务。

常见参数：

- `website`
- `v`
- `title`
- `format`
- `transcode`
- `p`（可选）
- `source`（可选）

### `POST /y2b/refresh-cookie`

尝试从浏览器刷新并写入 `cookies.txt`。

## Notes

- Bilibili 某些内容可能需要有效登录 Cookie 或更高账号权限
- YouTube 下载如果网络受限，通常需要配置代理
- `temp/`、`cookies.txt`、`.runtime-tools/` 都属于本地运行产物，默认不建议提交

## Development Notes

- 启动脚本：`npm start`
- 项目入口：`src/index.js`
- 当前前端为单页静态界面，位于 `static/index.html`
