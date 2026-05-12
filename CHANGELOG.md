# Changelog

## [v2.0.1] - 2026-05-10

原生桌面首发后的兼容性修复版本，重点收口 YouTube 解析、默认代理和发布包工具依赖问题。

### Fixed

- 将 native 默认代理改为空，避免没有本地代理的用户开箱即走 `127.0.0.1:7890` 导致 SSL/EOF 等网络异常。
- 为 native 发布包接入 Deno JavaScript 运行时，并让 `yt-dlp` 使用 `--js-runtimes` 获得更好的 YouTube 提取兼容性。
- 将 YouTube 真人验证、Cookie 缺失、JS runtime 缺失和 TLS/EOF 问题映射为更可执行的中文提示。

### Changed

- 设置页新增 JS runtime 状态、Cookie 状态和代理直连说明。
- 原生目录版和安装包版产物命名提升到 `VideoInstaller-v2.0.1-win-x64`。
- Legacy Web 线版本号同步提升到 `v2.0.1`，继续作为非主线兼容产物保留。
- 补强 `.gitignore`，覆盖本地交接清单、运行 Cookie、release-tools 子目录工具和证书/密钥类敏感文件。

### Release notes

- `README.md`、`docs/release-notes-v2.0.1.md`、打包脚本中的发布说明与产物命名同步到 `v2.0.1`。

## [v2.0.0] - 2026-05-09

首个 Windows 原生桌面发布版。项目主线从 `Node.js + Express + 浏览器 Web UI` 迁移到 `WPF + .NET 8`，主流程不再依赖浏览器界面。

### Added

- 新增 `desktop-native/` 原生桌面工程、WPF 主窗口和单元测试工程
- 新增配置、路径、Cookie、日志、工具检查、URL 识别、解析、下载、转码、封面保存、分 P、打开目录等桌面服务
- 新增原生目录版构建脚本 `scripts/build-native-portable.ps1`
- 新增原生安装包构建脚本 `scripts/build-native-installer.ps1`
- 新增原生安装器脚本 `scripts/installer-native.iss`
- 新增 `v2.0.0` 发布说明

### Changed

- README 主线切换为 Windows 原生桌面版
- 发布产物命名统一为 `VideoInstaller-v2.0.0-win-x64.zip` 和 `VideoInstaller-v2.0.0-win-x64-setup.exe`
- 安装版运行模式改为优先读取 `%LOCALAPPDATA%\VideoInstaller\config.json`
- `desktop-native` 项目版本号统一为 `2.0.0`
- 下载界面改为通过音频/视频下拉框明确选择组合格式，不再依赖表格行选中态
- 下载、转码、保存封面等结果状态统一显示在按钮附近，不再覆盖顶部解析状态
- 发布目录路径判定修复为优先识别 portable 包内容，避免误写入仓库根目录 `tmp/`
- 下载期间禁用重复触发按钮，避免并发写入同一输出目录
- 下载结果扫描按完整下载、单音频、单视频、转码模式分别识别主文件

### Compatibility

- 保留旧 `index.js`、`static/` 和 npm Web 发布脚本作为 `legacy` 代码路径
- `v2.0.0` 主发布线不再要求用户安装 Node.js，不再通过浏览器访问本地 Web UI
- Legacy Web 发布线版本号同步提升到 `v2.0.0`，并改用 `VideoInstaller-legacy-v2.0.0-win-x64` / `VideoInstaller-legacy-v2.0.0-win-x64-setup.exe` 命名

## [v1.1.2] - 2026-05-07

这是一个面向发布整理的版本，主要做了三件事：移除 blacklist 功能链、整理 GitHub 主页文档、统一 Windows 发布说明。

### Cleanup

- 删除 `blacklist.txt` 及其在运行时、配置、打包脚本中的所有引用
- 收敛发布文档结构，保留更适合 GitHub 首页的内容
- 统一版本号到 `v1.1.2`

## [v1.1.1] - 2026-04-25

这是一个以稳定性和成品化体验为重点的补丁版本，主要针对下载完成态、异常输入处理、健康检查信息和前端反馈方式进行打磨。

### Backend stability

- 为解析请求与静态文件路径处理增加更安全的 URL 解码兜底，避免异常编码导致流程直接中断
- 调整下载参数校验流程，统一校验 `website`、`v`、`p`、`format` 与 `source` 的上下文一致性
- 改进磁盘清理策略：当仍有活动下载任务时，延后 `tmp` 清理，避免清理过程影响正在进行的下载或转码
- 扩展健康检查接口，补充版本号、运行目录、Cookie 状态、任务超时与活动任务数量等信息
- 优化下载完成态结果结构，使 `video` / `audio` 字段更贴近实际落盘文件
- 调整自动打开文件夹逻辑，避免目录打开失败时误报整体下载失败

### Frontend polish

- 将解析失败、下载失败、封面保存失败和分 P 切换失败等提示由阻断式弹窗改为页面内反馈
- 优化下载中、转码中和完成态提示，让整个流程更连续、更像完整产品
- 将“单独下载”改为“仅下载此音频 / 仅下载此视频”，减少误解
- 下载完成后展示主文件、音频文件、视频文件、元数据与目录链接，便于直接查看结果
- 更新前端标题、页头和说明文案至 `v1.1.1`

### Documentation

- 重写 README 结构，使其更适合作为正式项目主页文档
- 统一项目定位、支持范围、配置说明、接口说明与验证建议
- 补充 `v1.1.1` 版本说明，明确该版本属于补丁级稳定性发布

### Release engineering

- 新增运行目录与数据目录抽象，支持 `portable` 与 `installed` 两种发布模式
- 配置文件改为外部优先读取，便于目录版与安装包版复用同一套程序文件
- 工具路径、静态资源路径、Cookie/黑名单/tmp 目录统一支持相对发布目录解析
- 增加目录版构建脚本、发布工具下载脚本和 Inno Setup 安装器脚本

## [v1.1.0] - 2026-04-21

这是项目的第二个正式版本，标志着 YouTube 与 Bilibili 双站点下载能力正式稳定发布。

### 功能范围

- 支持 YouTube 与 Bilibili 视频下载
- 支持 `b23.tv` 短链、番剧、合集、多P与分P解析
- 支持解析结果来源类型细分与分P切换
- 支持原始下载与 H.264 MP4 转码
- 支持封面保存到视频同目录
- 支持下载完成后自动打开目标目录
- 支持健康检查、代理配置和 Cookie 文件
- 更新依赖：`express` 升级至 `4.22.1`，审计问题已修复

## [v1.0.0] - 2026-04-21

这是项目的第一个正式版本，也是当前仓库的正式发布版本。
