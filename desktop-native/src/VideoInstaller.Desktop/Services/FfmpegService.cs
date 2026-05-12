using System.IO;
using Microsoft.Extensions.Logging;
using VideoInstaller.Desktop.Utils;

namespace VideoInstaller.Desktop.Services;

public sealed class FfmpegService
{
    private readonly ProcessRunner _processRunner;
    private readonly ILogger<FfmpegService> _logger;

    public FfmpegService(ProcessRunner processRunner, ILogger<FfmpegService> logger)
    {
        _processRunner = processRunner;
        _logger = logger;
    }

    public async Task<string> TranscodeToH264Async(string ffmpegPath, string inputFile, string? audioFile, string outputFile, int timeoutMilliseconds, CancellationToken cancellationToken = default)
    {
        var args = new List<string> { "-y", "-i", inputFile };
        if (!string.IsNullOrWhiteSpace(audioFile))
        {
            args.AddRange(["-i", audioFile, "-map", "0:v:0", "-map", "1:a:0", "-shortest"]);
        }

        args.AddRange(["-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart", outputFile]);
        _logger.LogInformation("ffmpeg transcode to {OutputFile}", outputFile);
        var result = await _processRunner.RunAsync(ffmpegPath, args, Path.GetDirectoryName(outputFile), timeoutMilliseconds, cancellationToken);
        if (result.ExitCode != 0)
        {
            throw new InvalidOperationException(string.IsNullOrWhiteSpace(result.StandardError) ? "转码失败" : result.StandardError.Trim());
        }

        return outputFile;
    }
}
