# 发布流程

本文档说明 `v2.3.0` 的发布入口、产物位置与上传建议。当前正式对外发布线为原生桌面版，legacy 兼容线保留源码但不作为本次上传资产。

## 发布线概览

### 原生桌面版（主发布线）

- 目录版脚本：`scripts/build-native-portable.ps1`
- 安装包脚本：`scripts/build-native-installer.ps1`
- npm 入口：`npm run release:native:portable` / `npm run release:native:installer`
- 最终产物位置：`release/`

预期产物：

- `VideoInstaller-v2.3.0-win-x64.zip`
- `VideoInstaller-v2.3.0-win-x64-setup.exe`

### 浏览器兼容版（legacy 保留线）

- 目录版脚本：`scripts/build-portable.ps1`
- 安装包脚本：`scripts/build-installer.ps1`
- npm 入口：`npm run release:legacy:portable` / `npm run release:legacy:installer`
- 最终产物位置：`release/`

当前状态：

- `legacy v2.3.0` 暂不上传正式发布资产
- 原因是当前存在“启动终端后闪退”的已知问题

## 共享前置条件

首次构建或发布工具发生变化时，先准备工具目录：

```powershell
npm run release:clean
npm run release:tools
```

该步骤会准备 `release-tools/` 下的运行时与下载工具。仓库只跟踪 `release-tools/manifest.json`，不跟踪实际下载得到的二进制文件。

`npm run release:clean` 会清空本地 `release/` 与 `release-build/` 中的旧产物，避免多代版本和旧图标缓存继续干扰本轮验收与 GitHub Release 取材。

图标资源的正式主源位于 `assets/icons/app.ico`。发布脚本会在构建开始前自动把该文件同步到：

- `desktop-native/src/VideoInstaller.Desktop/Assets/app.ico`
- `static/favicon.ico`

这样可以保证桌面程序图标、原生安装器图标和 legacy favicon 使用同一套受版本控制的图标源。

## 推荐发布顺序

### 仅发布原生桌面主线

```powershell
npm run release:clean
npm run release:tools
npm run release:native
```

### 需要补齐 legacy 兼容资产

```powershell
npm run release:clean
npm run release:tools
npm run release:legacy
```

> 仅在修复 legacy 启动闪退问题后再执行该链路并对外上传。

## 产物与目录约定

- `release/`：本地生成的最终发布资产目录，也是上传 GitHub Release 时的取材来源；该目录不提交到仓库
- `release-build/`：构建过程中的中间目录，不作为用户下载入口，也不提交到仓库
- `release-tools/`：外部下载的发布依赖目录
- 如果工作区中仍残留旧版 `release/` 产物，应在人工验收完成后清理或隔离，避免与当前版本混淆

## 安装版数据目录约定

- 原生安装版会把程序文件安装到系统选择的安装目录
- 安装向导会额外让用户确认“数据目录”，用于保存配置、Cookie、日志、临时文件与默认下载目录
- 如果用户没有特殊需求，保持默认的 `%LOCALAPPDATA%\VideoInstaller` 即可
- 不建议把安装版的可写数据重新指向 `Program Files` 等普通用户默认不可写的位置

## GitHub Release 上传建议

上传时优先附加 `release/` 下的最终文件：

- 原生桌面版：zip + setup.exe
- 本次 `v2.3.0` 不上传 legacy 兼容版资产

不要把目录本身直接传到 GitHub Release；目录版应先压缩成 zip 再上传。

正式上传前，建议按 `docs/release-acceptance-v2.3.0.md` 逐项确认图标、路径策略、设置页保存以及 Cookie 相关提示是否清晰。
