using System.IO;
using System.Reflection;
using VideoInstaller.Desktop.Models;

namespace VideoInstaller.Desktop.Services;

public sealed class HealthService
{
    public HealthStatus Build(RuntimePaths paths, ToolStatus ytDlp, ToolStatus ffmpeg, ToolStatus jsRuntime, bool cookieReadable, AppConfig config)
    {
        var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "unknown";
        var cookieHasContent = File.Exists(paths.CookiePath)
            && File.ReadLines(paths.CookiePath).Any(line => !string.IsNullOrWhiteSpace(line) && !line.TrimStart().StartsWith('#'));
        var proxySummary = string.IsNullOrWhiteSpace(config.Proxy)
            ? "未配置代理，YouTube 将直连访问。"
            : $"代理：{config.Proxy.Trim()}，失败回退直连：{(config.ProxyFallbackDirect ? "启用" : "禁用")}";

        return new HealthStatus
        {
            AppVersion = version,
            RuntimePaths = paths,
            YtDlp = ytDlp,
            Ffmpeg = ffmpeg,
            JsRuntime = jsRuntime,
            ConfigExists = File.Exists(paths.ConfigPath),
            CookieExists = File.Exists(paths.CookiePath),
            CookieReadable = cookieReadable,
            CookieHasContent = cookieHasContent,
            ProxySummary = proxySummary,
            TmpWritable = Directory.Exists(paths.TmpDir),
            SummaryMessage = ytDlp.Ok && ffmpeg.Ok && jsRuntime.Ok ? "Tools ready" : "Tool check failed"
        };
    }
}
