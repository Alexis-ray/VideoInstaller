using FluentAssertions;
using VideoInstaller.Desktop.Services;

namespace VideoInstaller.Desktop.Tests;

public sealed class DownloadResultScannerServiceTests
{
    [Fact]
    public void Scan_ShouldFindMainAndMetadataFiles()
    {
        var root = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);

        try
        {
            File.WriteAllText(Path.Combine(root, "Sample.mp4"), "x");
            File.WriteAllText(Path.Combine(root, "Sample.info.json"), "{}");
            File.WriteAllText(Path.Combine(root, "cover.jpg"), "x");

            var service = new DownloadResultScannerService();
            var result = service.Scan(root, "Sample", "full", false);

            result.Success.Should().BeTrue();
            result.MainFile.Should().Be("Sample.mp4");
            result.MetadataFile.Should().Be("Sample.info.json");
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }

    [Fact]
    public void Scan_ShouldIgnoreUnrelatedOldFiles()
    {
        var root = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);

        try
        {
            File.WriteAllText(Path.Combine(root, "SampleOld-h264.mp4"), "x");
            File.WriteAllText(Path.Combine(root, "Sample.f140.m4a"), "x");
            File.WriteAllText(Path.Combine(root, "Sample.f299.mp4"), "x");
            File.WriteAllText(Path.Combine(root, "Sample.info.json"), "{}");

            var service = new DownloadResultScannerService();
            var result = service.Scan(root, "Sample", "full", false);

            result.TranscodedFile.Should().BeEmpty();
            result.MetadataFile.Should().Be("Sample.info.json");
            result.MainFile.Should().NotBe("SampleOld-h264.mp4");
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }

    [Fact]
    public void Scan_ShouldUseAudioFileAsMainForAudioMode()
    {
        var root = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);

        try
        {
            File.WriteAllText(Path.Combine(root, "Sample.f140.m4a"), "x");
            File.WriteAllText(Path.Combine(root, "Sample.f299.mp4"), "x");

            var result = new DownloadResultScannerService().Scan(root, "Sample", "audio", false);

            result.Success.Should().BeTrue();
            result.MainFile.Should().Be("Sample.f140.m4a");
            result.AudioFile.Should().Be("Sample.f140.m4a");
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }

    [Fact]
    public void Scan_ShouldUseVideoFileAsMainForVideoMode()
    {
        var root = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);

        try
        {
            File.WriteAllText(Path.Combine(root, "Sample.f140.m4a"), "x");
            File.WriteAllText(Path.Combine(root, "Sample.f299.mp4"), "x");

            var result = new DownloadResultScannerService().Scan(root, "Sample", "video", false);

            result.Success.Should().BeTrue();
            result.MainFile.Should().Be("Sample.f299.mp4");
            result.VideoFile.Should().Be("Sample.f299.mp4");
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }

    [Fact]
    public void Scan_ShouldPreferTranscodedFileWhenTranscodeIsTrue()
    {
        var root = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);

        try
        {
            File.WriteAllText(Path.Combine(root, "Sample.f140.m4a"), "x");
            File.WriteAllText(Path.Combine(root, "Sample.f299.mp4"), "x");
            File.WriteAllText(Path.Combine(root, "Sample-h264.mp4"), "x");

            var result = new DownloadResultScannerService().Scan(root, "Sample", "full", true);

            result.Success.Should().BeTrue();
            result.MainFile.Should().Be("Sample-h264.mp4");
            result.TranscodedFile.Should().Be("Sample-h264.mp4");
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }
}
