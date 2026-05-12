namespace VideoInstaller.Desktop.Models;

public sealed class ToolStatus
{
    public string Name { get; init; } = string.Empty;

    public bool Ok { get; init; }

    public string Path { get; init; } = string.Empty;

    public string Version { get; init; } = string.Empty;

    public string Message { get; init; } = string.Empty;
}
