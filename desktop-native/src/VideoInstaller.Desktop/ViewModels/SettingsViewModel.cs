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

    public SettingsViewModel(AppConfig config, RuntimePaths paths, HealthStatus healthStatus, ConfigService configService)
    {
        _config = config;
        _paths = paths;
        _configService = configService;
        HealthStatus = healthStatus;

        DownloadDir = config.DownloadDir;
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
    private string downloadDir = string.Empty;

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
    private void BrowseDownloadDir()
    {
        var dialog = new OpenFolderDialog
        {
            Title = "请选择下载目录",
            InitialDirectory = ResolveInitialBrowsePath(),
            Multiselect = false
        };

        if (dialog.ShowDialog() == true)
        {
            DownloadDir = dialog.FolderName;
        }
    }

    [RelayCommand]
    private void SaveSettings()
    {
        var normalizedDownloadDir = ValidateDownloadDir(DownloadDir);
        if (normalizedDownloadDir is null)
        {
            return;
        }

        var proxyValidationMessage = ValidateProxy(Proxy);
        if (proxyValidationMessage is not null)
        {
            SetStatus("error", proxyValidationMessage);
            return;
        }

        _config.DownloadDir = normalizedDownloadDir;
        _config.Proxy = Proxy.Trim();
        _config.ProxyFallbackDirect = ProxyFallbackDirect;
        _configService.Save(_paths, _config);
        OnPropertyChanged(nameof(ProxySummary));
        SetStatus("success", "下载目录与代理设置已保存。新的解析和下载任务会使用更新后的配置。");
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
        var proxy = Proxy.Trim();
        return string.IsNullOrWhiteSpace(proxy)
            ? "未配置代理，YouTube 将直连访问。"
            : $"代理：{proxy}，失败回退直连：{(ProxyFallbackDirect ? "启用" : "禁用")}";
    }

    private string ResolveInitialBrowsePath()
    {
        var candidate = string.IsNullOrWhiteSpace(DownloadDir) ? DownloadDirCurrent : DownloadDir;

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

    private string? ValidateDownloadDir(string input)
    {
        var value = (input ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(value))
        {
            SetStatus("error", "下载目录不能为空。");
            return null;
        }

        try
        {
            var fullPath = Path.GetFullPath(value);
            Directory.CreateDirectory(fullPath);
            var probeFile = Path.Combine(fullPath, $".write-test-{Guid.NewGuid():N}.tmp");
            File.WriteAllText(probeFile, "ok");
            File.Delete(probeFile);
            DownloadDir = fullPath;
            return fullPath;
        }
        catch (Exception ex)
        {
            SetStatus("error", $"下载目录不可用：{ex.Message}");
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
}
