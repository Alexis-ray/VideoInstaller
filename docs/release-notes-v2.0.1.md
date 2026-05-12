# VideoInstaller v2.0.1

原生桌面首发后的兼容性修复版。

## Highlights

- 默认代理改为空，未配置代理时直接访问网络
- 发布包补齐 Deno JavaScript 运行时，供 `yt-dlp` 解析 YouTube 使用
- YouTube 真人验证、Cookie 缺失、JS runtime 缺失和 TLS/EOF 问题改为更可执行的提示
- 设置页补充 JS runtime、Cookie 和代理状态展示

## Release assets

- Main release:
  - `VideoInstaller-v2.0.1-win-x64.zip`
  - `VideoInstaller-v2.0.1-win-x64-setup.exe`
- Compatibility assets:
  - `VideoInstaller-legacy-v2.0.1-win-x64/`
  - `VideoInstaller-legacy-v2.0.1-win-x64-setup.exe`

## Automated verification

- `dotnet test "desktop-native\\VideoInstaller.Desktop.sln"`
- `dotnet build "desktop-native\\VideoInstaller.Desktop.sln" -c Release`
- `npm run check`
- `powershell -ExecutionPolicy Bypass -File "scripts\\build-native-portable.ps1"`
- `powershell -ExecutionPolicy Bypass -File "scripts\\build-native-installer.ps1"`
- `powershell -ExecutionPolicy Bypass -File "scripts\\build-portable.ps1"`
- `powershell -ExecutionPolicy Bypass -File "scripts\\build-installer.ps1"`

## Notes

- Native 桌面版是当前主发布线
- Legacy Web 线继续作为兼容产物保留
- Native 发布包内包含 Deno JavaScript 运行时；Legacy Web 线不依赖该保障项
- 跨机器复测、真实下载、安装/卸载和站点人工验收仍需按发布清单继续完成
