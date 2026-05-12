namespace VideoInstaller.Desktop.Models;

public sealed class AppConfig
{
    public string RuntimeMode { get; set; } = "portable";

    public string TmpDir { get; set; } = "tmp";

    public string DownloadDir { get; set; } = "downloads";

    public string Cookie { get; set; } = "cookies.txt";

    public string Proxy { get; set; } = "http://127.0.0.1:7890";

    public bool ProxyFallbackDirect { get; set; } = true;

    public string YtDlpPath { get; set; } = "tools/yt-dlp.exe";

    public string FfmpegPath { get; set; } = "tools/ffmpeg.exe";

    public string JsRuntimePath { get; set; } = "tools/js-runtime/deno.exe";

    public int ThumbnailTimeout { get; set; } = 8000;

    public TaskTimeoutConfig TaskTimeout { get; set; } = new();

    public int DiskCleanupThreshold { get; set; } = 90;
}
