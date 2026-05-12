# Release Workflow

本文档收口当前仓库的发布入口、产物位置和推荐操作顺序，避免 native 与 legacy 两条发布线继续漂移。

## 发布线概览

### Native desktop（主发布线）

- 目录版脚本：`scripts/build-native-portable.ps1`
- 安装包脚本：`scripts/build-native-installer.ps1`
- npm 入口：`npm run release:native:portable` / `npm run release:native:installer`
- 最终产物位置：`release/`

预期产物：

- `VideoInstaller-v2.2.0-win-x64.zip`
- `VideoInstaller-v2.2.0-win-x64-setup.exe`

### Legacy Web compatibility（兼容保留线）

- 目录版脚本：`scripts/build-portable.ps1`
- 安装包脚本：`scripts/build-installer.ps1`
- npm 入口：`npm run release:legacy:portable` / `npm run release:legacy:installer`
- 最终产物位置：`release/`

预期产物：

- `VideoInstaller-legacy-v2.2.0-win-x64.zip`
- `VideoInstaller-legacy-v2.2.0-win-x64-setup.exe`

## 共享前置条件

首次构建或发布工具发生变化时，先准备工具目录：

```powershell
npm run release:tools
```

该步骤会准备 `release-tools/` 下的运行时与下载工具。仓库只跟踪 `release-tools/manifest.json`，不跟踪实际下载得到的二进制文件。

## 推荐发布顺序

### 仅发布 native 主线

```powershell
npm run release:tools
npm run release:native
```

### 需要补齐 legacy 兼容资产

```powershell
npm run release:tools
npm run release:legacy
```

## 产物与目录约定

- `release/`：最终面向用户的发布资产目录，也是上传 GitHub Release 的来源
- `release-build/`：构建过程中的中间目录，不作为用户下载入口
- `release-tools/`：外部下载的发布依赖目录

## GitHub Release 上传建议

上传时优先附加 `release/` 下的最终文件：

- Native：zip + setup.exe
- Legacy：zip + setup.exe

不要把目录本身直接传到 GitHub Release；目录版应先压缩成 zip 再上传。
