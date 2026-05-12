namespace VideoInstaller.Desktop.Utils;

public static class SizeFormatter
{
    public static string FormatBytes(long? bytes)
    {
        if (bytes is null || bytes < 0)
        {
            return "未知";
        }

        var value = (double)bytes.Value;
        var units = new[] { "B", "KB", "MB", "GB", "TB" };
        var index = 0;

        while (value >= 1024 && index < units.Length - 1)
        {
            value /= 1024;
            index++;
        }

        return index == 0 ? $"{value:0}{units[index]}" : $"{value:0.##}{units[index]}";
    }
}
