# VideoInstaller

VideoInstaller 是一个本地网页视频下载工具，用浏览器界面解析、下载和整理 YouTube 与 Bilibili 视频资源。

## 功能特性

- 解析 YouTube 与 Bilibili 链接
- 列出可用音频、视频和组合格式
- 下载单独音频、单独视频或音视频组合
- 可选转码为 H.264 MP4
- 下载视频封面
- 导入 Netscape/Mozilla 格式 `cookies.txt`
- 下载结果保存到 `temp/`

## 运行要求

- Node.js 18 或更高版本
- Windows 环境体验最佳
- 首次安装会自动下载 Windows 版 `yt-dlp`

## 快速开始

```bash
npm install
npm start
```

默认访问地址：

```text
http://127.0.0.1:2878
```

启动后会自动打开浏览器。如果没有自动打开，可以手动访问上面的地址。

## 使用方法

1. 粘贴 YouTube 或 Bilibili 视频链接
2. 点击“解析”
3. 选择需要的音频或视频格式
4. 点击下载按钮
5. 下载完成后从页面链接打开文件或目录

## 配置

运行配置在 `config.json`：

```json
{
  "port": 2878,
  "address": "127.0.0.1",
  "tmpDir": "temp",
  "cookie": "cookies.txt",
  "proxy": ""
}
```

常用配置：

- `port`：本地服务端口
- `address`：监听地址，建议保持 `127.0.0.1`
- `tmpDir`：下载输出目录
- `cookie`：导入后的 Cookie 文件路径
- `proxy`：访问 YouTube 时使用的代理，例如 `http://127.0.0.1:7890`

## Cookie 导入

部分视频需要登录态。请从浏览器导出 Netscape/Mozilla 格式 `cookies.txt`，再在页面中导入。

推荐流程：

1. 在 Edge 中安装可信的 Cookie 导出扩展
2. 登录目标站点
3. 只导出目标站点 Cookie，例如 YouTube 只导出 `youtube.com`
4. 在页面展开“导入 Edge 导出的 cookies.txt”
5. 选择 `.txt` 文件或粘贴文件内容
6. 点击“导入 Cookie”

Cookie 是账号凭证。不要分享、上传或提交到仓库。

## 目录说明

```text
src/              后端服务和下载逻辑
static/           前端页面
config.json       运行配置
temp/             下载输出，默认不提交
cookies.txt       本地 Cookie 文件，默认不提交
.runtime-tools/   自动下载的运行工具，默认不提交
```

## 注意事项

- 请遵守目标平台服务条款、版权要求和当地法律法规
- 某些视频可能受账号权限、地区、网络环境或平台策略影响
- 如果浏览器使用代理登录，`config.json` 中的 `proxy` 建议使用相同出口
- 本项目默认用于本机自用，不建议暴露到公网或局域网
