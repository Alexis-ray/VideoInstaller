using System.Collections.ObjectModel;
using System.IO;
using System.Reflection;
using System.Windows;
using System.Windows.Media;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Microsoft.Extensions.Logging;
using VideoInstaller.Desktop.Models;
using VideoInstaller.Desktop.Services;
using VideoInstaller.Desktop.Utils;

namespace VideoInstaller.Desktop.ViewModels;

public partial class MainViewModel : ObservableObject
{
    private readonly UrlParserService _urlParserService;
    private readonly BilibiliShortUrlResolver _bilibiliShortUrlResolver;
    private readonly YtDlpService _ytDlpService;
    private readonly DownloadResultScannerService _downloadResultScannerService;
    private readonly FfmpegService _ffmpegService;
    private readonly ThumbnailService _thumbnailService;
    private readonly FolderService _folderService;
    private readonly AppConfig _config;
    private readonly RuntimePaths _paths;
    private readonly ILogger<MainViewModel> _logger;
    private bool _updatingPartSelection;
    private VideoParseResult? _currentParseResult;

    public MainViewModel(
        UrlParserService urlParserService,
        BilibiliShortUrlResolver bilibiliShortUrlResolver,
        YtDlpService ytDlpService,
        DownloadResultScannerService downloadResultScannerService,
        FfmpegService ffmpegService,
        ThumbnailService thumbnailService,
        FolderService folderService,
        AppConfig config,
        RuntimePaths paths,
        HealthStatus healthStatus,
        ConfigService configService,
        ILogger<MainViewModel> logger)
    {
        _urlParserService = urlParserService;
        _bilibiliShortUrlResolver = bilibiliShortUrlResolver;
        _ytDlpService = ytDlpService;
        _downloadResultScannerService = downloadResultScannerService;
        _ffmpegService = ffmpegService;
        _thumbnailService = thumbnailService;
        _folderService = folderService;
        _config = config;
        _paths = paths;
        _logger = logger;
        Settings = new SettingsViewModel(config, paths, healthStatus, configService);

        StatusMessage = $"初始化完成。yt-dlp={(healthStatus.YtDlp.Ok ? "OK" : "FAIL")}，ffmpeg={(healthStatus.Ffmpeg.Ok ? "OK" : "FAIL")}。当前下载目录：{paths.DownloadDir}";
        StatusKind = "info";
    }

    public string VersionText => $"VideoInstaller v{GetAppVersion()}";

    public string GithubText => "https://github.com/Alexis-ray/VideoInstaller";

    private static string GetAppVersion()
    {
        return Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "unknown";
    }

    [ObservableProperty]
    private string urlInput = string.Empty;

    [ObservableProperty]
    private string statusMessage = string.Empty;

    [ObservableProperty]
    private string statusKind = "info";

    [ObservableProperty]
    private bool isParsing;

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(DownloadOriginalCommand))]
    [NotifyCanExecuteChangedFor(nameof(DownloadTranscodeCommand))]
    [NotifyCanExecuteChangedFor(nameof(DownloadSingleAudioCommand))]
    [NotifyCanExecuteChangedFor(nameof(DownloadSingleVideoCommand))]
    [NotifyCanExecuteChangedFor(nameof(SaveThumbnailCommand))]
    private bool isDownloading;

    [ObservableProperty]
    private bool hasResult;

    partial void OnHasResultChanged(bool value)
    {
        OnPropertyChanged(nameof(CanDownloadSelectedFormats));
        DownloadOriginalCommand.NotifyCanExecuteChanged();
        DownloadTranscodeCommand.NotifyCanExecuteChanged();
        DownloadSingleAudioCommand.NotifyCanExecuteChanged();
        DownloadSingleVideoCommand.NotifyCanExecuteChanged();
        SaveThumbnailCommand.NotifyCanExecuteChanged();
    }

    [ObservableProperty]
    private string title = "解析结果";

    [ObservableProperty]
    private string parseNote = string.Empty;

    [ObservableProperty]
    private string sourceTypeText = string.Empty;

    [ObservableProperty]
    private string thumbnailUrl = string.Empty;

    partial void OnThumbnailUrlChanged(string value)
    {
        SaveThumbnailCommand.NotifyCanExecuteChanged();
    }

    [ObservableProperty]
    private VideoPart? selectedPart;

    partial void OnSelectedPartChanged(VideoPart? value)
    {
        if (_updatingPartSelection || value is null || string.IsNullOrWhiteSpace(value.Url) || IsParsing)
        {
            return;
        }

        UrlInput = value.Url;
        _ = ParseAsync(value.Url);
    }

    [ObservableProperty]
    private MediaFormat? selectedAudio;

    partial void OnSelectedAudioChanged(MediaFormat? value)
    {
        OnPropertyChanged(nameof(CurrentSelectionSummary));
        OnPropertyChanged(nameof(CanDownloadSelectedFormats));
        DownloadOriginalCommand.NotifyCanExecuteChanged();
        DownloadTranscodeCommand.NotifyCanExecuteChanged();
    }

    [ObservableProperty]
    private MediaFormat? selectedVideo;

    partial void OnSelectedVideoChanged(MediaFormat? value)
    {
        OnPropertyChanged(nameof(CurrentSelectionSummary));
        OnPropertyChanged(nameof(CanDownloadSelectedFormats));
        DownloadOriginalCommand.NotifyCanExecuteChanged();
        DownloadTranscodeCommand.NotifyCanExecuteChanged();
    }

    public ObservableCollection<VideoPart> Parts { get; } = [];

    public ObservableCollection<MediaFormat> Audios { get; } = [];

    public ObservableCollection<MediaFormat> Videos { get; } = [];

    public DownloadTaskViewModel DownloadTask { get; } = new();

    public SettingsViewModel Settings { get; }

    public bool CanDownloadSelectedFormats => !IsDownloading && HasResult && SelectedAudio is not null && SelectedVideo is not null;

    public string CurrentSelectionSummary
    {
        get
        {
            if (SelectedVideo is null || SelectedAudio is null)
            {
                return "当前选择：请先选择音频和视频品质。";
            }

            return $"当前选择：视频 {SelectedVideo.SelectionDisplayText} + 音频 {SelectedAudio.SelectionDisplayText}";
        }
    }

    public Brush StatusBackground => StatusKind switch
    {
        "success" => new SolidColorBrush((Color)ColorConverter.ConvertFromString("#EDF8EF")),
        "error" => new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FFF3F3")),
        _ => new SolidColorBrush((Color)ColorConverter.ConvertFromString("#EEF6FF"))
    };

    public Brush StatusForeground => StatusKind switch
    {
        "success" => new SolidColorBrush((Color)ColorConverter.ConvertFromString("#1D5F2A")),
        "error" => new SolidColorBrush((Color)ColorConverter.ConvertFromString("#9F1D1D")),
        _ => new SolidColorBrush((Color)ColorConverter.ConvertFromString("#194B80"))
    };

    public bool HasMultipleParts => Parts.Count > 1;

    [RelayCommand]
    private void CopyGithub()
    {
        Clipboard.SetText(GithubText);
        SetStatus("success", "GitHub 链接已复制到剪贴板。", true);
    }

    [RelayCommand(CanExecute = nameof(CanSaveThumbnail))]
    private Task SaveThumbnailAsync()
    {
        return SaveThumbnailInternalAsync();
    }

    [RelayCommand(CanExecute = nameof(CanDownloadSelectedFormats))]
    private Task DownloadOriginalAsync()
    {
        return DownloadInternalAsync(transcode: false, singleFormat: null, kind: null);
    }

    [RelayCommand(CanExecute = nameof(CanDownloadSelectedFormats))]
    private Task DownloadTranscodeAsync()
    {
        return DownloadInternalAsync(transcode: true, singleFormat: null, kind: null);
    }

    [RelayCommand(CanExecute = nameof(CanDownloadSingleFormat))]
    private Task DownloadSingleAudioAsync(MediaFormat? format)
    {
        return DownloadInternalAsync(transcode: false, singleFormat: format, kind: "audio");
    }

    [RelayCommand(CanExecute = nameof(CanDownloadSingleFormat))]
    private Task DownloadSingleVideoAsync(MediaFormat? format)
    {
        return DownloadInternalAsync(transcode: false, singleFormat: format, kind: "video");
    }

    [RelayCommand]
    private void OpenOutputDirectory()
    {
        if (string.IsNullOrWhiteSpace(DownloadTask.OutputDirectory))
        {
            SetDownloadStatus("error", "当前没有可打开的输出目录。");
            return;
        }

        _folderService.OpenFolder(DownloadTask.OutputDirectory, _paths.DownloadDir, _paths.TmpDir);
    }

    [RelayCommand]
    private async Task ParseAsync()
    {
        await ParseAsync(UrlInput);
    }

    private async Task ParseAsync(string input)
    {
        var rawUrl = (input ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(rawUrl))
        {
            SetStatus("error", "请输入 YouTube 或 Bilibili 视频链接。", true);
            return;
        }

        try
        {
            IsParsing = true;
            HasResult = false;
            SetStatus("info", "正在解析视频，请稍候…", true);

            var normalized = _urlParserService.NormalizeInput(rawUrl);
            if (System.Text.RegularExpressions.Regex.IsMatch(normalized, "^https?:\\/\\/b23\\.tv\\/", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
            {
                normalized = await _bilibiliShortUrlResolver.ResolveAsync(normalized, _config.TaskTimeout.Parse);
            }

            var parsed = _urlParserService.Parse(normalized);
            if (parsed is null)
            {
                SetStatus("error", "请提供有效的 YouTube 或 Bilibili 视频 URL。", true);
                return;
            }

            var parseResult = await _ytDlpService.ParseAsync(parsed, _config, _paths);
            if (!parseResult.Success)
            {
                SetStatus("error", parseResult.Error, true);
                return;
            }

            _currentParseResult = parseResult;
            Title = parseResult.Title;
            ParseNote = parseResult.Note;
            SourceTypeText = ToSourceTypeText(parseResult.SourceType);
            ThumbnailUrl = parseResult.ThumbnailCandidates.FirstOrDefault() ?? parseResult.ThumbnailUrl;

            ReplaceCollection(Parts, parseResult.Parts);
            ReplaceCollection(Audios, parseResult.Audios);
            ReplaceCollection(Videos, parseResult.Videos);

            _updatingPartSelection = true;
            SelectedPart = parseResult.CurrentPart ?? Parts.FirstOrDefault();
            _updatingPartSelection = false;
            SelectedAudio = Audios.FirstOrDefault(item => item.IsBest) ?? Audios.FirstOrDefault();
            SelectedVideo = Videos.FirstOrDefault(item => item.IsBest) ?? Videos.FirstOrDefault();

            OnPropertyChanged(nameof(HasMultipleParts));
            OnPropertyChanged(nameof(CanDownloadSelectedFormats));
            HasResult = true;
            SetStatus("success", $"解析完成：{parseResult.Title}，请选择需要的下载方式。", true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Parse command failed");
            SetStatus("error", ex.Message, true);
        }
        finally
        {
            IsParsing = false;
        }
    }

    private void ReplaceCollection<T>(ObservableCollection<T> collection, IEnumerable<T> items)
    {
        collection.Clear();
        foreach (var item in items)
        {
            collection.Add(item);
        }
    }

    private void SetStatus(string kind, string message, bool notifyColors)
    {
        StatusKind = kind;
        StatusMessage = message;
        if (notifyColors)
        {
            OnPropertyChanged(nameof(StatusBackground));
            OnPropertyChanged(nameof(StatusForeground));
        }
    }

    private void SetDownloadStatus(string kind, string message)
    {
        DownloadTask.HasResult = true;
        DownloadTask.IsSuccess = kind == "success";
        DownloadTask.StatusKind = kind;
        DownloadTask.StatusText = message;
    }

    private void ResetDownloadTask(string message)
    {
        DownloadTask.HasResult = true;
        DownloadTask.IsSuccess = false;
        DownloadTask.StatusKind = "info";
        DownloadTask.StatusText = message;
        DownloadTask.OutputDirectory = string.Empty;
        DownloadTask.MainFile = string.Empty;
        DownloadTask.AudioFile = string.Empty;
        DownloadTask.VideoFile = string.Empty;
        DownloadTask.MetadataFile = string.Empty;
        DownloadTask.ThumbnailFile = string.Empty;
        DownloadTask.TranscodedFile = string.Empty;
    }

    private bool CanSaveThumbnail()
    {
        return !IsDownloading && HasResult && !string.IsNullOrWhiteSpace(ThumbnailUrl);
    }

    private bool CanDownloadSingleFormat(MediaFormat? format)
    {
        return !IsDownloading && HasResult && format is not null;
    }

    private static string ToSourceTypeText(SourceType sourceType)
    {
        return sourceType switch
        {
            SourceType.YouTubeWatch => "youtube-watch",
            SourceType.YouTubeShort => "youtube-short",
            SourceType.YouTubeShortlink => "youtube-shortlink",
            SourceType.BilibiliVideo => "bilibili-video",
            SourceType.BilibiliShort => "bilibili-short",
            SourceType.BilibiliPart => "bilibili-part",
            SourceType.BilibiliMultiPart => "bilibili-multi-part",
            SourceType.BilibiliBangumiEpisode => "bilibili-bangumi-episode",
            SourceType.BilibiliBangumiSeason => "bilibili-bangumi-season",
            SourceType.BilibiliMedialist => "bilibili-medialist",
            _ => "unknown"
        };
    }

    private async Task DownloadInternalAsync(bool transcode, MediaFormat? singleFormat, string? kind)
    {
        if (!HasResult)
        {
            SetDownloadStatus("error", "请先解析视频。");
            return;
        }

        if (_currentParseResult is null)
        {
            SetDownloadStatus("error", "当前没有可用的解析结果。");
            return;
        }

        if (singleFormat is null && (SelectedAudio is null || SelectedVideo is null))
        {
            SetDownloadStatus("error", "请先选择音频和视频格式。");
            return;
        }

        if (IsDownloading)
        {
            SetDownloadStatus("info", "已有下载任务正在进行。");
            return;
        }

        try
        {
            IsDownloading = true;
            ResetDownloadTask(transcode ? "正在下载，完成后会自动转码…" : "正在下载已选格式…");

            var request = new DownloadRequest
            {
                Website = SourceTypeText.StartsWith("youtube", StringComparison.OrdinalIgnoreCase) ? "y2b" : "b2b",
                VideoId = _currentParseResult.VideoId,
                SourceUrl = string.IsNullOrWhiteSpace(_currentParseResult.Source)
                    ? UrlInput
                    : _currentParseResult.Source,
                Title = Title,
                PartIndex = SelectedPart?.Id,
                VideoFormatId = singleFormat is null ? SelectedVideo?.FormatId ?? string.Empty : string.Empty,
                AudioFormatId = singleFormat is null ? SelectedAudio?.FormatId ?? string.Empty : string.Empty,
                SingleFormatId = singleFormat?.FormatId ?? string.Empty,
                DownloadMode = kind ?? "full",
                Transcode = transcode,
                OutputDirectory = _paths.TmpDir
            };

            var result = await _ytDlpService.DownloadAsync(request, _config, _paths);
            if (!result.Success)
            {
                SetDownloadStatus("error", result.Error);
                return;
            }

            var safeTitle = FileNameSanitizer.Sanitize(Title, request.VideoId);
            var fileBase = string.IsNullOrWhiteSpace(request.PartIndex) ? safeTitle : $"{safeTitle}-p{request.PartIndex}";
            var scanned = _downloadResultScannerService.Scan(result.OutputDirectory, fileBase, request.DownloadMode, request.Transcode);

            if (transcode)
            {
                SetDownloadStatus("info", "下载完成，正在转码为 H.264 MP4...");
                if (!File.Exists(_paths.FfmpegPath))
                {
                    throw new InvalidOperationException("ffmpeg.exe 缺失，无法执行转码");
                }

                var inputFile = Path.Combine(scanned.OutputDirectory, string.IsNullOrWhiteSpace(scanned.VideoFile) ? scanned.MainFile : scanned.VideoFile);
                var audioFile = string.IsNullOrWhiteSpace(scanned.AudioFile) ? null : Path.Combine(scanned.OutputDirectory, scanned.AudioFile);
                var outputFile = Path.Combine(scanned.OutputDirectory, $"{fileBase}-h264.mp4");
                var transcodedPath = await _ffmpegService.TranscodeToH264Async(_paths.FfmpegPath, inputFile, audioFile, outputFile, _config.TaskTimeout.Download);
                scanned = scanned.WithTranscoded(Path.GetFileName(transcodedPath), Path.GetFileName(transcodedPath));
            }

            DownloadTask.HasResult = true;
            DownloadTask.IsSuccess = scanned.Success;
            DownloadTask.StatusKind = scanned.Success ? "success" : "error";
            DownloadTask.StatusText = scanned.Success ? "下载完成" : "下载失败";
            DownloadTask.OutputDirectory = scanned.OutputDirectory;
            DownloadTask.MainFile = scanned.MainFile;
            DownloadTask.AudioFile = scanned.AudioFile;
            DownloadTask.VideoFile = scanned.VideoFile;
            DownloadTask.MetadataFile = scanned.MetadataFile;
            DownloadTask.ThumbnailFile = scanned.ThumbnailFile;
            DownloadTask.TranscodedFile = scanned.TranscodedFile;
            DownloadTask.StatusText = scanned.Success ? transcode ? "下载并转码完成" : "下载完成" : "下载失败";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Download command failed");
            SetDownloadStatus("error", ex.Message);
        }
        finally
        {
            IsDownloading = false;
        }
    }

    private async Task SaveThumbnailInternalAsync()
    {
        try
        {
            var source = ThumbnailUrl;
            if (string.IsNullOrWhiteSpace(source))
            {
                SetDownloadStatus("error", "当前没有可保存的封面。");
                return;
            }
            var videoId = _currentParseResult?.VideoId ?? Title;
            var saved = await _thumbnailService.SaveAsync(source, Title, videoId, _paths.DownloadDir);
            DownloadTask.ThumbnailFile = saved;
            DownloadTask.OutputDirectory = Path.GetDirectoryName(saved) ?? _paths.DownloadDir;
            SetDownloadStatus("success", $"封面已保存：{saved}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Save thumbnail failed");
            SetDownloadStatus("error", ex.Message);
        }
    }
}

file static class DownloadResultExtensions
{
    public static DownloadResult WithTranscoded(this DownloadResult item, string mainFile, string transcodedFile)
    {
        return new DownloadResult
        {
            Success = item.Success,
            Error = item.Error,
            OutputDirectory = item.OutputDirectory,
            MainFile = mainFile,
            AudioFile = item.AudioFile,
            VideoFile = item.VideoFile,
            MetadataFile = item.MetadataFile,
            ThumbnailFile = item.ThumbnailFile,
            TranscodedFile = transcodedFile
        };
    }
}
