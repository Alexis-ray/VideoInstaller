using System.IO;
using System.Reflection;
using System.Windows;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using VideoInstaller.Desktop.Models;
using VideoInstaller.Desktop.Services;
using VideoInstaller.Desktop.Utils;
using VideoInstaller.Desktop.ViewModels;

namespace VideoInstaller.Desktop;

public partial class App : Application
{
    private ServiceProvider? _serviceProvider;

    protected override async void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        var runtimePathService = new RuntimePathService();
        var forcedRuntimeMode = e.Args.Any(arg => string.Equals(arg, "--installed", StringComparison.OrdinalIgnoreCase))
            ? "installed"
            : null;
        var bootstrapPaths = runtimePathService.ResolveBootstrap(forcedRuntimeMode);
        var configService = new ConfigService();
        var bootstrapConfig = configService.LoadOrCreate(bootstrapPaths);
        var paths = runtimePathService.ResolveForConfig(bootstrapConfig, bootstrapPaths);
        var loggerFactory = LoggingService.CreateLoggerFactory(paths);
        var logger = loggerFactory.CreateLogger<App>();

        try
        {
            _serviceProvider = BuildServices(loggerFactory, runtimePathService);

            configService = _serviceProvider.GetRequiredService<ConfigService>();
            var cookieService = _serviceProvider.GetRequiredService<CookieService>();
            var toolLocatorService = _serviceProvider.GetRequiredService<ToolLocatorService>();
            var healthService = _serviceProvider.GetRequiredService<HealthService>();
            var urlParserService = _serviceProvider.GetRequiredService<UrlParserService>();
            var bilibiliShortUrlResolver = _serviceProvider.GetRequiredService<BilibiliShortUrlResolver>();
            var ytDlpService = _serviceProvider.GetRequiredService<YtDlpService>();
            var downloadResultScannerService = _serviceProvider.GetRequiredService<DownloadResultScannerService>();
            var ffmpegService = _serviceProvider.GetRequiredService<FfmpegService>();
            var thumbnailService = _serviceProvider.GetRequiredService<ThumbnailService>();
            var folderService = _serviceProvider.GetRequiredService<FolderService>();
            var mainViewModelLogger = _serviceProvider.GetRequiredService<ILogger<MainViewModel>>();

            var config = configService.LoadOrCreate(paths);
            paths = runtimePathService.ResolveForConfig(config, bootstrapPaths);

            Directory.CreateDirectory(paths.TmpDir);
            Directory.CreateDirectory(paths.DownloadDir);
            Directory.CreateDirectory(paths.LogsDir);
            cookieService.EnsureCookieFile(paths);
            var cookieCheck = cookieService.CheckReadable(paths);

            var (ytDlp, ffmpeg, jsRuntime) = await toolLocatorService.CheckAsync(paths);
            var health = healthService.Build(paths, ytDlp, ffmpeg, jsRuntime, cookieCheck.readable, config);

            logger.LogInformation("Application started at {StartedAt}", DateTimeOffset.Now);
            logger.LogInformation("Application version: {Version}", Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "unknown");
            logger.LogInformation("Runtime mode: {RuntimeMode}", health.RuntimePaths.RuntimeMode);
            logger.LogInformation("App root: {AppRootDir}", health.RuntimePaths.AppRootDir);
            logger.LogInformation("Data root: {DataRootDir}", health.RuntimePaths.DataRootDir);
            logger.LogInformation("Config path: {ConfigPath}", health.RuntimePaths.ConfigPath);
            logger.LogInformation("Cookie path: {CookiePath}", health.RuntimePaths.CookiePath);
            logger.LogInformation("Tmp path: {TmpDir}", health.RuntimePaths.TmpDir);
            logger.LogInformation("Download path: {DownloadDir}", health.RuntimePaths.DownloadDir);
            logger.LogInformation("yt-dlp: {Path} | {Version}", health.YtDlp.Path, health.YtDlp.Version);
            logger.LogInformation("ffmpeg: {Path} | {Version}", health.Ffmpeg.Path, health.Ffmpeg.Version);
            logger.LogInformation("JS runtime: {Path} | {Version}", health.JsRuntime.Path, health.JsRuntime.Version);

            DispatcherUnhandledException += (_, args) =>
            {
                logger.LogError(args.Exception, "Unhandled UI exception");
            };

            AppDomain.CurrentDomain.UnhandledException += (_, args) =>
            {
                if (args.ExceptionObject is Exception exception)
                {
                    logger.LogError(exception, "Unhandled app domain exception");
                }
            };

            var viewModel = new MainViewModel(urlParserService, bilibiliShortUrlResolver, ytDlpService, downloadResultScannerService, ffmpegService, thumbnailService, folderService, config, paths, health, configService, mainViewModelLogger);
            var window = new MainWindow(viewModel);
            window.Show();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to start application");
            MessageBox.Show(ex.Message, "VideoInstaller startup failed", MessageBoxButton.OK, MessageBoxImage.Error);
            Shutdown(-1);
        }
    }

    private static ServiceProvider BuildServices(ILoggerFactory loggerFactory, RuntimePathService runtimePathService)
    {
        var services = new ServiceCollection();
        services.AddSingleton(loggerFactory);
        services.AddSingleton(typeof(ILogger<>), typeof(Logger<>));
        services.AddSingleton(runtimePathService);
        services.AddSingleton<ConfigService>();
        services.AddSingleton<CookieService>();
        services.AddSingleton<ProcessRunner>();
        services.AddSingleton<ProxyPolicyService>();
        services.AddSingleton<FormatMapperService>();
        services.AddSingleton<ToolLocatorService>();
        services.AddSingleton<HealthService>();
        services.AddSingleton<UrlParserService>();
        services.AddSingleton<BilibiliShortUrlResolver>();
        services.AddSingleton<YtDlpService>();
        services.AddSingleton<DownloadResultScannerService>();
        services.AddSingleton<FfmpegService>();
        services.AddSingleton<ThumbnailService>();
        services.AddSingleton<FolderService>();
        return services.BuildServiceProvider();
    }
}

