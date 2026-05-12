using System.Text.Json;
using FluentAssertions;
using VideoInstaller.Desktop.Services;

namespace VideoInstaller.Desktop.Tests;

public sealed class FormatMapperServiceTests
{
    [Fact]
    public void ParseFormats_ShouldSplitAudioAndVideoAndPickBest()
    {
        using var document = JsonDocument.Parse("""
        [
          {"format_id":"140","ext":"m4a","audio_ext":"m4a","abr":130,"format_note":"medium","filesize":250000},
          {"format_id":"251","ext":"webm","audio_ext":"webm","abr":121,"format_note":"medium","filesize":220000},
          {"format_id":"299","ext":"mp4","video_ext":"mp4","vcodec":"avc1.64002a","resolution":"1080x1920","height":1920,"vbr":4253,"fps":60,"format_note":"1080p60","filesize":7770000},
          {"format_id":"298","ext":"mp4","video_ext":"mp4","vcodec":"avc1.4d4020","resolution":"720x1280","height":1280,"vbr":2706,"fps":60,"format_note":"720p60","filesize":4940000}
        ]
        """);

        var service = new FormatMapperService();
        var (audios, videos) = service.ParseFormats(document.RootElement);

        audios.Should().HaveCount(2);
        videos.Should().HaveCount(2);
        audios.Single(item => item.IsBest).FormatId.Should().Be("140");
        videos.Single(item => item.IsBest).FormatId.Should().Be("299");
    }

    [Fact]
    public void BuildPartsFromEntries_ShouldBuildMultiPartList()
    {
        using var document = JsonDocument.Parse("""
        [
          {"title":"Part 1","webpage_url":"https://www.bilibili.com/video/BV1xx411c7mD?p=1"},
          {"title":"Part 2","webpage_url":"https://www.bilibili.com/video/BV1xx411c7mD?p=2"}
        ]
        """);

        var service = new FormatMapperService();
        var parts = service.BuildPartsFromEntries(document.RootElement, "https://www.bilibili.com/video/BV1xx411c7mD");

        parts.Should().HaveCount(2);
        parts[0].DisplayName.Should().Be("P1 - Part 1");
        parts[1].Url.Should().Contain("p=2");
    }
}
