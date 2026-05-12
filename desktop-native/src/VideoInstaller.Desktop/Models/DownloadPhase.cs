namespace VideoInstaller.Desktop.Models;

public enum DownloadPhase
{
    Idle = 0,
    Downloading,
    Transcoding,
    Completed,
    Failed
}
