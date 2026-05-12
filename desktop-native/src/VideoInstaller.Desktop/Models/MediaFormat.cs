namespace VideoInstaller.Desktop.Models;

public sealed class MediaFormat
{
    public string FormatId { get; init; } = string.Empty;

    public string Ext { get; init; } = string.Empty;

    public string Kind { get; init; } = string.Empty;

    public string Resolution { get; init; } = string.Empty;

    public int Width { get; init; }

    public int Height { get; init; }

    public string VideoCodec { get; init; } = string.Empty;

    public string AudioCodec { get; init; } = string.Empty;

    public double Bitrate { get; init; }

    public long? FileSize { get; init; }

    public string FileSizeText { get; init; } = string.Empty;

    public string Description { get; init; } = string.Empty;

    public string ContainerText { get; init; } = string.Empty;

    public string BitrateText { get; init; } = string.Empty;

    public string FrameText { get; init; } = string.Empty;

    public bool IsBest { get; init; }

    public string RawJson { get; init; } = string.Empty;

    public string SelectionDisplayText
    {
        get
        {
            var parts = new[]
            {
                FormatId,
                string.IsNullOrWhiteSpace(Resolution) ? null : Resolution,
                string.IsNullOrWhiteSpace(ContainerText) ? Ext : ContainerText,
                string.IsNullOrWhiteSpace(BitrateText) ? null : BitrateText,
                string.IsNullOrWhiteSpace(FileSizeText) ? null : FileSizeText,
                string.IsNullOrWhiteSpace(VideoCodec) || VideoCodec == "none" ? null : $"v:{VideoCodec}",
                string.IsNullOrWhiteSpace(AudioCodec) || AudioCodec == "none" ? null : $"a:{AudioCodec}"
            };

            return string.Join(" | ", parts.Where(part => !string.IsNullOrWhiteSpace(part)));
        }
    }
}
