using FluentAssertions;
using VideoInstaller.Desktop.Models;
using VideoInstaller.Desktop.Services;

namespace VideoInstaller.Desktop.Tests;

public sealed class UrlParserServiceTests
{
    private readonly UrlParserService _service = new();

    [Fact]
    public void Parse_ShouldRecognizeYouTubeWatch()
    {
        var result = _service.Parse("https://www.youtube.com/watch?v=iwtr3g9Tbrk");

        result.Should().NotBeNull();
        result!.Website.Should().Be("y2b");
        result.VideoId.Should().Be("iwtr3g9Tbrk");
        result.SourceType.Should().Be(SourceType.YouTubeWatch);
    }

    [Fact]
    public void Parse_ShouldRecognizeYouTubeShorts()
    {
        var result = _service.Parse("https://www.youtube.com/shorts/iwtr3g9Tbrk");

        result.Should().NotBeNull();
        result!.SourceType.Should().Be(SourceType.YouTubeShort);
    }

    [Fact]
    public void Parse_ShouldRecognizeYouTubeShortLink()
    {
        var result = _service.Parse("https://youtu.be/iwtr3g9Tbrk");

        result.Should().NotBeNull();
        result!.SourceType.Should().Be(SourceType.YouTubeShortlink);
    }

    [Fact]
    public void Parse_ShouldRecognizeBilibiliBvAndPart()
    {
        var result = _service.Parse("https://www.bilibili.com/video/BV1xx411c7mD?p=2");

        result.Should().NotBeNull();
        result!.Website.Should().Be("b2b");
        result.VideoId.Should().Be("BV1xx411c7mD");
        result.Part.Should().Be("2");
    }

    [Fact]
    public void Parse_ShouldRecognizeBangumiEpisode()
    {
        var result = _service.Parse("https://www.bilibili.com/bangumi/play/ep123456");

        result.Should().NotBeNull();
        result!.SourceType.Should().Be(SourceType.BilibiliBangumiEpisode);
    }

    [Fact]
    public void Parse_ShouldRecognizeBangumiSeason()
    {
        var result = _service.Parse("https://www.bilibili.com/bangumi/play/ss123456");

        result.Should().NotBeNull();
        result!.SourceType.Should().Be(SourceType.BilibiliBangumiSeason);
    }

    [Fact]
    public void Parse_ShouldRecognizeMediaList()
    {
        var result = _service.Parse("https://www.bilibili.com/medialist/play/ml123456");

        result.Should().NotBeNull();
        result!.SourceType.Should().Be(SourceType.BilibiliMedialist);
    }

    [Fact]
    public void Parse_ShouldRecognizeB23ShortUrl()
    {
        var result = _service.Parse("https://b23.tv/abc123");

        result.Should().NotBeNull();
        result!.SourceType.Should().Be(SourceType.BilibiliShort);
    }

    [Fact]
    public void Parse_ShouldReturnNullForUnsupportedUrl()
    {
        _service.Parse("https://example.com/video/123").Should().BeNull();
    }
}
