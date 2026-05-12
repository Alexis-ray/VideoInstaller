using System.IO;
using VideoInstaller.Desktop.Models;

namespace VideoInstaller.Desktop.Services;

public sealed class DownloadResultScannerService
{
    public DownloadResult Scan(string downloadDir, string fileBase, string downloadMode = "full", bool transcode = false)
    {
        if (!Directory.Exists(downloadDir))
        {
            return new DownloadResult { Success = false, Error = "输出目录不存在", OutputDirectory = downloadDir };
        }

        var prefix = $"{fileBase}.";
        var ignored = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".json", ".txt", ".description", ".part", ".ytdl", ".tmp", ".temp" };
        var files = Directory.GetFiles(downloadDir)
            .Select(path => new FileInfo(path))
            .Where(file => file.Name.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
                || file.Name.Equals($"{fileBase}-h264.mp4", StringComparison.OrdinalIgnoreCase)
                || file.Name.Equals($"{fileBase}.info.json", StringComparison.OrdinalIgnoreCase)
                || file.Name.StartsWith("cover.", StringComparison.OrdinalIgnoreCase))
            .Where(file => !file.Name.EndsWith(".info.json", StringComparison.OrdinalIgnoreCase) ? !ignored.Contains(file.Extension) : true)
            .OrderByDescending(file => file.LastWriteTimeUtc)
            .ToList();

        var metadata = Directory.GetFiles(downloadDir, $"{fileBase}.info.json").Select(Path.GetFileName).FirstOrDefault() ?? string.Empty;
        var cover = Directory.GetFiles(downloadDir, "cover.*").Select(Path.GetFileName).FirstOrDefault() ?? string.Empty;
        var transcoded = Directory.GetFiles(downloadDir, $"{fileBase}-h264.mp4").Select(Path.GetFileName).FirstOrDefault() ?? string.Empty;
        var mediaFiles = files
            .Where(file => !file.Name.EndsWith(".info.json", StringComparison.OrdinalIgnoreCase) && !file.Name.StartsWith("cover.", StringComparison.OrdinalIgnoreCase))
            .ToList();
        var audioFile = mediaFiles.FirstOrDefault(IsAudioFile)?.Name ?? string.Empty;
        var videoFile = mediaFiles.FirstOrDefault(IsVideoFile)?.Name ?? string.Empty;
        var fullFile = mediaFiles.FirstOrDefault(file => !IsLikelySingleStream(file))?.Name
            ?? mediaFiles.FirstOrDefault()?.Name
            ?? string.Empty;
        var mode = string.IsNullOrWhiteSpace(downloadMode) ? "full" : downloadMode;
        var mainFile = mode switch
        {
            "audio" => audioFile,
            "video" => videoFile,
            _ when transcode && !string.IsNullOrWhiteSpace(transcoded) => transcoded,
            _ => fullFile
        };

        return new DownloadResult
        {
            Success = !string.IsNullOrWhiteSpace(mainFile),
            OutputDirectory = downloadDir,
            MainFile = mainFile,
            AudioFile = audioFile,
            VideoFile = videoFile,
            MetadataFile = metadata,
            ThumbnailFile = cover,
            TranscodedFile = transcoded
        };
    }

    private static bool IsAudioFile(FileInfo file)
    {
        return file.Extension.Equals(".m4a", StringComparison.OrdinalIgnoreCase)
            || file.Extension.Equals(".aac", StringComparison.OrdinalIgnoreCase)
            || file.Extension.Equals(".mp3", StringComparison.OrdinalIgnoreCase)
            || file.Extension.Equals(".opus", StringComparison.OrdinalIgnoreCase)
            || file.Extension.Equals(".ogg", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsVideoFile(FileInfo file)
    {
        return file.Extension.Equals(".mp4", StringComparison.OrdinalIgnoreCase)
            || file.Extension.Equals(".mkv", StringComparison.OrdinalIgnoreCase)
            || file.Extension.Equals(".webm", StringComparison.OrdinalIgnoreCase)
            || file.Extension.Equals(".mov", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsLikelySingleStream(FileInfo file)
    {
        return file.Name.Contains(".f", StringComparison.OrdinalIgnoreCase) || IsAudioFile(file);
    }
}
