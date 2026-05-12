using FluentAssertions;
using VideoInstaller.Desktop.Models;
using VideoInstaller.Desktop.Services;

namespace VideoInstaller.Desktop.Tests;

public sealed class YtDlpServiceTests
{
    [Fact]
    public void BuildBaseArgs_ShouldIncludeJsRuntimeWhenBundledRuntimeExists()
    {
        var root = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        var denoPath = Path.Combine(root, "tools", "js-runtime", "deno.exe");
        Directory.CreateDirectory(Path.GetDirectoryName(denoPath)!);

        try
        {
            File.WriteAllText(denoPath, "x");
            var paths = new RuntimePaths { JsRuntimePath = denoPath };

            var args = YtDlpService.BuildBaseArgs(paths);

            args.Should().ContainInOrder("--js-runtimes", $"deno:{denoPath}");
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }

    [Fact]
    public void FormatYtDlpError_ShouldExplainYoutubeBotCookieAndJsRuntimeFailures()
    {
        var paths = new RuntimePaths
        {
            CookiePath = @"C:\VideoInstaller\cookies.txt",
            JsRuntimePath = @"C:\VideoInstaller\tools\js-runtime\deno.exe"
        };

        var message = YtDlpService.FormatYtDlpError(
            "WARNING: [youtube] No supported JavaScript runtime could be found. ERROR: [youtube] abc: Sign in to confirm you're not a bot.",
            paths);

        message.Should().Contain("Cookie");
        message.Should().Contain(paths.CookiePath);
        message.Should().Contain("JavaScript");
        message.Should().Contain(paths.JsRuntimePath);
    }
}
