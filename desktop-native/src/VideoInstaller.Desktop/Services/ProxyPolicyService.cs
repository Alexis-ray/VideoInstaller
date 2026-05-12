using VideoInstaller.Desktop.Models;

namespace VideoInstaller.Desktop.Services;

public sealed class ProxyPolicyService
{
    public string GetProxyForWebsite(string website, AppConfig config)
    {
        return string.Equals(website, "b2b", StringComparison.OrdinalIgnoreCase)
            ? string.Empty
            : (config.Proxy ?? string.Empty).Trim();
    }

    public bool ShouldEnableProxyFallback(string website, AppConfig config)
    {
        return !string.Equals(website, "b2b", StringComparison.OrdinalIgnoreCase)
            && config.ProxyFallbackDirect;
    }

    public IReadOnlyList<string> GetSiteYtDlpArgs(string website)
    {
        return string.Equals(website, "b2b", StringComparison.OrdinalIgnoreCase)
            ? ["--add-header", "Referer: https://www.bilibili.com", "--add-header", "Origin: https://www.bilibili.com"]
            : [];
    }
}
