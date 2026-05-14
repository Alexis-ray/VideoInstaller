# VideoInstaller

适用于 Windows 的本地视频下载器，支持 YouTube 与 Bilibili 链接解析、格式选择和本地下载。

[更新日志](CHANGELOG.md) · [v2.3.0 发布说明](docs/release-notes-v2.3.0.md) · [下载与使用说明](docs/release-workflow.md)

## 当前版本

当前推荐版本：`v2.3.0`

### 可下载版本

- `VideoInstaller-v2.3.0-win-x64.zip`
- `VideoInstaller-v2.3.0-win-x64-setup.exe`

### 当前不提供的版本

- `legacy v2.3.0` 暂不提供下载。
- 原因是该线路目前存在启动后闪退的已知问题，不适合作为正式发布版本提供给普通用户。

## 功能概览

- 原生 Windows 桌面界面，不依赖浏览器界面、不使用 Electron、不使用 WebView
- 支持 YouTube、YouTube Shorts、`youtu.be`、Bilibili 普通视频、多 P、番剧和短链
- 支持在下载前分别选择音频与视频格式
- 支持原始格式下载，或下载后转码为 H.264 MP4
- 支持封面保存、下载目录管理、代理配置、Cookie 导入与工具健康检查
- 安装版支持首次安装时设置数据保存位置与下载目录

## 运行要求

- Windows 10 / 11 x64
- 下载包已经附带所需运行组件，通常不需要额外安装 Node.js 或 .NET Runtime

## 快速开始

1. 下载并打开 `VideoInstaller.exe`
2. 粘贴 YouTube 或 Bilibili 链接
3. 等待解析完成后选择音频和视频格式
4. 选择原始下载或转码下载
5. 下载完成后按需打开输出目录或保存封面

## Cookie 使用说明

- 遇到 YouTube 登录验证、地区限制或 Bilibili 会员内容时，可以导入已登录浏览器导出的 Cookie
- Cookie 文件需要使用 Netscape 格式

### 关于“自动获取 Cookie”

- `v2.3.0` 已提供“重新自动获取 Cookie”入口，便于在遇到登录态问题时重新尝试。
- 该功能仍然依赖本机浏览器登录态与提取能力，因此**并不能保证每次都成功**。
- 如果自动获取失败，最稳定的方式仍然是手动导入浏览器导出的 Netscape 格式 Cookie。

### 手动导入浏览器 Cookie

1. 在常用浏览器中安装支持导出 Netscape Cookie 的扩展，或使用你信任的导出方式。
2. 在目标站点完成登录后，仅导出对应站点的 Cookie，并保存为 Netscape 格式文本文件。
3. 打开 VideoInstaller 设置页，将“Cookie 路径”指向该文件。
4. 重新执行解析或下载，确认登录验证、地区限制或会员内容已恢复可用。

注意事项：

- 不要把 Cookie 文件公开发送给他人。
- 如果浏览器导出的文件不是 Netscape 格式，需要先转换后再导入。
- Cookie 失效后重新导出即可，通常不需要改动其他设置。

## 已知事项

- 自动获取 Cookie 目前属于 best-effort 能力，不保证每次都成功。
- `legacy v2.3.0` 暂不提供下载，后续会在问题修复后再单独发布。

## 更多说明

如果你需要查看当前版本的变更与下载说明，可以继续阅读：

- [v2.3.0 发布说明](docs/release-notes-v2.3.0.md)
- [下载与使用说明](docs/release-workflow.md)
- [使用前检查建议](docs/release-acceptance-v2.3.0.md)
