using System.IO;
using VideoInstaller.Desktop.Models;
using VideoInstaller.Desktop.Utils;

namespace VideoInstaller.Desktop.Services;

public sealed class ToolLocatorService
{
    private readonly ProcessRunner _processRunner;

    public ToolLocatorService(ProcessRunner processRunner)
    {
        _processRunner = processRunner;
    }

    public async Task<(ToolStatus ytDlp, ToolStatus ffmpeg, ToolStatus jsRuntime)> CheckAsync(RuntimePaths paths, CancellationToken cancellationToken = default)
    {
        var ytDlp = await CheckToolAsync("yt-dlp", paths.YtDlpPath, new[] { "--version" }, cancellationToken);
        var ffmpeg = await CheckToolAsync("ffmpeg", paths.FfmpegPath, new[] { "-version" }, cancellationToken);
        var jsRuntime = await CheckToolAsync("deno", paths.JsRuntimePath, new[] { "--version" }, cancellationToken);
        return (ytDlp, ffmpeg, jsRuntime);
    }

    private async Task<ToolStatus> CheckToolAsync(string name, string path, IReadOnlyList<string> arguments, CancellationToken cancellationToken)
    {
        if (!File.Exists(path))
        {
            return new ToolStatus { Name = name, Path = path, Ok = false, Message = "Missing executable" };
        }

        try
        {
            var result = await _processRunner.RunAsync(path, arguments, Path.GetDirectoryName(path), 10000, cancellationToken);
            var versionLine = (result.StandardOutput + Environment.NewLine + result.StandardError)
                .Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries)
                .FirstOrDefault() ?? string.Empty;

            return new ToolStatus
            {
                Name = name,
                Path = path,
                Ok = result.ExitCode == 0,
                Version = result.ExitCode == 0 ? versionLine : string.Empty,
                Message = result.TimedOut ? "Timed out" : result.ExitCode == 0 ? "OK" : string.IsNullOrWhiteSpace(result.StandardError) ? "Launch failed" : result.StandardError.Trim()
            };
        }
        catch (Exception ex)
        {
            return new ToolStatus
            {
                Name = name,
                Path = path,
                Ok = false,
                Message = ex.Message
            };
        }
    }
}
