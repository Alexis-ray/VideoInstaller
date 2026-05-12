using System.IO;
using VideoInstaller.Desktop.Models;

namespace VideoInstaller.Desktop.Services;

public sealed class CookieService
{
    private static readonly string[] Template =
    {
        "# Netscape HTTP Cookie File",
        "# Replace this file with exported browser cookies if needed.",
        string.Empty
    };

    public void EnsureCookieFile(RuntimePaths paths)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(paths.CookiePath)!);

        if (!File.Exists(paths.CookiePath))
        {
            File.WriteAllLines(paths.CookiePath, Template);
        }
    }

    public (bool readable, string message) CheckReadable(RuntimePaths paths)
    {
        try
        {
            using var stream = File.Open(paths.CookiePath, FileMode.OpenOrCreate, FileAccess.Read, FileShare.ReadWrite);
            return (true, "OK");
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }
}
