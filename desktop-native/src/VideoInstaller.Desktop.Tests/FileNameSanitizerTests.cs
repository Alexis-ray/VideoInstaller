using FluentAssertions;
using VideoInstaller.Desktop.Utils;

namespace VideoInstaller.Desktop.Tests;

public sealed class FileNameSanitizerTests
{
    [Fact]
    public void Sanitize_ShouldReplaceInvalidCharacters()
    {
        var result = FileNameSanitizer.Sanitize("a<b>:c/d\\e|f?g*h");

        result.Should().Be("a_b__c_d\\e_f_g_h");
    }

    [Fact]
    public void Sanitize_ShouldUseFallbackForEmptyInput()
    {
        var result = FileNameSanitizer.Sanitize("   ", "video-id");

        result.Should().Be("video-id");
    }

    [Fact]
    public void Sanitize_ShouldProtectReservedNames()
    {
        var result = FileNameSanitizer.Sanitize("CON");

        result.Should().Be("_CON");
    }
}
