#ifndef MyAppName
  #define MyAppName "VideoInstaller"
#endif
#ifndef MyAppExeName
  #define MyAppExeName "VideoInstaller.exe"
#endif
#ifndef MyAppVersion
  #define MyAppVersion "2.3.0"
#endif
#ifndef MyPortableRootName
  #define MyPortableRootName "VideoInstaller-legacy-v2.3.0-win-x64"
#endif
#ifndef MyOutputBaseFilename
  #define MyOutputBaseFilename "VideoInstaller-legacy-v2.3.0-win-x64-setup"
#endif
#define MySourceRoot ".."
#define MyPortableRoot AddBackslash(MySourceRoot) + "release\" + MyPortableRootName

[Setup]
AppId={{9A6C4D3A-64D8-48AB-8625-ED28B3D2E0ED}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher=Alexis-ray
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir={#MySourceRoot}\release
OutputBaseFilename={#MyOutputBaseFilename}
Compression=lzma
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\{#MyAppExeName}
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
SetupIconFile={#MySourceRoot}\static\favicon.ico

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加任务:"; Flags: unchecked

[Files]
Source: "{#MyPortableRoot}\VideoInstaller.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MyPortableRoot}\release-manifest.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MyPortableRoot}\static\*"; DestDir: "{app}\static"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#MyPortableRoot}\tools\*"; DestDir: "{app}\tools"; Flags: ignoreversion recursesubdirs createallsubdirs

[Dirs]
Name: "{localappdata}\VideoInstaller"
Name: "{localappdata}\VideoInstaller\tmp"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--installed"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--installed"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Parameters: "--installed"; Description: "启动 {#MyAppName}"; Flags: nowait postinstall skipifsilent

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
var
  ConfigPath: string;
  CookiePath: string;
  ConfigText: AnsiString;
begin
  if CurStep <> ssPostInstall then
    exit;

  ConfigPath := ExpandConstant('{localappdata}\VideoInstaller\config.json');
  CookiePath := ExpandConstant('{localappdata}\VideoInstaller\cookies.txt');
  if not FileExists(ConfigPath) then
  begin
    ConfigText := '{'#13#10 +
      '  "port": 2878,'#13#10 +
      '  "address": "127.0.0.1",'#13#10 +
      '  "runtimeMode": "installed",'#13#10 +
      '  "tmpDir": "tmp",'#13#10 +
      '  "cookie": "cookies.txt",'#13#10 +
      '  "disable": false,'#13#10 +
      '  "proxy": "",'#13#10 +
      '  "proxyFallbackDirect": true,'#13#10 +
      '  "ytDlpPath": "tools/yt-dlp.exe",'#13#10 +
      '  "ffmpegPath": "tools/ffmpeg.exe",'#13#10 +
      '  "thumbnailTimeout": 8000,'#13#10 +
      '  "taskTimeout": {'#13#10 +
      '    "parse": 60000,'#13#10 +
      '    "download": 3600000'#13#10 +
      '  },'#13#10 +
      '  "diskCleanupThreshold": 90'#13#10 +
      '}'#13#10;
    SaveStringToFile(ConfigPath, ConfigText, False);
  end;

  if not FileExists(CookiePath) then
    SaveStringToFile(CookiePath, '# Netscape HTTP Cookie File'#13#10, False);

end;
