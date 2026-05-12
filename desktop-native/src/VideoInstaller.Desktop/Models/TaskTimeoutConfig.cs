namespace VideoInstaller.Desktop.Models;

public sealed class TaskTimeoutConfig
{
    public int Parse { get; set; } = 60000;

    public int Download { get; set; } = 3600000;
}
