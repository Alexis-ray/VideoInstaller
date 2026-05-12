using System.Diagnostics;
using System.IO;

namespace VideoInstaller.Desktop.Services;

public sealed class FolderService
{
    public void OpenFolder(string path, string tmpRoot)
    {
        var targetPath = File.Exists(path) ? Path.GetDirectoryName(path)! : path;
        var normalizedTarget = NormalizePath(targetPath);
        var normalizedRoot = NormalizePath(tmpRoot);
        var prefix = normalizedRoot + Path.DirectorySeparatorChar;

        if (!string.Equals(normalizedTarget, normalizedRoot, StringComparison.OrdinalIgnoreCase)
            && !normalizedTarget.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("仅允许打开 tmp 目录下的文件夹");
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
