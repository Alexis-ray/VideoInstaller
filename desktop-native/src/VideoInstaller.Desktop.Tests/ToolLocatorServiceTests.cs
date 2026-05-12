using FluentAssertions;
using VideoInstaller.Desktop.Models;
using VideoInstaller.Desktop.Services;
using VideoInstaller.Desktop.Utils;

namespace VideoInstaller.Desktop.Tests;

public sealed class ToolLocatorServiceTests
{
    [Fact]
    public async Task CheckAsync_ShouldReturnMissingStatusWhenExecutablesDoNotExist()
    {
        var service = new ToolLocatorService(new ProcessRunner());
        var paths = new RuntimePaths
        {
            YtDlpPath = Path.Combine(Path.GetTempPath(), "missing-yt-dlp.exe"),
            FfmpegPath = Path.Combine(Path.GetTempPath(), "missing-ffmpeg.exe"),
            JsRuntimePath = Path.Combine(Path.GetTempPath(), "missing-deno.exe")
        };

        var (ytDlp, ffmpeg, jsRuntime) = await service.CheckAsync(paths);

        ytDlp.Ok.Should().BeFalse();
        ffmpeg.Ok.Should().BeFalse();
        jsRuntime.Ok.Should().BeFalse();
        ytDlp.Message.Should().Be("Missing executable");
        ffmpeg.Message.Should().Be("Missing executable");
        jsRuntime.Message.Should().Be("Missing executable");
    }

    [Fact]
    public async Task CheckAsync_ShouldPreferErrorMessageWhenProcessFails()
    {
        var root = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);

        try
        {
            var failingScript = Path.Combine(root, "fail.cmd");
            await File.WriteAllTextAsync(failingScript, "@echo off\r\necho version-text\r\necho broken-runtime 1>&2\r\nexit /b 1\r\n");

            var service = new ToolLocatorService(new ProcessRunner());
            var paths = new RuntimePaths
            {
                YtDlpPath = failingScript,
                FfmpegPath = failingScript,
                JsRuntimePath = failingScript
            };

            var (ytDlp, ffmpeg, jsRuntime) = await service.CheckAsync(paths);

            ytDlp.Ok.Should().BeFalse();
            ffmpeg.Ok.Should().BeFalse();
            jsRuntime.Ok.Should().BeFalse();
            ytDlp.Version.Should().BeEmpty();
            ffmpeg.Version.Should().BeEmpty();
            jsRuntime.Version.Should().BeEmpty();
            ytDlp.Message.Should().Contain("broken-runtime");
            ffmpeg.Message.Should().Contain("broken-runtime");
            jsRuntime.Message.Should().Contain("broken-runtime");
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }
}
