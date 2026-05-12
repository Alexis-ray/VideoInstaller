using System.Windows;
using VideoInstaller.Desktop.ViewModels;

namespace VideoInstaller.Desktop;

public partial class MainWindow : Window
{
    public MainWindow(MainViewModel viewModel)
    {
        InitializeComponent();
        DataContext = viewModel;
    }
}
