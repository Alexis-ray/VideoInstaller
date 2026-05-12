using FluentAssertions;
using VideoInstaller.Desktop.Utils;

namespace VideoInstaller.Desktop.Tests;

public sealed class SizeFormatterTests
{
    [Theory]
    [InlineData(0, "0B")]
    [InlineData(1024, "1KB")]
    [InlineData(1536, "1.5KB")]
    [InlineData(1048576, "1MB")]
    public void FormatBytes_ShouldFormatExpectedValues(long bytes, string expected)
    {
        SizeFormatter.FormatBytes(bytes).Should().Be(expected);
    }

    [Fact]
    public void FormatBytes_ShouldReturnUnknownForNegative()
    {
        SizeFormatter.FormatBytes(-1).Should().Be("未知");
    }
}
