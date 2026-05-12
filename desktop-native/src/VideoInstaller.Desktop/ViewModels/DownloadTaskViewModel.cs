using CommunityToolkit.Mvvm.ComponentModel;
using System.Windows.Media;

namespace VideoInstaller.Desktop.ViewModels;

public partial class DownloadTaskViewModel : ObservableObject
{
    [ObservableProperty]
    private bool hasResult;

    [ObservableProperty]
    private bool isSuccess;

    [ObservableProperty]
    private string statusKind = "info";

    [ObservableProperty]
    private string statusText = string.Empty;

    [ObservableProperty]
    private string outputDirectory = string.Empty;

    [ObservableProperty]
    private string mainFile = string.Empty;

    [ObservableProperty]
    private string audioFile = string.Empty;

    [ObservableProperty]
    private string videoFile = string.Empty;

    [ObservableProperty]
    private string metadataFile = string.Empty;

    [ObservableProperty]
    private string thumbnailFile = string.Empty;

    [ObservableProperty]
    private string transcodedFile = string.Empty;

    public Brush StatusBackground => StatusKind switch
    {
        "success" => new SolidColorBrush((Color)ColorConverter.ConvertFromString("#EDF8EF")),
        "error" => new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FFF3F3")),
        _ => new SolidColorBrush((Color)ColorConverter.ConvertFromString("#EEF6FF"))
    };

    public Brush StatusForeground => StatusKind switch
    {
        "success" => new SolidColorBrush((Color)ColorConverter.ConvertFromString("#1D5F2A")),
        "error" => new SolidColorBrush((Color)ColorConverter.ConvertFromString("#9F1D1D")),
        _ => new SolidColorBrush((Color)ColorConverter.ConvertFromString("#194B80"))
    };

    partial void OnStatusKindChanged(string value)
    {
        OnPropertyChanged(nameof(StatusBackground));
        OnPropertyChanged(nameof(StatusForeground));
    }
}
