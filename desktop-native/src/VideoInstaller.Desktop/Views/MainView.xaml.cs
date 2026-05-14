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
            if (innerScrollViewer is not null
                && !ReferenceEquals(innerScrollViewer, scrollViewer)
                && innerScrollViewer.ScrollableHeight > 0
                && CanScrollInDirection(innerScrollViewer, e.Delta))
            {
                return;
            }

            var dataGrid = FindAncestor<DataGrid>(source);
            if (dataGrid is not null)
            {
                var dataGridScrollViewer = FindDescendantScrollViewer(dataGrid);
                if (dataGridScrollViewer is not null && dataGridScrollViewer.ScrollableHeight > 0 && CanScrollInDirection(dataGridScrollViewer, e.Delta))
                {
                    return;
                }
            }
        }

        e.Handled = true;
        scrollViewer.ScrollToVerticalOffset(scrollViewer.VerticalOffset - e.Delta);
    }

    private static bool CanScrollInDirection(ScrollViewer scrollViewer, int delta)
    {
        if (scrollViewer.ScrollableHeight <= 0)
        {
            return false;
        }

        return delta > 0
            ? scrollViewer.VerticalOffset > 0
            : scrollViewer.VerticalOffset < scrollViewer.ScrollableHeight;
    }

    private static ScrollViewer? FindDescendantScrollViewer(DependencyObject current)
    {
        for (var index = 0; index < VisualTreeHelper.GetChildrenCount(current); index++)
        {
            var child = VisualTreeHelper.GetChild(current, index);
            if (child is ScrollViewer scrollViewer)
            {
                return scrollViewer;
            }

            var nested = FindDescendantScrollViewer(child);
            if (nested is not null)
            {
                return nested;
            }
        }

        return null;
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
