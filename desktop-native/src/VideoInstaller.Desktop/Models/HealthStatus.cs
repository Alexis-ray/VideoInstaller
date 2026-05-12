namespace VideoInstaller.Desktop.Models;

public sealed class HealthStatus
{
    public string AppName { get; init; } = "VideoInstaller";

    public string AppVersion { get; init; } = string.Empty;

    public RuntimePaths RuntimePaths { get; init; } = new();

    public ToolStatus YtDlp { get; init; } = new() { Name = "yt-dlp" };

    public ToolStatus Ffmpeg { get; init; } = new() { Name = "ffmpeg" };

    public ToolStatus JsRuntime { get; init; } = new() { Name = "deno" };

    public bool ConfigExists { get; init; }

    public bool CookieExists { get; init; }

    public bool CookieReadable { get; init; }

    public bool CookieHasContent { get; init; }

    public string ProxySummary { get; init; } = string.Empty;

    public bool TmpWritable { get; init; }

    public string SummaryMessage { get; init; } = string.Empty;
}
