using System.IO;
using VideoInstaller.Desktop.Models;

namespace VideoInstaller.Desktop.Services;

public sealed class RuntimePathService
{
    private const string InstalledDataRootMarkerFileName = "data-root.txt";

    public string GetDefaultInstalledDataRoot()
    {
        return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "VideoInstaller");
    }

    public RuntimePaths ResolveBootstrap(string? forcedRuntimeMode = null)
    {
        return ResolveBootstrap(AppContext.BaseDirectory, forcedRuntimeMode);
    }

    public RuntimePaths ResolveBootstrap(string appBaseDirectory, string? forcedRuntimeMode = null)
    {
        var appRootDir = NormalizeDir(appBaseDirectory);
        var projectRootDir = FindProjectRoot(appRootDir);
        var localDataDir = GetDefaultInstalledDataRoot();
        var isInstalled = string.Equals(forcedRuntimeMode, "installed", StringComparison.OrdinalIgnoreCase);
        var isPortableBundle = IsPortableBundle(appRootDir);
        var isDevelopment = !isInstalled && !isPortableBundle && IsDevelopmentBinDirectory(appRootDir);
        var runtimeMode = string.Equals(forcedRuntimeMode, "installed", StringComparison.OrdinalIgnoreCase)
            ? "installed"
            : "portable";
        var dataRootDir = runtimeMode == "installed"
            ? ResolveBootstrapInstalledDataRoot(appRootDir, localDataDir)
            : isDevelopment && projectRootDir is not null ? projectRootDir : appRootDir;
        var configPath = Path.Combine(dataRootDir, "config.json");

        return new RuntimePaths
        {
            IsDevelopment = isDevelopment,
            RuntimeMode = runtimeMode,
            AppRootDir = appRootDir,
            DataRootDir = dataRootDir,
            ConfigPath = configPath,
            CookiePath = Path.Combine(dataRootDir, "cookies.txt"),
            TmpDir = Path.Combine(dataRootDir, "tmp"),
            DownloadDir = Path.Combine(dataRootDir, "downloads"),
            LogsDir = Path.Combine(dataRootDir, "logs"),
            ToolsDir = Path.Combine(appRootDir, "tools"),
            YtDlpPath = Path.Combine(appRootDir, "tools", "yt-dlp.exe"),
            FfmpegPath = Path.Combine(appRootDir, "tools", "ffmpeg.exe"),
            JsRuntimePath = Path.Combine(appRootDir, "tools", "js-runtime", "deno.exe")
        };
    }

    public RuntimePaths ResolveForConfig(AppConfig config, RuntimePaths bootstrapPaths)
    {
        var runtimeMode = string.Equals(config.RuntimeMode, "installed", StringComparison.OrdinalIgnoreCase)
            ? "installed"
            : "portable";
        var dataRootDir = runtimeMode == "installed"
            ? ResolveInstalledDataRoot(config.InstalledDataRoot, bootstrapPaths.DataRootDir)
            : bootstrapPaths.DataRootDir;
        var resolved = new RuntimePaths
        {
            IsDevelopment = bootstrapPaths.IsDevelopment,
            RuntimeMode = runtimeMode,
            AppRootDir = bootstrapPaths.AppRootDir,
            DataRootDir = dataRootDir,
            ConfigPath = runtimeMode == "installed"
                ? Path.Combine(dataRootDir, "config.json")
                : bootstrapPaths.ConfigPath,
            CookiePath = ResolveAgainstRoot(config.Cookie, dataRootDir, "cookies.txt"),
            TmpDir = ResolveAgainstRoot(config.TmpDir, dataRootDir, "tmp"),
            DownloadDir = ResolveAgainstRoot(config.DownloadDir, dataRootDir, "downloads"),
            LogsDir = ResolveAgainstRoot(config.LogsDir, dataRootDir, "logs"),
            ToolsDir = Path.Combine(bootstrapPaths.AppRootDir, "tools"),
            YtDlpPath = ResolveAgainstRoot(config.YtDlpPath, bootstrapPaths.AppRootDir, Path.Combine("tools", "yt-dlp.exe")),
            FfmpegPath = ResolveAgainstRoot(config.FfmpegPath, bootstrapPaths.AppRootDir, Path.Combine("tools", "ffmpeg.exe")),
            JsRuntimePath = ResolveAgainstRoot(config.JsRuntimePath, bootstrapPaths.AppRootDir, Path.Combine("tools", "js-runtime", "deno.exe"))
        };

        return resolved;
    }

    private string ResolveInstalledDataRoot(string? configuredValue, string bootstrapDataRoot)
    {
        if (string.IsNullOrWhiteSpace(configuredValue))
        {
            return Path.GetFullPath(bootstrapDataRoot);
        }

        return Path.GetFullPath(configuredValue);
    }

    private string ResolveBootstrapInstalledDataRoot(string appRootDir, string defaultRoot)
    {
        var markerPath = Path.Combine(appRootDir, InstalledDataRootMarkerFileName);

        try
        {
            if (File.Exists(markerPath))
            {
                var markerValue = File.ReadAllText(markerPath).Trim();
                if (!string.IsNullOrWhiteSpace(markerValue))
                {
                    return Path.GetFullPath(markerValue);
                }
            }
        }
        catch
        {
        }

        return Path.GetFullPath(defaultRoot);
    }

    private static string ResolveAgainstRoot(string? path, string root, string fallback)
    {
        var target = string.IsNullOrWhiteSpace(path) ? fallback : path;
        return Path.IsPathRooted(target) ? Path.GetFullPath(target) : Path.GetFullPath(Path.Combine(root, target));
    }

    private static string NormalizeDir(string path)
    {
        return Path.GetFullPath(path).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
    }

    private static bool IsPortableBundle(string appRootDir)
    {
        return File.Exists(Path.Combine(appRootDir, "VideoInstaller.exe"))
            && File.Exists(Path.Combine(appRootDir, "tools", "yt-dlp.exe"))
            && File.Exists(Path.Combine(appRootDir, "tools", "ffmpeg.exe"))
            && File.Exists(Path.Combine(appRootDir, "config.json"));
    }

    private static bool IsDevelopmentBinDirectory(string appRootDir)
    {
        var normalized = appRootDir.Replace(Path.AltDirectorySeparatorChar, Path.DirectorySeparatorChar);
        var marker = Path.Combine("desktop-native", "src", "VideoInstaller.Desktop", "bin") + Path.DirectorySeparatorChar;
        return normalized.Contains(marker, StringComparison.OrdinalIgnoreCase);
    }

    private static string? FindProjectRoot(string startDir)
    {
        var current = new DirectoryInfo(startDir);

        while (current is not null)
        {
            if (File.Exists(Path.Combine(current.FullName, "package.json")))
            {
                return current.FullName;
            }

            current = current.Parent;
        }

        return null;
    }
}
