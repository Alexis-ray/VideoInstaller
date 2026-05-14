# VideoInstaller v2.3.0 发布验收清单

本文档只记录 `v2.3.0` 发布前仍需要实际验收的项目。

## 1. 图标与发布物验收

构建前先确认以下文件已经由同一个主图标源生成：

- 主图标源：`assets/icons/app.ico`
- 桌面程序图标：`desktop-native/src/VideoInstaller.Desktop/Assets/app.ico`
- legacy favicon：`static/favicon.ico`

建议先执行：

```powershell
npm run release:clean
```

建议执行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-native-portable.ps1
powershell -ExecutionPolicy Bypass -File scripts/build-native-installer.ps1
```

必须人工确认：

1. `release/VideoInstaller-v2.3.0-win-x64/VideoInstaller.exe` 在资源管理器中显示的新图标正确。
2. `release/VideoInstaller-v2.3.0-win-x64-setup.exe` 安装器图标与桌面程序图标一致。
3. 安装后桌面快捷方式图标与开始菜单图标一致。
4. `static/favicon.ico` 与桌面程序图标保持同一视觉方案。

## 2. 旧发布物清理边界

发布前应只保留当前需要上传或复核的产物，避免旧版本干扰判断：

- `release/`：仅保留当前版本需要验收或上传的目录、zip、setup
- `release-build/`：仅保留构建过程仍需要的中间输出；验收完成后建议清空

最低要求：

1. 旧版 `v2.1.0`、`v2.2.0` 或旧 legacy 产物不要与当前版本混放后再拿去人工验收。
2. 不要把 `release-build/VideoInstaller.exe` 当成正式发布入口。
3. `legacy v2.3.0` 当前不作为正式上传资产保留。

## 3. 关键行为闭环验收

### 桌面版结果页滚轮

1. 音频列表悬停时滚轮可用。
2. 视频列表悬停时滚轮可用。
3. 内层滚动到边界后，外层页面能自然接管滚动。
4. 没有滚动穿透、闪跳或焦点错乱。

### 设置页路径编辑

1. 安装模式数据目录、临时目录、下载目录、日志目录、Cookie 路径、工具路径都能保存。
2. 保存后新任务立即使用新配置。
3. 重启应用后设置能够正确回读。
4. 错误路径、不可写路径、不可访问路径提示清晰。

### 安装模式数据目录策略

1. 安装向导写入的数据目录能被首次启动正确读取。
2. 配置、Cookie、日志、临时文件和默认下载目录确实落到选定数据目录。
3. 安装目录位于 `Program Files` 时，普通用户权限下仍能正常使用。

## 4. 文档与 GitHub 展示复核

发布前复核这些文件的版本号、路径策略和 legacy 定位是否一致：

- `README.md`
- `CHANGELOG.md`
- `desktop-native/README.md`
- `docs/release-workflow.md`
- `docs/release-notes-v2.3.0.md`
- `package.json`
- `desktop-native/src/VideoInstaller.Desktop/VideoInstaller.Desktop.csproj`
- `scripts/installer-native.iss`
- `scripts/installer.iss`
- `static/index.html`

重点检查：

1. 当前对外版本统一为 `v2.3.0`。
2. README、发布说明与更新日志已经明确：自动获取 Cookie 目前不保证每次都成功，必要时应手动导入。
3. README、发布说明与发布流程已经明确：`legacy v2.3.0` 暂不提供下载，原因是当前存在启动终端后闪退问题。
4. README 中关于 `release/`、`release-build/`、`release-tools/` 的说明与 `.gitignore` 一致，不把未入库目录当作仓库可见内容来描述。
