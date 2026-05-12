using FluentAssertions;
using VideoInstaller.Desktop.Services;

namespace VideoInstaller.Desktop.Tests;

public sealed class FolderServiceTests
{
    [Fact]
    public void OpenFolder_ShouldRejectPathOutsideTmpRoot()
    {
        var service = new FolderService();
        var tmpRoot = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        var outside = Environment.GetFolderPath(Environment.SpecialFolder.Windows);

        var action = () => service.OpenFolder(outside, tmpRoot);

        action.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void OpenFolder_ShouldRejectPrefixBypassPath()
    {
        var service = new FolderService();
        var tmpRoot = Path.Combine(Path.GetTempPath(), "tmp-root");
        var bypass = Path.Combine(Path.GetTempPath(), "tmp-root-other");

        var action = () => service.OpenFolder(bypass, tmpRoot);

        action.Should().Throw<InvalidOperationException>();
    }
}
