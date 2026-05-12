using System.Diagnostics;
using System.Windows;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
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
    private void SaveProxy()
    {
        _config.Proxy = Proxy.Trim();
        _config.ProxyFallbackDirect = ProxyFallbackDirect;
        _configService.Save(_paths, _config);
        OnPropertyChanged(nameof(ProxySummary));
        SetStatus("success", "代理设置已保存。留空表示直连，新的解析/下载任务会使用更新后的配置。");
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

    private static string FormatToolStatus(ToolStatus status)
    {
        if (status.Ok)
        {
            return string.IsNullOrWhiteSpace(status.Version) ? "OK" : status.Version;
        }

        return string.IsNullOrWhiteSpace(status.Message) ? "工具检查失败。" : status.Message;
    }
}
