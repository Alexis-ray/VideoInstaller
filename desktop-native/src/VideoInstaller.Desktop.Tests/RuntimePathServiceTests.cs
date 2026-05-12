using FluentAssertions;
using VideoInstaller.Desktop.Services;

namespace VideoInstaller.Desktop.Tests;

public sealed class RuntimePathServiceTests
{
    [Fact]
    public void Resolve_ShouldReturnPortablePathsByDefault()
    {
        var service = new RuntimePathService();

        var result = service.ResolveBootstrap();

        result.ConfigPath.Should().EndWith("config.json");
        result.CookiePath.Should().EndWith("cookies.txt");
        result.TmpDir.Should().EndWith("tmp");
        result.LogsDir.Should().EndWith("logs");
    }

    [Fact]
    public void ResolveForConfig_ShouldRespectInstalledModeAndConfiguredPaths()
    {
        var service = new RuntimePathService();
        var bootstrap = service.ResolveBootstrap();

        var result = service.ResolveForConfig(new VideoInstaller.Desktop.Models.AppConfig
        {
            RuntimeMode = "installed",
            TmpDir = "downloads-temp",
            Cookie = "auth\\cookies.txt",
            YtDlpPath = "tools\\yt-dlp.exe",
            FfmpegPath = "tools\\ffmpeg.exe",
            JsRuntimePath = "tools\\js-runtime\\deno.exe"
        }, bootstrap);

        result.RuntimeMode.Should().Be("installed");
        result.TmpDir.Should().EndWith("downloads-temp");
        result.CookiePath.Should().EndWith(Path.Combine("auth", "cookies.txt"));
        result.JsRuntimePath.Should().EndWith(Path.Combine("tools", "js-runtime", "deno.exe"));
        result.ConfigPath.Should().EndWith("config.json");
    }

    [Fact]
    public void ResolveBootstrap_ShouldUseLocalAppDataForInstalledMode()
    {
        var service = new RuntimePathService();

        var result = service.ResolveBootstrap("installed");

        result.RuntimeMode.Should().Be("installed");
        result.ConfigPath.Should().Contain(Path.Combine("AppData", "Local", "VideoInstaller", "config.json"));
        result.CookiePath.Should().Contain(Path.Combine("AppData", "Local", "VideoInstaller", "cookies.txt"));
        result.TmpDir.Should().Contain(Path.Combine("AppData", "Local", "VideoInstaller", "tmp"));
        result.JsRuntimePath.Should().EndWith(Path.Combine("tools", "js-runtime", "deno.exe"));
    }

    [Fact]
    public void ResolveBootstrap_ShouldKeepPortableReleaseUnderRepositorySelfContained()
    {
        var root = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        var appRoot = Path.Combine(root, "release", "VideoInstaller-v2.0.1-win-x64");
        Directory.CreateDirectory(Path.Combine(appRoot, "tools"));

        try
        {
            File.WriteAllText(Path.Combine(root, "package.json"), "{}");
            File.WriteAllText(Path.Combine(appRoot, "VideoInstaller.exe"), "x");
            File.WriteAllText(Path.Combine(appRoot, "tools", "yt-dlp.exe"), "x");
            File.WriteAllText(Path.Combine(appRoot, "tools", "ffmpeg.exe"), "x");
            Directory.CreateDirectory(Path.Combine(appRoot, "tools", "js-runtime"));
            File.WriteAllText(Path.Combine(appRoot, "tools", "js-runtime", "deno.exe"), "x");
            File.WriteAllText(Path.Combine(appRoot, "config.json"), "{}");

            var service = new RuntimePathService();
            var result = service.ResolveBootstrap(appBaseDirectory: appRoot);

            result.RuntimeMode.Should().Be("portable");
            result.IsDevelopment.Should().BeFalse();
            result.AppRootDir.Should().Be(Path.GetFullPath(appRoot));
            result.DataRootDir.Should().Be(Path.GetFullPath(appRoot));
            result.TmpDir.Should().Be(Path.Combine(Path.GetFullPath(appRoot), "tmp"));
            result.JsRuntimePath.Should().Be(Path.Combine(Path.GetFullPath(appRoot), "tools", "js-runtime", "deno.exe"));
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }
}
