# VideoInstaller

VideoInstaller 是一个面向本地使用场景的网页视频下载工具，提供简洁的浏览器界面来解析、下载并整理 YouTube 与 Bilibili 视频资源。项目当前基于 **Node.js + Express**，通过 `yt-dlp` 完成媒体解析与下载，并在需要时借助 `ffmpeg` 进行处理。

## 功能概览

- 支持解析 **YouTube** 与 **Bilibili** 视频链接
- 支持查看可用音频、视频与组合格式
- 支持下载音频、视频，或音视频组合格式
- 支持下载视频封面
- 支持从浏览器刷新 `cookies.txt`，便于访问依赖登录态的内容
- 所有下载产物统一输出到 `temp/`
- 本地运行，无需数据库或额外后端服务

## 当前状态

这个项目更适合：

- 在本机浏览器里直接使用
- 希望从源码运行并自行调整配置
- 需要一个便于二次开发的轻量级 Node 项目

## 已知问题

- **转码功能当前不可用。** 目前选择转码后，得到的 `.mp4` 文件实际仍然只是音频文件，而不是预期的视频文件。这个问题已知，后续再修复；当前请不要将转码结果视为可用的视频输出。

## 技术栈

- Node.js
- Express
- yt-dlp
- ffmpeg-static
- 原生 HTML / CSS / JavaScript 前端页面

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

默认情况下，服务会监听：

```text
http://127.0.0.1:2878
```

启动后可以直接在浏览器中打开该地址进行操作。

## 运行要求

- Node.js 18 及以上版本
- 需要可用的 `yt-dlp`
- 项目依赖 `ffmpeg-static`，用于媒体处理

> 当前仓库内置的 `yt-dlp` 自动准备流程主要面向 Windows 环境。如果你在其他平台运行，建议先确认本机的媒体工具准备方式是否符合你的使用场景。

## 配置说明

项目使用根目录下的 `config.json` 作为运行配置。常见配置项如下：

| 字段 | 说明 |
| --- | --- |
| `port` | Web 服务端口 |
| `address` | 服务监听地址 |
| `tmpDir` | 下载输出目录 |
| `cookie` | Cookie 文件路径 |
| `cookieAutoBrowser` | 自动刷新 Cookie 时使用的浏览器 |
| `cookieAutoProfile` | 自动刷新 Cookie 时使用的浏览器配置名 |
| `cookieAutoProfilePath` | 自动刷新 Cookie 时使用的浏览器 profile 路径 |
| `proxy` | 访问外部站点时使用的可选代理 |
| `thumbnailTimeout` | 下载封面的单次请求超时时间 |
| `thumbnailRetryCount` | 封面下载失败后的额外重试次数 |
| `taskTimeout.parse` | 解析任务超时时间 |
| `taskTimeout.download` | 下载任务超时时间 |

一个便于理解的最小化示例如下：

```json
{
  "port": 2878,
  "address": "127.0.0.1",
  "tmpDir": "temp",
  "cookie": "cookies.txt",
  "proxy": ""
}
```

如果你所在的网络环境需要代理访问外部站点，可以在 `proxy` 中填写代理地址。

## 使用流程

1. 启动服务并打开首页
2. 输入 YouTube 或 Bilibili 视频链接
3. 等待服务端解析视频信息与可用格式
4. 选择要下载的格式
5. 视需要开启转码
6. 下载结果会保存到 `temp/` 目录，并通过页面返回访问路径

## 对外接口

当前服务端主要提供以下接口：

- `GET /y2b/parse`：解析视频信息
- `GET /y2b/download`：发起或轮询下载任务
- `GET /y2b/download-cover`：下载视频封面
- `POST /y2b/refresh-cookie`：刷新 Cookie 文件

这意味着你既可以直接使用自带页面，也可以基于这些接口接入自己的前端。

## 项目结构

```text
VideoInstaller/
├── src/                 # 服务端源码
│   ├── index.js         # 应用入口与配置加载
│   ├── downloader.js    # 解析、下载、封面与 Cookie 核心逻辑
│   └── install-tools.js # 运行前工具准备
├── static/              # 前端页面与静态资源
├── temp/                # 下载输出目录（运行时生成）
├── config.json          # 运行配置
├── package.json
└── README.md
```

## 已知限制

- 某些站点资源可能依赖有效 Cookie、地区网络条件或账号权限
- 受上游站点策略影响，解析与下载稳定性可能随时间变化
- 当前默认体验更偏向本地自用和源码运行，而不是面向生产部署

## 开发入口

如果你打算继续扩展这个项目，建议优先查看以下模块：

- `src/index.js`：路由与运行时配置入口
- `src/downloader.js`：下载、封面、Cookie 刷新等核心逻辑
- `static/index.html`：用户界面

## 免责声明

请仅在遵守目标平台服务条款、版权要求和当地法律法规的前提下使用本项目。你应自行判断是否有权下载、保存或分发相关内容。
