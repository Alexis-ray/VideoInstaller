using System.Diagnostics;
using System.Text;

namespace VideoInstaller.Desktop.Utils;

public sealed class ProcessRunner
{
    public async Task<ProcessRunResult> RunAsync(
        string fileName,
        IReadOnlyList<string> arguments,
        string? workingDirectory = null,
        int timeoutMilliseconds = 30000,
        CancellationToken cancellationToken = default)
    {
        using var process = new Process();
        var stdout = new StringBuilder();
        var stderr = new StringBuilder();

        process.StartInfo = new ProcessStartInfo
        {
            FileName = fileName,
            WorkingDirectory = workingDirectory ?? Environment.CurrentDirectory,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        foreach (var argument in arguments)
        {
            process.StartInfo.ArgumentList.Add(argument);
        }

        process.OutputDataReceived += (_, e) =>
        {
            if (e.Data is not null)
            {
                stdout.AppendLine(e.Data);
            }
        };

        process.ErrorDataReceived += (_, e) =>
        {
            if (e.Data is not null)
            {
                stderr.AppendLine(e.Data);
            }
        };

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        using var timeoutCts = new CancellationTokenSource(timeoutMilliseconds);
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeoutCts.Token);

        try
        {
            await process.WaitForExitAsync(linkedCts.Token);
        }
        catch (OperationCanceledException)
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
            }

            return new ProcessRunResult(-1, stdout.ToString(), stderr.ToString(), timeoutCts.IsCancellationRequested);
        }

        return new ProcessRunResult(process.ExitCode, stdout.ToString(), stderr.ToString(), false);
    }
}

public sealed record ProcessRunResult(int ExitCode, string StandardOutput, string StandardError, bool TimedOut);
