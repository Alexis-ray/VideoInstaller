namespace VideoInstaller.Desktop.Models;

public sealed class VideoPart
{
    public int Index { get; init; }

    public string Id { get; init; } = string.Empty;

    public string Title { get; init; } = string.Empty;

    public string Url { get; init; } = string.Empty;

    public string DisplayName => $"P{Index} - {Title}";
}
