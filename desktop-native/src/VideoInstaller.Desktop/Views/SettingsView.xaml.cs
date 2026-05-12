using System.Windows.Controls;
using System.Windows.Input;

namespace VideoInstaller.Desktop.Views;

public partial class SettingsView : UserControl
{
    public SettingsView()
    {
        InitializeComponent();
    }

    private void SettingsScrollViewer_PreviewMouseWheel(object sender, MouseWheelEventArgs e)
    {
        if (sender is not ScrollViewer scrollViewer)
        {
            return;
        }

        e.Handled = true;
        scrollViewer.ScrollToVerticalOffset(scrollViewer.VerticalOffset - e.Delta);
    }
}
