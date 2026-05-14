namespace VideoInstaller.Desktop.Models;

public sealed class BrowserCookieRefreshResult
{
    public bool Success { get; init; }

    public string Browser { get; init; } = string.Empty;

    public string Message { get; init; } = string.Empty;

    public IReadOnlyList<string> Attempts { get; init; } = Array.Empty<string>();
}
