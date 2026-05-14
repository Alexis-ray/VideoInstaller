using System.Diagnostics;
using System.IO;
using System.Windows;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Microsoft.Win32;
using VideoInstaller.Desktop.Models;
using VideoInstaller.Desktop.Services;

namespace VideoInstaller.Desktop.ViewModels;

public partial class SettingsViewModel : ObservableObject
{
    private readonly AppConfig _config;
    private readonly RuntimePaths _paths;
    private readonly ConfigService _configService;
    private readonly string _defaultInstalledDataRoot;

    public SettingsViewModel(AppConfig config, RuntimePaths paths, HealthStatus healthStatus, ConfigService configService)
    {
        _config = config;
        _paths = paths;
        _configService = configService;
        _defaultInstalledDataRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "VideoInstaller");
        HealthStatus = healthStatus;

        InstalledDataRoot = config.InstalledDataRoot;
        TmpDirInput = config.TmpDir;
        DownloadDir = config.DownloadDir;
        LogsDirInput = config.LogsDir;
        CookiePathInput = config.Cookie;
        YtDlpPathInput = config.YtDlpPath;
        FfmpegPathInput = config.FfmpegPath;
        JsRuntimePathInput = config.JsRuntimePath;
        Proxy = config.Proxy;
        ProxyFallbackDirect = config.ProxyFallbackDirect;
        StatusMessage = "设置已加载。";
        StatusKind = "info";
    }

    public HealthStatus HealthStatus { get; }

    public string RuntimeMode => _paths.RuntimeMode;

    public string AppVersion => string.IsNullOrWhiteSpace(HealthStatus.AppVersion) ? "unknown" : HealthStatus.AppVersion;

    public string ConfigPath => _paths.ConfigPath;

    public string CookiePath => _paths.CookiePath;

    public string TmpDir => _paths.TmpDir;

    public string DownloadDirCurrent => _paths.DownloadDir;

    public string LogsDir => _paths.LogsDir;

    public string YtDlpPath => _paths.YtDlpPath;

    public string YtDlpVersion => FormatToolStatus(HealthStatus.YtDlp);

    public string FfmpegPath => _paths.FfmpegPath;

    public string FfmpegVersion => FormatToolStatus(HealthStatus.Ffmpeg);

    public string JsRuntimePath => _paths.JsRuntimePath;

    public string JsRuntimeVersion => FormatToolStatus(HealthStatus.JsRuntime);

    public string CookieStatus => BuildCookieStatus();

    public string ProxySummary => BuildProxySummary();

    public string DataRootDir => _paths.DataRootDir;

    public string GithubText => "https://github.com/Alexis-ray/VideoInstaller";

    [ObservableProperty]
    private string installedDataRoot = string.Empty;

    [ObservableProperty]
    private string tmpDirInput = string.Empty;

    [ObservableProperty]
    private string downloadDir = string.Empty;

    [ObservableProperty]
    private string logsDirInput = string.Empty;

    [ObservableProperty]
    private string cookiePathInput = string.Empty;

    [ObservableProperty]
    private string ytDlpPathInput = string.Empty;

    [ObservableProperty]
    private string ffmpegPathInput = string.Empty;

    [ObservableProperty]
    private string jsRuntimePathInput = string.Empty;

    [ObservableProperty]
    private string proxy = string.Empty;

    [ObservableProperty]
    private bool proxyFallbackDirect;

    [ObservableProperty]
    private string statusMessage = string.Empty;

    [ObservableProperty]
    private string statusKind = "info";

    public string StatusBrush => StatusKind switch
    {
        "success" => "#1D5F2A",
        "error" => "#9F1D1D",
        _ => "#194B80"
    };

    [RelayCommand]
    private void BrowseInstalledDataRoot() => BrowseFolder(path => InstalledDataRoot = path, "请选择安装模式数据目录", InstalledDataRoot);

    [RelayCommand]
    private void BrowseTmpDir() => BrowseFolder(path => TmpDirInput = path, "请选择临时目录", TmpDirInput);

    [RelayCommand]
    private void BrowseDownloadDir() => BrowseFolder(path => DownloadDir = path, "请选择下载目录", DownloadDir);

    [RelayCommand]
    private void BrowseLogsDir() => BrowseFolder(path => LogsDirInput = path, "请选择日志目录", LogsDirInput);

    [RelayCommand]
    private void BrowseCookiePath() => BrowseSaveFile(path => CookiePathInput = path, "请选择 Cookie 文件路径", CookiePathInput, "Text files (*.txt)|*.txt|All files (*.*)|*.*");

    [RelayCommand]
    private void BrowseYtDlpPath() => BrowseOpenFile(path => YtDlpPathInput = path, "请选择 yt-dlp 可执行文件", YtDlpPathInput, "Executable files (*.exe)|*.exe|All files (*.*)|*.*");

    [RelayCommand]
    private void BrowseFfmpegPath() => BrowseOpenFile(path => FfmpegPathInput = path, "请选择 ffmpeg 可执行文件", FfmpegPathInput, "Executable files (*.exe)|*.exe|All files (*.*)|*.*");

    [RelayCommand]
    private void BrowseJsRuntimePath() => BrowseOpenFile(path => JsRuntimePathInput = path, "请选择 JavaScript 运行时可执行文件", JsRuntimePathInput, "Executable files (*.exe)|*.exe|All files (*.*)|*.*");

    [RelayCommand]
    private void RestoreInstalledDataRootDefault()
    {
        InstalledDataRoot = _defaultInstalledDataRoot;
    }

    [RelayCommand]
    private void RestoreToolPathsDefault()
    {
        YtDlpPathInput = "tools/yt-dlp.exe";
        FfmpegPathInput = "tools/ffmpeg.exe";
        JsRuntimePathInput = "tools/js-runtime/deno.exe";
    }

    [RelayCommand]
    private void SaveSettings()
    {
        var effectiveDataRoot = RuntimeMode == "installed" ? InstalledDataRoot : _paths.DataRootDir;
        var normalizedDataRoot = ValidateDirectoryPath(effectiveDataRoot, "安装模式数据目录", RuntimeMode != "installed");
        if (normalizedDataRoot is null)
        {
            return;
        }

        var dataRootForRelativePaths = string.IsNullOrWhiteSpace(normalizedDataRoot) ? _paths.DataRootDir : normalizedDataRoot;
        var normalizedTmpDir = ValidateFlexiblePath(TmpDirInput, "临时目录", false, dataRootForRelativePaths, false);
        if (normalizedTmpDir is null)
        {
            return;
        }

        var normalizedDownloadDir = ValidateFlexiblePath(DownloadDir, "下载目录", false, dataRootForRelativePaths, true);
        if (normalizedDownloadDir is null)
        {
            return;
        }

        var normalizedLogsDir = ValidateFlexiblePath(LogsDirInput, "日志目录", false, dataRootForRelativePaths, false);
        if (normalizedLogsDir is null)
        {
            return;
        }

        var normalizedCookiePath = ValidateFlexiblePath(CookiePathInput, "Cookie 文件路径", true, dataRootForRelativePaths, false);
        if (normalizedCookiePath is null)
        {
            return;
        }

        var normalizedYtDlpPath = ValidateFlexiblePath(YtDlpPathInput, "yt-dlp 路径", true, _paths.AppRootDir, false);
        if (normalizedYtDlpPath is null)
        {
            return;
        }

        var normalizedFfmpegPath = ValidateFlexiblePath(FfmpegPathInput, "ffmpeg 路径", true, _paths.AppRootDir, false);
        if (normalizedFfmpegPath is null)
        {
            return;
        }

        var normalizedJsRuntimePath = ValidateFlexiblePath(JsRuntimePathInput, "JavaScript 运行时路径", true, _paths.AppRootDir, false);
        if (normalizedJsRuntimePath is null)
        {
            return;
        }

        var proxyValidationMessage = ValidateProxy(Proxy);
        if (proxyValidationMessage is not null)
        {
            SetStatus("error", proxyValidationMessage);
            return;
        }

        _config.InstalledDataRoot = RuntimeMode == "installed" ? normalizedDataRoot : _config.InstalledDataRoot;
        _config.TmpDir = normalizedTmpDir;
        _config.DownloadDir = normalizedDownloadDir;
        _config.LogsDir = normalizedLogsDir;
        _config.Cookie = normalizedCookiePath;
        _config.YtDlpPath = normalizedYtDlpPath;
        _config.FfmpegPath = normalizedFfmpegPath;
        _config.JsRuntimePath = normalizedJsRuntimePath;
        _config.Proxy = Proxy.Trim();
        _config.ProxyFallbackDirect = ProxyFallbackDirect;
        _configService.Save(_paths, _config);
        OnPropertyChanged(nameof(ProxySummary));
        SetStatus("success", "设置已保存。新的解析、下载和工具检测会使用更新后的路径与代理配置。部分运行信息在重启应用后会完全刷新。");
    }

    [RelayCommand]
    private void OpenDataDirectory()
    {
        OpenDirectory(_paths.DataRootDir, "数据目录");
    }

    [RelayCommand]
    private void OpenLogsDirectory()
    {
        OpenDirectory(_paths.LogsDir, "日志目录");
    }

    [RelayCommand]
    private void CopyGithub()
    {
        Clipboard.SetText(GithubText);
        SetStatus("success", "GitHub 链接已复制到剪贴板。");
    }

    private void BrowseFolder(Action<string> assign, string title, string currentValue)
    {
        var dialog = new OpenFolderDialog
        {
            Title = title,
            InitialDirectory = ResolveInitialBrowsePath(currentValue),
            Multiselect = false
        };

        if (dialog.ShowDialog() == true)
        {
            assign(dialog.FolderName);
        }
    }

    private void BrowseOpenFile(Action<string> assign, string title, string currentValue, string filter)
    {
        var dialog = new OpenFileDialog
        {
            Title = title,
            Filter = filter,
            CheckFileExists = false,
            InitialDirectory = ResolveInitialBrowsePath(currentValue),
            FileName = TryGetFileName(currentValue)
        };

        if (dialog.ShowDialog() == true)
        {
            assign(dialog.FileName);
        }
    }

    private void BrowseSaveFile(Action<string> assign, string title, string currentValue, string filter)
    {
        var dialog = new SaveFileDialog
        {
            Title = title,
            Filter = filter,
            InitialDirectory = ResolveInitialBrowsePath(currentValue),
            FileName = TryGetFileName(currentValue)
        };

        if (dialog.ShowDialog() == true)
        {
            assign(dialog.FileName);
        }
    }

    private void OpenDirectory(string path, string name)
    {
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = path,
                UseShellExecute = true
            });
            SetStatus("success", $"已打开{name}。");
        }
        catch (Exception ex)
        {
            SetStatus("error", $"无法打开{name}：{ex.Message}");
        }
    }

    private void SetStatus(string kind, string message)
    {
        StatusKind = kind;
        StatusMessage = message;
        OnPropertyChanged(nameof(StatusBrush));
    }

    private string BuildCookieStatus()
    {
        if (!HealthStatus.CookieExists)
        {
            return "Cookie 文件不存在，程序会在需要时自动创建空模板。";
        }

        if (!HealthStatus.CookieReadable)
        {
            return "Cookie 文件当前无法读取，请检查文件占用、权限或内容编码。";
        }

        return HealthStatus.CookieHasContent
            ? "Cookie 文件已有内容。"
            : "Cookie 文件目前为空模板。遇到 YouTube 登录验证、会员内容或区域限制时，请替换为浏览器导出的 Netscape 格式 Cookie。";
    }

    private string BuildProxySummary()
    {
        var currentProxy = Proxy.Trim();
        return string.IsNullOrWhiteSpace(currentProxy)
            ? "未配置代理，YouTube 将直连访问。"
            : $"代理：{currentProxy}，失败回退直连：{(ProxyFallbackDirect ? "启用" : "禁用")}";
    }

    private string ResolveInitialBrowsePath(string? currentValue)
    {
        var candidate = string.IsNullOrWhiteSpace(currentValue) ? _paths.DataRootDir : currentValue;

        try
        {
            var fullPath = Path.GetFullPath(candidate);
            if (Directory.Exists(fullPath))
            {
                return fullPath;
            }

            var parent = Path.GetDirectoryName(fullPath);
            return !string.IsNullOrWhiteSpace(parent) && Directory.Exists(parent) ? parent : _paths.DataRootDir;
        }
        catch
        {
            return _paths.DataRootDir;
        }
    }

    private string? ValidateDirectoryPath(string input, string displayName, bool allowEmpty)
    {
        var value = (input ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(value))
        {
            if (allowEmpty)
            {
                return string.Empty;
            }

            SetStatus("error", $"{displayName}不能为空。");
            return null;
        }

        try
        {
            var fullPath = Path.GetFullPath(value);
            Directory.CreateDirectory(fullPath);
            return fullPath;
        }
        catch (Exception ex)
        {
            SetStatus("error", $"{displayName}不可用：{ex.Message}");
            return null;
        }
    }

    private string? ValidateFlexiblePath(string input, string displayName, bool expectFile, string relativeRoot, bool probeWrite)
    {
        var value = (input ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(value))
        {
            SetStatus("error", $"{displayName}不能为空。");
            return null;
        }

        try
        {
            var fullPath = Path.IsPathRooted(value)
                ? Path.GetFullPath(value)
                : Path.GetFullPath(Path.Combine(relativeRoot, value));

            var targetDirectory = expectFile ? Path.GetDirectoryName(fullPath) : fullPath;
            if (string.IsNullOrWhiteSpace(targetDirectory))
            {
                SetStatus("error", $"{displayName}格式无效。");
                return null;
            }

            Directory.CreateDirectory(targetDirectory);

            if (probeWrite)
            {
                var probeFile = Path.Combine(targetDirectory, $".write-test-{Guid.NewGuid():N}.tmp");
                File.WriteAllText(probeFile, "ok");
                File.Delete(probeFile);
            }

            return ToPreferredConfigPath(fullPath, relativeRoot);
        }
        catch (Exception ex)
        {
            SetStatus("error", $"{displayName}不可用：{ex.Message}");
            return null;
        }
    }

    private static string? ValidateProxy(string input)
    {
        var value = (input ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri))
        {
            return "代理地址格式无效，请输入完整 URL，例如 http://127.0.0.1:7890。";
        }

        return uri.Scheme is "http" or "https" or "socks5"
            ? null
            : "代理地址仅支持 http://、https:// 或 socks5:// 前缀。";
    }

    private static string FormatToolStatus(ToolStatus status)
    {
        if (status.Ok)
        {
            return string.IsNullOrWhiteSpace(status.Version) ? "OK" : status.Version;
        }

        return string.IsNullOrWhiteSpace(status.Message) ? "工具检查失败。" : status.Message;
    }

    private static string TryGetFileName(string currentValue)
    {
        try
        {
            var fileName = Path.GetFileName(currentValue);
            return string.IsNullOrWhiteSpace(fileName) ? string.Empty : fileName;
        }
        catch
        {
            return string.Empty;
        }
    }

    private static string ToPreferredConfigPath(string fullPath, string root)
    {
        try
        {
            var relative = Path.GetRelativePath(root, fullPath);
            if (!relative.StartsWith("..", StringComparison.Ordinal) && !Path.IsPathRooted(relative))
            {
                return relative.Replace('\\', '/');
            }
        }
        catch
        {
        }

        return fullPath;
    }
}
