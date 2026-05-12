using System.IO;
using Microsoft.Extensions.Logging;
using Serilog;
using VideoInstaller.Desktop.Models;

namespace VideoInstaller.Desktop.Services;

public static class LoggingService
{
    public static ILoggerFactory CreateLoggerFactory(RuntimePaths paths)
    {
        Directory.CreateDirectory(paths.LogsDir);

        var logger = new LoggerConfiguration()
            .MinimumLevel.Debug()
            .WriteTo.File(Path.Combine(paths.LogsDir, "app.log"), rollingInterval: RollingInterval.Day, retainedFileCountLimit: 7)
            .WriteTo.Logger(lc => lc
                .MinimumLevel.Error()
                .WriteTo.File(Path.Combine(paths.LogsDir, "error.log"), rollingInterval: RollingInterval.Day, retainedFileCountLimit: 14))
            .CreateLogger();

        return LoggerFactory.Create(builder =>
        {
            builder.ClearProviders();
            builder.SetMinimumLevel(LogLevel.Debug);
            builder.AddSerilog(logger, dispose: true);
        });
    }
}
