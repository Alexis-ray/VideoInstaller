#ifndef MyAppName
  #define MyAppName "VideoInstaller"
#endif
#ifndef MyAppExeName
  #define MyAppExeName "VideoInstaller.exe"
#endif
#ifndef MyAppVersion
  #define MyAppVersion "2.2.0"
#endif
#ifndef MyPortableRootName
  #define MyPortableRootName "VideoInstaller-v2.2.0-win-x64"
#endif
#ifndef MyOutputBaseFilename
  #define MyOutputBaseFilename "VideoInstaller-v2.2.0-win-x64-setup"
#endif
#define MySourceRoot AddBackslash(SourcePath) + ".."
#define MyPortableRoot AddBackslash(MySourceRoot) + "release\" + MyPortableRootName

[Setup]
AppId={{A98F1A4D-3A3C-4AB1-8801-1AB2F6C0C6A4}
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
SetupIconFile={#MySourceRoot}\desktop-native\src\VideoInstaller.Desktop\Assets\app.ico

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加任务:"; Flags: unchecked

[Files]
Source: "{#MyPortableRoot}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Dirs]
Name: "{localappdata}\VideoInstaller"
Name: "{localappdata}\VideoInstaller\tmp"
Name: "{localappdata}\VideoInstaller\downloads"
Name: "{localappdata}\VideoInstaller\logs"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--installed"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--installed"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Parameters: "--installed"; Description: "启动 {#MyAppName}"; Flags: nowait postinstall skipifsilent

[Code]
var
  DownloadDirPage: TInputDirWizardPage;
  ProxyPage: TInputQueryWizardPage;

function GetInstalledDataRoot: string;
begin
  Result := ExpandConstant('{localappdata}\VideoInstaller');
end;

function GetDefaultDownloadDir: string;
begin
  Result := AddBackslash(GetInstalledDataRoot) + 'downloads';
end;

function GetConfigPath: string;
begin
  Result := AddBackslash(GetInstalledDataRoot) + 'config.json';
end;

function GetCookiePath: string;
begin
  Result := AddBackslash(GetInstalledDataRoot) + 'cookies.txt';
end;

function EscapeJson(Value: string): string;
var
  I: Integer;
  Ch: Char;
begin
  Result := '';
  for I := 1 to Length(Value) do
  begin
    Ch := Value[I];
    if Ch = '\\' then
      Result := Result + '\\\\'
    else if Ch = '"' then
      Result := Result + '\\"'
    else if Ord(Ch) = 8 then
      Result := Result + '\\b'
    else if Ord(Ch) = 9 then
      Result := Result + '\\t'
    else if Ord(Ch) = 10 then
      Result := Result + '\\n'
    else if Ord(Ch) = 12 then
      Result := Result + '\\f'
    else if Ord(Ch) = 13 then
      Result := Result + '\\r'
    else
      Result := Result + Ch;
  end;
end;

function NormalizePath(Value: string): string;
begin
  Result := Trim(Value);
  StringChangeEx(Result, '/', '\\', True);
end;

function ValidateWriteableDirectory(PathValue: string; var ErrorMessage: string): Boolean;
var
  FullPath: string;
  ProbePath: string;
begin
  Result := False;
  FullPath := NormalizePath(PathValue);

  if FullPath = '' then
  begin
    ErrorMessage := '下载目录不能为空。';
    exit;
  end;

  try
    FullPath := ExpandFileName(FullPath);
  except
    ErrorMessage := '下载目录格式无效，请输入可访问的 Windows 路径。';
    exit;
  end;

  try
    if not DirExists(FullPath) then
      if not ForceDirectories(FullPath) then
      begin
        ErrorMessage := '无法创建下载目录，请检查路径是否有效以及当前用户是否有权限写入。';
        exit;
      end;

    ProbePath := AddBackslash(FullPath) + '.write-test.tmp';
    if FileExists(ProbePath) then
      DeleteFile(ProbePath);
    if not SaveStringToFile(ProbePath, 'ok', False) then
    begin
      ErrorMessage := '下载目录不可写，请改用当前用户可写的位置。';
      exit;
    end;
    DeleteFile(ProbePath);
  except
    ErrorMessage := '下载目录不可用，请确认该目录存在或可由安装器创建，并且当前用户拥有写权限。';
    exit;
  end;

  Result := True;
end;

function ValidateProxy(Value: string; var ErrorMessage: string): Boolean;
var
  LowerValue: string;
begin
  Result := True;
  LowerValue := Lowercase(Trim(Value));
  if LowerValue = '' then
    exit;

  if (Pos('http://', LowerValue) <> 1) and (Pos('https://', LowerValue) <> 1) and (Pos('socks5://', LowerValue) <> 1) then
  begin
    ErrorMessage := '代理地址必须以 http://、https:// 或 socks5:// 开头；留空表示直连。';
    Result := False;
    exit;
  end;

  if Pos('://', LowerValue) = Length(LowerValue) - 2 then
  begin
    ErrorMessage := '代理地址缺少主机名或端口，请检查输入。';
    Result := False;
  end;
end;

procedure InitializeWizard;
begin
  DownloadDirPage := CreateInputDirPage(
    wpSelectDir,
    '下载目录设置',
    '请选择下载成品保存目录',
    'Native 安装版默认把程序安装到 Program Files，而下载成品建议保存在当前用户可写目录。默认值为 %LOCALAPPDATA%\VideoInstaller\downloads。',
    False,
    '');
  DownloadDirPage.Add('下载目录:');
  DownloadDirPage.Values[0] := GetDefaultDownloadDir;

  ProxyPage := CreateInputQueryPage(
    DownloadDirPage.ID,
    '代理设置',
    '可选：配置解析 / 下载代理',
    '默认预填本地代理 http://127.0.0.1:7890；如果你的网络环境不需要代理，可以清空该字段并直接下一步。升级安装时若已有 config.json，安装器会保留原配置，不会用这里的默认值覆盖。');
  ProxyPage.Add('代理地址:', False);
  ProxyPage.Values[0] := 'http://127.0.0.1:7890';
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  ErrorMessage: string;
begin
  Result := True;

  if CurPageID = DownloadDirPage.ID then
  begin
    if not ValidateWriteableDirectory(DownloadDirPage.Values[0], ErrorMessage) then
    begin
      MsgBox(ErrorMessage, mbError, MB_OK);
      Result := False;
      exit;
    end;

    DownloadDirPage.Values[0] := ExpandFileName(NormalizePath(DownloadDirPage.Values[0]));
  end;

  if CurPageID = ProxyPage.ID then
  begin
    if not ValidateProxy(ProxyPage.Values[0], ErrorMessage) then
    begin
      MsgBox(ErrorMessage, mbError, MB_OK);
      Result := False;
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ConfigPath: string;
  CookiePath: string;
  ConfigText: AnsiString;
  DownloadDir: string;
  ProxyValue: string;
begin
  if CurStep <> ssPostInstall then
    exit;

  ConfigPath := GetConfigPath;
  CookiePath := GetCookiePath;
  DownloadDir := ExpandFileName(NormalizePath(DownloadDirPage.Values[0]));
  ProxyValue := Trim(ProxyPage.Values[0]);

  if not FileExists(ConfigPath) then
  begin
    ConfigText := '{'#13#10 +
      '  "runtimeMode": "installed",'#13#10 +
      '  "tmpDir": "tmp",'#13#10 +
      '  "downloadDir": "' + EscapeJson(DownloadDir) + '",'#13#10 +
      '  "cookie": "cookies.txt",'#13#10 +
      '  "proxy": "' + EscapeJson(ProxyValue) + '",'#13#10 +
      '  "proxyFallbackDirect": true,'#13#10 +
      '  "ytDlpPath": "tools/yt-dlp.exe",'#13#10 +
      '  "ffmpegPath": "tools/ffmpeg.exe",'#13#10 +
      '  "jsRuntimePath": "tools/js-runtime/deno.exe",'#13#10 +
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
    SaveStringToFile(CookiePath, '# Netscape HTTP Cookie File'#13#10'# Replace this file with exported browser cookies if needed.'#13#10, False);
end;
