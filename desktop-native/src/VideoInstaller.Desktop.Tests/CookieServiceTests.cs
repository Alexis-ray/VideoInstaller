using FluentAssertions;
using VideoInstaller.Desktop.Models;
using VideoInstaller.Desktop.Services;

namespace VideoInstaller.Desktop.Tests;

public sealed class CookieServiceTests
{
    [Fact]
    public void EnsureCookieFile_ShouldCreateTemplate()
    {
        var root = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);

        try
        {
            var service = new CookieService();
            var paths = new RuntimePaths
            {
                CookiePath = Path.Combine(root, "cookies.txt")
            };

            service.EnsureCookieFile(paths);

            File.Exists(paths.CookiePath).Should().BeTrue();
            File.ReadAllText(paths.CookiePath).Should().Contain("Netscape HTTP Cookie File");
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }
}
