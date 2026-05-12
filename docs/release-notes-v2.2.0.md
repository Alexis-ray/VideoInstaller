## VideoInstaller v2.2.0

VideoInstaller v2.2.0 是一次发布收口版本，重点提升安装体验、仓库文档一致性，以及格式解析阶段的可诊断性。

### Highlights

- 安装包支持在安装阶段预先设置下载目录与代理
- 解析结果页面新增诊断说明，帮助判断 Cookie、代理和站点参数是否真正参与了解析
- 仓库 README、更新日志和发布说明整体重写，更适合 GitHub 展示与发布页使用

### Release assets

#### Native desktop

- `VideoInstaller-v2.2.0-win-x64.zip`
- `VideoInstaller-v2.2.0-win-x64-setup.exe`

#### Legacy compatibility

- `VideoInstaller-legacy-v2.2.0-win-x64/`
- `VideoInstaller-legacy-v2.2.0-win-x64-setup.exe`

### Notes

- Native 桌面版仍然是当前主发布线
- `npm start` 与 `index.js + static/` 对应 legacy Web 兼容线
- `release-build/` 是构建过程中的中间输出目录，不应作为正式发布入口
- 安装版默认将用户配置保存在 `%LOCALAPPDATA%\VideoInstaller\`

### Verification

- `dotnet test "desktop-native\VideoInstaller.Desktop.sln"`
- `npm run check`
- `powershell -ExecutionPolicy Bypass -File "scripts\build-native-portable.ps1"`
- `powershell -ExecutionPolicy Bypass -File "scripts\build-native-installer.ps1"`
