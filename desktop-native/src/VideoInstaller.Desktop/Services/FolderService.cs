using System.Diagnostics;
using System.IO;

namespace VideoInstaller.Desktop.Services;

public sealed class FolderService
{
    public void OpenFolder(string path, params string[] allowedRoots)
    {
        var targetPath = File.Exists(path) ? Path.GetDirectoryName(path)! : path;
        var normalizedTarget = NormalizePath(targetPath);
        var normalizedRoots = allowedRoots
            .Where(root => !string.IsNullOrWhiteSpace(root))
            .Select(NormalizePath)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var isAllowed = normalizedRoots.Any(root =>
        {
            var prefix = root + Path.DirectorySeparatorChar;
            return string.Equals(normalizedTarget, root, StringComparison.OrdinalIgnoreCase)
                || normalizedTarget.StartsWith(prefix, StringComparison.OrdinalIgnoreCase);
        });

        if (!isAllowed)
        {
            throw new InvalidOperationException("仅允许打开下载目录或临时目录下的文件夹");
        }

        if (!Directory.Exists(targetPath))
        {
            throw new DirectoryNotFoundException("目标文件夹不存在");
        }

        Process.Start(new ProcessStartInfo
        {
            FileName = "explorer.exe",
            Arguments = targetPath,
            UseShellExecute = true
        });
    }

    private static string NormalizePath(string path)
    {
        return Path.GetFullPath(path)
            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
            .ToLowerInvariant();
    }
}
