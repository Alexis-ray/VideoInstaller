using System.Net;
using System.Net.Http;

namespace VideoInstaller.Desktop.Services;

public sealed class BilibiliShortUrlResolver
{
    public async Task<string> ResolveAsync(string shortUrl, int timeoutMilliseconds, CancellationToken cancellationToken = default)
    {
        var current = shortUrl?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(current))
        {
            throw new InvalidOperationException("短链为空");
        }

        for (var i = 0; i < 6; i++)
        {
            var result = await RequestAsync(current, timeoutMilliseconds, cancellationToken);
            if (string.IsNullOrWhiteSpace(result.location))
            {
                return string.IsNullOrWhiteSpace(result.finalUrl) ? current : result.finalUrl;
            }

            current = result.location;
        }

        return current;
    }

    private static async Task<(string location, string finalUrl)> RequestAsync(string inputUrl, int timeoutMilliseconds, CancellationToken cancellationToken)
    {
        if (!Uri.TryCreate(inputUrl, UriKind.Absolute, out var targetUri))
        {
            throw new InvalidOperationException("无效URL");
        }

        using var handler = new HttpClientHandler { AllowAutoRedirect = false, AutomaticDecompression = DecompressionMethods.All };
        using var client = new HttpClient(handler) { Timeout = TimeSpan.FromMilliseconds(Math.Max(1000, timeoutMilliseconds)) };
        using var request = new HttpRequestMessage(HttpMethod.Get, targetUri);
        request.Headers.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) VideoInstaller/1.1");
        request.Headers.Accept.ParseAdd("*/*");

        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        if ((int)response.StatusCode is >= 300 and < 400 && response.Headers.Location is not null)
        {
            return (new Uri(targetUri, response.Headers.Location).ToString(), targetUri.ToString());
        }

        return (string.Empty, targetUri.ToString());
    }
}
