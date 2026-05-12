using System.IO;
using VideoInstaller.Desktop.Models;
using VideoInstaller.Desktop.Utils;

namespace VideoInstaller.Desktop.Services;

public sealed class ConfigService
{
    public AppConfig LoadOrCreate(RuntimePaths paths)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(paths.ConfigPath)!);

        if (!File.Exists(paths.ConfigPath))
        {
            var config = CreateDefault(paths.RuntimeMode);
            File.WriteAllText(paths.ConfigPath, JsonHelpers.Serialize(config));
            return config;
        }

        try
        {
            var json = File.ReadAllText(paths.ConfigPath);
            var config = JsonHelpers.Deserialize<AppConfig>(json);
            return Normalize(config, paths.RuntimeMode);
        }
        catch (Exception)
        {
            var backupPath = Path.Combine(
                Path.GetDirectoryName(paths.ConfigPath)!,
                $"config.invalid.{DateTime.Now:yyyyMMddHHmmss}.json");
            File.Copy(paths.ConfigPath, backupPath, overwrite: true);
            var config = CreateDefault(paths.RuntimeMode);
            File.WriteAllText(paths.ConfigPath, JsonHelpers.Serialize(config));
            return config;
        }
    }

    public AppConfig CreateDefault(string runtimeMode)
    {
        return new AppConfig
        {
            RuntimeMode = runtimeMode
        };
    }

    public void Save(RuntimePaths paths, AppConfig config)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(paths.ConfigPath)!);
        File.WriteAllText(paths.ConfigPath, JsonHelpers.Serialize(Normalize(config, paths.RuntimeMode)));
    }

    private AppConfig Normalize(AppConfig? config, string runtimeMode)
    {
        var defaults = CreateDefault(runtimeMode);
        if (config is null)
        {
            return defaults;
        }

        config.RuntimeMode = string.IsNullOrWhiteSpace(config.RuntimeMode) ? defaults.RuntimeMode : config.RuntimeMode;
        config.TmpDir = string.IsNullOrWhiteSpace(config.TmpDir) ? defaults.TmpDir : config.TmpDir;
        config.Cookie = string.IsNullOrWhiteSpace(config.Cookie) ? defaults.Cookie : config.Cookie;
        config.Proxy = config.Proxy ?? defaults.Proxy;
        config.YtDlpPath = string.IsNullOrWhiteSpace(config.YtDlpPath) ? defaults.YtDlpPath : config.YtDlpPath;
        config.FfmpegPath = string.IsNullOrWhiteSpace(config.FfmpegPath) ? defaults.FfmpegPath : config.FfmpegPath;
        config.JsRuntimePath = string.IsNullOrWhiteSpace(config.JsRuntimePath) ? defaults.JsRuntimePath : config.JsRuntimePath;
        config.ThumbnailTimeout = config.ThumbnailTimeout > 0 ? config.ThumbnailTimeout : defaults.ThumbnailTimeout;
        config.TaskTimeout ??= new TaskTimeoutConfig();
        config.TaskTimeout.Parse = config.TaskTimeout.Parse > 0 ? config.TaskTimeout.Parse : defaults.TaskTimeout.Parse;
        config.TaskTimeout.Download = config.TaskTimeout.Download > 0 ? config.TaskTimeout.Download : defaults.TaskTimeout.Download;
        config.DiskCleanupThreshold = config.DiskCleanupThreshold > 0 ? config.DiskCleanupThreshold : defaults.DiskCleanupThreshold;
        return config;
    }
}
