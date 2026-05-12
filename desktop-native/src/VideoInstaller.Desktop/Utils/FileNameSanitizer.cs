using System.Text.RegularExpressions;

namespace VideoInstaller.Desktop.Utils;

public static class FileNameSanitizer
{
    private static readonly Regex InvalidCharsRegex = new("[<>:\"/\\|?*\\x00-\\x1F]", RegexOptions.Compiled);
    private static readonly Regex WhitespaceRegex = new("\\s+", RegexOptions.Compiled);
    private static readonly HashSet<string> ReservedNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "CON", "PRN", "AUX", "NUL",
        "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
        "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
    };

    public static string Sanitize(string? value, string fallback = "video", int maxLength = 120)
    {
        var text = string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
        text = InvalidCharsRegex.Replace(text, "_");
        text = WhitespaceRegex.Replace(text, " ").Trim().TrimEnd('.', ' ');

        if (string.IsNullOrWhiteSpace(text))
        {
            text = fallback;
        }

        if (ReservedNames.Contains(text))
        {
            text = $"_{text}";
        }

        if (text.Length > maxLength)
        {
            text = text[..maxLength].TrimEnd('.', ' ');
        }

        return string.IsNullOrWhiteSpace(text) ? fallback : text;
    }
}
