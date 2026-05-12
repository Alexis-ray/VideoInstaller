using System.IO;

namespace VideoInstaller.Desktop.Models;

public sealed class RuntimePaths
{
    public bool IsDevelopment { get; init; }

    public string RuntimeMode { get; init; } = string.Empty;

    public string AppRootDir { get; init; } = string.Empty;

    public string DataRootDir { get; init; } = string.Empty;

    public string ConfigPath { get; init; } = string.Empty;

    public string CookiePath { get; init; } = string.Empty;

    public string TmpDir { get; init; } = string.Empty;

    public string DownloadDir { get; init; } = string.Empty;

    public string LogsDir { get; init; } = string.Empty;

    public string ToolsDir { get; init; } = string.Empty;

    public string YtDlpPath { get; init; } = string.Empty;

    public string FfmpegPath { get; init; } = string.Empty;

    public string JsRuntimePath { get; init; } = string.Empty;

    public string ResolveDataPath(string path)
    {
        if (Path.IsPathRooted(path))
        {
            return Path.GetFullPath(path);
        }

        return Path.GetFullPath(Path.Combine(DataRootDir, path));
    }

    public string ResolveAppPath(string path)
    {
        if (Path.IsPathRooted(path))
        {
            return Path.GetFullPath(path);
        }

        return Path.GetFullPath(Path.Combine(AppRootDir, path));
    }
}
