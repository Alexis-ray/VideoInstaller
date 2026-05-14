using System.Text.Json;
using FluentAssertions;
using VideoInstaller.Desktop.Models;
using VideoInstaller.Desktop.Services;

namespace VideoInstaller.Desktop.Tests;

public sealed class ConfigServiceTests
{
    [Fact]
    public void CreateDefault_ShouldReturnGuideDefaults()
    {
        var service = new ConfigService();

        var config = service.CreateDefault("portable");

        config.RuntimeMode.Should().Be("portable");
        config.InstalledDataRoot.Should().BeEmpty();
        config.TmpDir.Should().Be("tmp");
        config.DownloadDir.Should().Be("downloads");
        config.LogsDir.Should().Be("logs");
        config.Cookie.Should().Be("cookies.txt");
        config.Proxy.Should().Be("http://127.0.0.1:7890");
        config.ProxyFallbackDirect.Should().BeTrue();
        config.YtDlpPath.Should().Be("tools/yt-dlp.exe");
        config.FfmpegPath.Should().Be("tools/ffmpeg.exe");
        config.JsRuntimePath.Should().Be("tools/js-runtime/deno.exe");
        config.TaskTimeout.Parse.Should().Be(60000);
        config.TaskTimeout.Download.Should().Be(3600000);
        config.DiskCleanupThreshold.Should().Be(90);
    }

    [Fact]
    public void CreateDefault_ShouldReturnInstalledDefaults()
    {
        var service = new ConfigService();

        var config = service.CreateDefault("installed");

        config.RuntimeMode.Should().Be("installed");
        config.InstalledDataRoot.Should().Contain(Path.Combine("AppData", "Local", "VideoInstaller"));
        config.DownloadDir.Should().Be("downloads");
        config.LogsDir.Should().Be("logs");
        config.Cookie.Should().Be("cookies.txt");
    }

    [Fact]
    public void LoadOrCreate_ShouldCreateConfigWhenMissing()
    {
        var root = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);

        try
        {
            var service = new ConfigService();
            var paths = new RuntimePaths
            {
                RuntimeMode = "portable",
                ConfigPath = Path.Combine(root, "config.json")
            };

            var config = service.LoadOrCreate(paths);

            File.Exists(paths.ConfigPath).Should().BeTrue();
            config.RuntimeMode.Should().Be("portable");
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }

    [Fact]
    public void LoadOrCreate_ShouldBackupInvalidConfigAndRecreateDefault()
    {
        var root = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);

        try
        {
            var path = Path.Combine(root, "config.json");
            File.WriteAllText(path, "{ invalid json }");
            var service = new ConfigService();
            var paths = new RuntimePaths
            {
                RuntimeMode = "portable",
                ConfigPath = path
            };

            var config = service.LoadOrCreate(paths);

            config.RuntimeMode.Should().Be("portable");
            Directory.GetFiles(root, "config.invalid.*.json").Should().HaveCount(1);
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }

    [Fact]
    public void LoadOrCreate_ShouldNormalizeMissingFields()
    {
        var root = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);

        try
        {
            var path = Path.Combine(root, "config.json");
            File.WriteAllText(path, JsonSerializer.Serialize(new { runtimeMode = "portable", tmpDir = "" }));
            var service = new ConfigService();
            var paths = new RuntimePaths
            {
                RuntimeMode = "portable",
                ConfigPath = path
            };

            var config = service.LoadOrCreate(paths);

            config.TmpDir.Should().Be("tmp");
            config.DownloadDir.Should().Be("downloads");
            config.InstalledDataRoot.Should().BeEmpty();
            config.LogsDir.Should().Be("logs");
            config.YtDlpPath.Should().Be("tools/yt-dlp.exe");
            config.JsRuntimePath.Should().Be("tools/js-runtime/deno.exe");
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }
}
