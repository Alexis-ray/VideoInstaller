## VideoInstaller v2.3.0

VideoInstaller v2.3.0 是当前推荐的 Windows 原生桌面版本，重点补齐安装模式路径配置、统一文档与图标资源，并为需要登录态的网站补充更直接的 Cookie 处理入口。

### 亮点

- 图标资源统一收口到 `assets/icons/app.ico`，并同步接入桌面程序图标、安装器图标与 legacy favicon
- 发布前可通过 `npm run release:clean` 清空旧 `release/` 与 `release-build/` 残留，避免旧版本产物混入本次上传
- 设置页支持直接调整安装模式数据目录、临时目录、下载目录、日志目录、Cookie 路径与工具路径
- 主页面新增“重新自动获取 Cookie”按钮，可在遇到登录态问题时手动再次尝试自动获取
- 桌面版解析结果页中的音频 / 视频格式列表恢复独立滚轮滚动能力
- 安装版不再把 `%LOCALAPPDATA%\VideoInstaller` 当作唯一硬编码数据位置，而是允许在安装阶段单独指定数据目录
- 仓库主页、发布说明、发布流程和桌面子目录说明统一整理为面向 GitHub 用户的说明

### 发布资产

#### 原生桌面版（主发布线）

- `VideoInstaller-v2.3.0-win-x64.zip`
- `VideoInstaller-v2.3.0-win-x64-setup.exe`

#### 浏览器兼容版（legacy 保留线）

- `legacy v2.3.0` 暂不上传正式发布资产
- 原因：当前存在“启动终端后闪退”的已知问题，需要修复后再单独发布

### 说明

- 原生桌面版仍然是当前主发布线
- `npm start` 与 `index.js + static/` 对应浏览器兼容版 / legacy 兼容线
- `release/` 与 `release-build/` 都是本地生成目录，不纳入仓库版本控制；前者用于上传 GitHub Release，后者仅用于构建中间输出
- 目录版默认使用程序目录附近的相对路径；安装版会把程序文件放到安装目录，并把配置、Cookie、日志、临时文件等写入用户可写的数据目录
- 自动获取 Cookie 功能目前仍不保证每次都成功；如果遇到登录验证、地区限制或会员内容，建议按根目录 README 中的说明手动导入 Netscape 格式 Cookie

### 验证建议

- `dotnet test "desktop-native\VideoInstaller.Desktop.sln"`
- `npm run check`
- `powershell -ExecutionPolicy Bypass -File "scripts\build-native-portable.ps1"`
- `powershell -ExecutionPolicy Bypass -File "scripts\build-native-installer.ps1"`
- `docs/release-acceptance-v2.3.0.md`
