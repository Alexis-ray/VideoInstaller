using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Media3D;

namespace VideoInstaller.Desktop.Views;

public partial class MainView : UserControl
{
    public MainView()
    {
        InitializeComponent();
    }

    private void MainScrollViewer_PreviewMouseWheel(object sender, MouseWheelEventArgs e)
    {
        if (sender is not ScrollViewer scrollViewer)
        {
            return;
        }

        if (e.OriginalSource is DependencyObject source)
        {
            var innerScrollViewer = FindAncestor<ScrollViewer>(source);
            if (innerScrollViewer is not null && !ReferenceEquals(innerScrollViewer, scrollViewer) && innerScrollViewer.ScrollableHeight > 0)
            {
                return;
            }

            if (FindAncestor<DataGrid>(source) is not null)
            {
                return;
            }
        }

        e.Handled = true;
        scrollViewer.ScrollToVerticalOffset(scrollViewer.VerticalOffset - e.Delta);
    }

    private static T? FindAncestor<T>(DependencyObject? current)
        where T : DependencyObject
    {
        while (current is not null)
        {
            if (current is T match)
            {
                return match;
            }

            current = current switch
            {
                Visual visual => VisualTreeHelper.GetParent(visual),
                Visual3D visual3D => VisualTreeHelper.GetParent(visual3D),
                _ => null
            };
        }

        return null;
    }
}
