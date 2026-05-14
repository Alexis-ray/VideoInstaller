using System.IO;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using VideoInstaller.Desktop.Models;
using VideoInstaller.Desktop.Utils;

namespace VideoInstaller.Desktop.Services;

public sealed class YtDlpService
{
    private static readonly string[] BrowserCookieCandidates = ["edge", "chrome", "firefox", "brave", "chromium"];
    private const string CookieProbeUrl = "https://www.youtube.com/watch?v=BaW_jenozKc";

    private readonly ProcessRunner _processRunner;
    private readonly ProxyPolicyService _proxyPolicyService;
    private readonly FormatMapperService _formatMapperService;
    private readonly ILogger<YtDlpService> _logger;

    public YtDlpService(
        ProcessRunner processRunner,
        ProxyPolicyService proxyPolicyService,
        FormatMapperService formatMapperService,
        ILogger<YtDlpService> logger)
    {
        _processRunner = processRunner;
        _proxyPolicyService = proxyPolicyService;
        _formatMapperService = formatMapperService;
        _logger = logger;
    }

    public async Task<BrowserCookieRefreshResult> RefreshCookiesFromBrowserAsync(AppConfig config, RuntimePaths paths, CancellationToken cancellationToken = default)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(paths.CookiePath)!);

        byte[]? originalCookieBytes = null;
        if (File.Exists(paths.CookiePath))
        {
            originalCookieBytes = await File.ReadAllBytesAsync(paths.CookiePath, cancellationToken);
        }

        var attempts = new List<string>();
        foreach (var browser in BrowserCookieCandidates)
        {
            RestoreCookieFile(paths, originalCookieBytes);

            var args = BuildBaseArgs(paths);
            args.AddRange([
                "--cookies-from-browser", browser,
                "--cookies", paths.CookiePath,
                "--no-warnings",
                "--skip-download",
                CookieProbeUrl
            ]);

            var proxy = _proxyPolicyService.GetProxyForWebsite("y2b", config);
            var result = await RunParseAsync(
                paths.YtDlpPath,
                args,
                Array.Empty<string>(),
                Array.Empty<string>(),
                proxy,
                _proxyPolicyService.ShouldEnableProxyFallback("y2b", config),
                config.TaskTimeout.Parse,
                cancellationToken);

            if (result.ExitCode == 0 && HasUsableCookie(paths.CookiePath))
            {
                _logger.LogInformation("Cookie refresh succeeded with browser {Browser} into {CookiePath}", browser, paths.CookiePath);
                return new BrowserCookieRefreshResult
                {
                    Success = true,
                    Browser = browser,
                    Attempts = attempts,
                    Message = $"已通过 {browser} 重新自动获取 Cookie，并更新到 {paths.CookiePath}。你现在可以直接重新解析或下载。"
                };
            }

            var error = FormatCookieRefreshError(result.StandardError, result.StandardOutput);
            attempts.Add($"{browser}: {error}");
            _logger.LogWarning("Cookie refresh failed with browser {Browser}. Error={Error}", browser, error);
        }

        RestoreCookieFile(paths, originalCookieBytes);
        return new BrowserCookieRefreshResult
        {
            Success = false,
            Attempts = attempts,
            Message = "未能从已安装浏览器重新自动获取 Cookie。已尝试："
                + string.Join("；", attempts)
                + $"。你仍可在设置页手动指定已导出的 Netscape Cookie 文件：{paths.CookiePath}"
        };
    }

    public async Task<VideoParseResult> ParseAsync(ParsedVideoUrl target, AppConfig config, RuntimePaths paths, CancellationToken cancellationToken = default)
    {
        var inputUrl = target.SourceUrl;
        var args = BuildBaseArgs(paths);
        args.AddRange(["--print-json", "--skip-download", inputUrl]);
        var hasUsableCookie = HasUsableCookie(paths.CookiePath);
        var cookieArgs = hasUsableCookie ? new[] { "--cookies", paths.CookiePath } : Array.Empty<string>();
        var siteArgs = _proxyPolicyService.GetSiteYtDlpArgs(target.Website);
        var proxy = _proxyPolicyService.GetProxyForWebsite(target.Website, config);
        var timeout = config.TaskTimeout.Parse;

        _logger.LogInformation(
            "yt-dlp parse start. Website={Website} Cookie={HasCookie} CookiePath={CookiePath} Proxy={HasProxy} SiteArgs={SiteArgs}",
            target.Website,
            hasUsableCookie,
            paths.CookiePath,
            !string.IsNullOrWhiteSpace(proxy),
            string.Join(" ", siteArgs));

        var result = await RunParseAsync(paths.YtDlpPath, args, cookieArgs, siteArgs, proxy, _proxyPolicyService.ShouldEnableProxyFallback(target.Website, config), timeout, cancellationToken);
        if (result.ExitCode != 0)
        {
            return new VideoParseResult { Success = false, Error = FormatYtDlpError(result.StandardError, paths) };
        }

        var jsonLine = ParseAnyJsonLine(result.StandardOutput);
        if (string.IsNullOrWhiteSpace(jsonLine))
        {
            return new VideoParseResult { Success = false, Error = "未返回可解析 JSON" };
        }

        using var document = JsonDocument.Parse(jsonLine);
        var root = document.RootElement;
        var playable = ResolvePlayableInfo(root, target.Part);
        if (playable.info.ValueKind == JsonValueKind.Undefined)
        {
            return new VideoParseResult { Success = false, Error = "未找到可播放格式" };
        }

        var website = target.Website;
        var resolvedVideoId = ResolveVideoId(website, target.VideoId, playable.info, root);
        var source = ResolveDownloadSourceUrl(website, inputUrl, playable.info, root, playable.part);
        var sourceType = DetectSourceType(website, source, playable.part, playable.parts);
        var thumbnail = GetString(playable.info, "thumbnail", GetString(root, "thumbnail"));
        var (audios, videos) = playable.info.TryGetProperty("formats", out var formats)
            ? _formatMapperService.ParseFormats(formats)
            : (new List<MediaFormat>(), new List<MediaFormat>());

        _logger.LogInformation(
            "yt-dlp parse mapped formats. Website={Website} RawCount={RawCount} AudioCount={AudioCount} VideoCount={VideoCount}",
            website,
            playable.info.TryGetProperty("formats", out var rawFormats) && rawFormats.ValueKind == JsonValueKind.Array ? rawFormats.GetArrayLength() : 0,
            audios.Count,
            videos.Count);

        var note = BuildParseNote(target.Website, hasUsableCookie, paths.CookiePath, siteArgs, proxy, audios.Count, videos.Count,
            playable.info.TryGetProperty("formats", out rawFormats) && rawFormats.ValueKind == JsonValueKind.Array ? rawFormats.GetArrayLength() : 0);

        return new VideoParseResult
        {
            Success = true,
            Source = source,
            SourceType = sourceType,
            VideoId = resolvedVideoId,
            Title = GetString(playable.info, "title", GetString(root, "title", "视频信息")),
            ThumbnailUrl = thumbnail,
            ThumbnailCandidates = BuildThumbnailCandidates(website, resolvedVideoId, thumbnail),
            OriginalUrl = target.OriginalUrl,
            CurrentPart = playable.part is null ? null : playable.parts.FirstOrDefault(item => item.Id == playable.part),
            Parts = playable.parts,
            Audios = audios,
            Videos = videos,
            Note = note
        };
    }

    public async Task<DownloadResult> DownloadAsync(DownloadRequest request, AppConfig config, RuntimePaths paths, CancellationToken cancellationToken = default)
    {
        var safeTitle = FileNameSanitizer.Sanitize(request.Title, request.VideoId);
        var outputDir = Path.Combine(paths.DownloadDir, safeTitle);
        Directory.CreateDirectory(outputDir);
        var fileBase = string.IsNullOrWhiteSpace(request.PartIndex) ? safeTitle : $"{safeTitle}-p{request.PartIndex}";
        var outputTemplate = Path.Combine(outputDir, $"{fileBase}.%(ext)s");

        var args = BuildBaseArgs(paths);
        args.AddRange([
            "--output", outputTemplate,
            "--write-info-json"
        ]);

        if (request.Transcode)
        {
            args.AddRange(["--merge-output-format", "mp4"]);
        }

        if (!string.IsNullOrWhiteSpace(request.SingleFormatId))
        {
            args.AddRange(["-f", request.SingleFormatId]);
        }
        else
        {
            args.AddRange(["-f", $"{request.VideoFormatId}+{request.AudioFormatId}"]);
        }

        args.Add(request.SourceUrl);

        var hasUsableCookie = HasUsableCookie(paths.CookiePath);
        var cookieArgs = hasUsableCookie ? new[] { "--cookies", paths.CookiePath } : Array.Empty<string>();
        var siteArgs = _proxyPolicyService.GetSiteYtDlpArgs(request.Website);
        var proxy = _proxyPolicyService.GetProxyForWebsite(request.Website, config);
        _logger.LogInformation(
            "yt-dlp download start. Website={Website} OutputDir={OutputDir} Cookie={HasCookie} Proxy={HasProxy} Format={Format}",
            request.Website,
            outputDir,
            hasUsableCookie,
            !string.IsNullOrWhiteSpace(proxy),
            string.IsNullOrWhiteSpace(request.SingleFormatId) ? $"{request.VideoFormatId}+{request.AudioFormatId}" : request.SingleFormatId);
        var result = await RunParseAsync(paths.YtDlpPath, args, cookieArgs, siteArgs, proxy, _proxyPolicyService.ShouldEnableProxyFallback(request.Website, config), config.TaskTimeout.Download, cancellationToken);
        if (result.ExitCode != 0)
        {
            return new DownloadResult { Success = false, Error = FormatYtDlpError(result.StandardError, paths), OutputDirectory = outputDir };
        }

        return new DownloadResult { Success = true, OutputDirectory = outputDir, MainFile = fileBase };
    }

    public static List<string> BuildBaseArgs(RuntimePaths paths)
    {
        var args = new List<string>();
        if (File.Exists(paths.JsRuntimePath))
        {
            args.AddRange(["--js-runtimes", $"deno:{paths.JsRuntimePath}"]);
        }

        return args;
    }

    public static string FormatYtDlpError(string stderr, RuntimePaths paths)
    {
        var text = (stderr ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(text))
        {
            return "解析或下载失败。";
        }

        var messages = new List<string>();
        if (text.Contains("Sign in to confirm you're not a bot", StringComparison.OrdinalIgnoreCase)
            || text.Contains("Use --cookies-from-browser or --cookies", StringComparison.OrdinalIgnoreCase))
        {
            messages.Add($"YouTube 触发了登录或真人验证。请把已登录浏览器导出的 Netscape 格式 Cookie 保存到 {paths.CookiePath} 后重试。");
        }

        if (text.Contains("No supported JavaScript runtime could be found", StringComparison.OrdinalIgnoreCase))
        {
            messages.Add($"未检测到 yt-dlp 可用的 JavaScript 运行时。请确认发布包内存在 {paths.JsRuntimePath}。");
        }

        if (text.Contains("EOF occurred in violation of protocol", StringComparison.OrdinalIgnoreCase))
        {
            messages.Add("网络 TLS 连接异常，常见原因是代理不可用、代理证书异常或网络被中间设备拦截。请检查设置页代理配置，未使用代理时保持为空。");
        }

        if (messages.Count == 0)
        {
            return text;
        }

        messages.Add("原始错误：" + text);
        return string.Join(Environment.NewLine, messages);
    }

    private static string FormatCookieRefreshError(string stderr, string stdout)
    {
        var text = string.Join(Environment.NewLine, new[] { stderr, stdout }
                .Where(value => !string.IsNullOrWhiteSpace(value)))
            .Trim();

        if (string.IsNullOrWhiteSpace(text))
        {
            return "未返回可用错误信息";
        }

        var lines = text
            .Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Take(3)
            .ToArray();
        return string.Join(" | ", lines);
    }

    private static void RestoreCookieFile(RuntimePaths paths, byte[]? originalCookieBytes)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(paths.CookiePath)!);

        if (originalCookieBytes is { Length: > 0 })
        {
            File.WriteAllBytes(paths.CookiePath, originalCookieBytes);
            return;
        }

        File.WriteAllLines(paths.CookiePath, CookieService.CookieTemplate);
    }

    private async Task<ProcessRunResult> RunParseAsync(string ytDlpPath, List<string> args, IReadOnlyList<string> cookieArgs, IReadOnlyList<string> siteArgs, string proxy, bool allowFallback, int timeout, CancellationToken cancellationToken)
    {
        var commandArgs = new List<string>();
        commandArgs.AddRange(cookieArgs);
        commandArgs.AddRange(siteArgs);
        commandArgs.AddRange(args);

        if (!string.IsNullOrWhiteSpace(proxy))
        {
            var proxyArgs = new List<string> { "--proxy", proxy };
            proxyArgs.AddRange(commandArgs);
            _logger.LogInformation("yt-dlp parse with proxy for {Url}", args.LastOrDefault());
            var proxyResult = await _processRunner.RunAsync(ytDlpPath, proxyArgs, Path.GetDirectoryName(ytDlpPath), timeout, cancellationToken);
            if (proxyResult.ExitCode == 0 || !allowFallback)
            {
                return proxyResult;
            }

            _logger.LogWarning("yt-dlp proxy request failed, retrying direct connection");
        }

        _logger.LogInformation("yt-dlp parse direct for {Url}", args.LastOrDefault());
        return await _processRunner.RunAsync(ytDlpPath, commandArgs, Path.GetDirectoryName(ytDlpPath), timeout, cancellationToken);
    }

    private static bool HasUsableCookie(string cookiePath)
    {
        return File.Exists(cookiePath)
            && File.ReadLines(cookiePath).Any(line => !string.IsNullOrWhiteSpace(line) && !line.TrimStart().StartsWith('#'));
    }

    private static string BuildParseNote(string website, bool hasUsableCookie, string cookiePath, IReadOnlyList<string> siteArgs, string proxy, int audioCount, int videoCount, int rawCount)
    {
        var siteName = string.Equals(website, "b2b", StringComparison.OrdinalIgnoreCase) ? "Bilibili" : "YouTube";
        var cookieText = hasUsableCookie
            ? $"本次解析已传入 Cookie：{cookiePath}。"
            : $"本次解析未传入有效 Cookie（{cookiePath} 当前为空模板或没有有效内容）。{siteName} 的登录态、会员态或受限清晰度因此可能不会完整显示。";
        var siteArgsText = siteArgs.Count > 0
            ? $"站点附加参数：{string.Join(' ', siteArgs)}。"
            : "当前未使用站点专属 yt-dlp 附加参数。";
        var proxyText = string.IsNullOrWhiteSpace(proxy)
            ? "当前未配置代理，按直连方式解析。"
            : $"当前解析代理：{proxy}。";

        return $"可选择原始格式下载，或转码为 H.264 MP4 下载。原始 formats 数量：{rawCount}；映射后音频 {audioCount} 项、视频 {videoCount} 项。{cookieText}{siteArgsText}{proxyText}";
    }

    private static string? ParseAnyJsonLine(string text)
    {
        var lines = (text ?? string.Empty)
            .Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        for (var index = lines.Length - 1; index >= 0; index--)
        {
            try
            {
                JsonDocument.Parse(lines[index]).Dispose();
                return lines[index];
            }
            catch
            {
            }
        }

        return null;
    }

    private (JsonElement info, string? part, List<VideoPart> parts) ResolvePlayableInfo(JsonElement root, string? requestedPart)
    {
        if (root.TryGetProperty("formats", out var rootFormats) && rootFormats.ValueKind == JsonValueKind.Array && rootFormats.GetArrayLength() > 0)
        {
            var parts = root.TryGetProperty("entries", out var rootEntriesForParts)
                ? _formatMapperService.BuildPartsFromEntries(rootEntriesForParts, GetString(root, "webpage_url", GetString(root, "original_url", GetString(root, "url"))))
                : [];
            return (root.Clone(), NormalizePartNumber(requestedPart, root), parts);
        }

        if (!root.TryGetProperty("entries", out var rootEntries) || rootEntries.ValueKind != JsonValueKind.Array)
        {
            return (default, null, []);
        }

        var entries = rootEntries.EnumerateArray().Where(item => item.ValueKind == JsonValueKind.Object).ToList();
        if (entries.Count == 0)
        {
            return (default, null, []);
        }

        JsonElement? chosen = null;
        if (int.TryParse(requestedPart, out var requestedIndex) && requestedIndex > 0 && requestedIndex <= entries.Count)
        {
            var candidate = entries[requestedIndex - 1];
            if (candidate.TryGetProperty("formats", out var candidateFormats) && candidateFormats.ValueKind == JsonValueKind.Array && candidateFormats.GetArrayLength() > 0)
            {
                chosen = candidate.Clone();
            }
        }

        chosen ??= entries.FirstOrDefault(item => item.TryGetProperty("formats", out var candidateFormats) && candidateFormats.ValueKind == JsonValueKind.Array && candidateFormats.GetArrayLength() > 0).Clone();
        if (chosen.Value.ValueKind == JsonValueKind.Undefined)
        {
            return (default, null, []);
        }

        var partsList = _formatMapperService.BuildPartsFromEntries(rootEntries, GetString(root, "webpage_url", GetString(root, "original_url", GetString(root, "url"))));
        var part = int.TryParse(requestedPart, out var explicitPart) && explicitPart > 0
            ? explicitPart.ToString()
            : ResolveChosenPartNumber(chosen.Value);

        return (chosen.Value.Clone(), string.IsNullOrWhiteSpace(part) ? "1" : part, partsList);
    }

    private static string ResolveChosenPartNumber(JsonElement chosen)
    {
        var pageMatch = System.Text.RegularExpressions.Regex.Match(GetString(chosen, "webpage_url"), "[?&]p=(\\d+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (pageMatch.Success)
        {
            return int.Parse(pageMatch.Groups[1].Value).ToString();
        }

        return GetString(chosen, "episode_number", "1");
    }

    private static string? NormalizePartNumber(string? requestedPart, JsonElement info)
    {
        if (!info.TryGetProperty("entries", out var entries) || entries.ValueKind != JsonValueKind.Array || entries.GetArrayLength() == 0)
        {
            return string.IsNullOrWhiteSpace(requestedPart) ? null : requestedPart;
        }

        if (int.TryParse(requestedPart, out var requested) && requested > 0)
        {
            return requested.ToString();
        }

        var pageMatch = System.Text.RegularExpressions.Regex.Match(GetString(info, "webpage_url"), "[?&]p=(\\d+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        return pageMatch.Success ? int.Parse(pageMatch.Groups[1].Value).ToString() : "1";
    }

    private static string ResolveVideoId(string website, string requestedVideoId, JsonElement info, JsonElement root)
    {
        var requested = (requestedVideoId ?? string.Empty).Trim();
        if (IsValidVideoId(website, requested))
        {
            return requested;
        }

        var infoId = GetString(info, "id");
        if (IsValidVideoId(website, infoId))
        {
            return infoId;
        }

        var rootId = GetString(root, "id");
        return IsValidVideoId(website, rootId) ? rootId : infoId;
    }

    private static string ResolveDownloadSourceUrl(string website, string inputUrl, JsonElement workingInfo, JsonElement rootInfo, string? part)
    {
        if (!string.Equals(website, "b2b", StringComparison.OrdinalIgnoreCase))
        {
            return inputUrl.Trim();
        }

        var candidates = new[]
        {
            GetString(workingInfo, "webpage_url"),
            GetString(rootInfo, "webpage_url"),
            GetString(workingInfo, "original_url"),
            GetString(rootInfo, "original_url"),
            inputUrl.Trim()
        }.Where(text => !string.IsNullOrWhiteSpace(text)).ToList();

        var picked = candidates.FirstOrDefault() ?? string.Empty;
        return string.IsNullOrWhiteSpace(part)
            ? picked
            : System.Text.RegularExpressions.Regex.Replace(picked, "([?&])p=\\d+", "$1", System.Text.RegularExpressions.RegexOptions.IgnoreCase).TrimEnd('?', '&') + (picked.Contains('?') ? $"&p={part}" : $"?p={part}");
    }

    private static SourceType DetectSourceType(string website, string source, string? part, List<VideoPart> parts)
    {
        var text = source.Trim();
        if (string.Equals(website, "y2b", StringComparison.OrdinalIgnoreCase))
        {
            if (System.Text.RegularExpressions.Regex.IsMatch(text, "^https?:\\/\\/youtu\\.be\\/", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
            {
                return SourceType.YouTubeShortlink;
            }

            return System.Text.RegularExpressions.Regex.IsMatch(text, "\\/shorts(?:\\/|\\?|$)", System.Text.RegularExpressions.RegexOptions.IgnoreCase)
                ? SourceType.YouTubeShort
                : SourceType.YouTubeWatch;
        }

        if (System.Text.RegularExpressions.Regex.IsMatch(text, "^https?:\\/\\/b23\\.tv\\/", System.Text.RegularExpressions.RegexOptions.IgnoreCase)) return SourceType.BilibiliShort;
        if (System.Text.RegularExpressions.Regex.IsMatch(text, "\\/bangumi\\/play\\/ep\\d+", System.Text.RegularExpressions.RegexOptions.IgnoreCase)) return SourceType.BilibiliBangumiEpisode;
        if (System.Text.RegularExpressions.Regex.IsMatch(text, "\\/bangumi\\/play\\/ss\\d+", System.Text.RegularExpressions.RegexOptions.IgnoreCase)) return SourceType.BilibiliBangumiSeason;
        if (System.Text.RegularExpressions.Regex.IsMatch(text, "\\/medialist\\/play\\/ml\\d+", System.Text.RegularExpressions.RegexOptions.IgnoreCase)) return SourceType.BilibiliMedialist;
        if (parts.Count > 1) return SourceType.BilibiliMultiPart;
        if (!string.IsNullOrWhiteSpace(part)) return SourceType.BilibiliPart;
        return SourceType.BilibiliVideo;
    }

    private static bool IsValidVideoId(string website, string videoId)
    {
        var id = (videoId ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(id)) return false;
        return string.Equals(website, "y2b", StringComparison.OrdinalIgnoreCase)
            ? System.Text.RegularExpressions.Regex.IsMatch(id, "^[\\w-]{11,14}$")
            : System.Text.RegularExpressions.Regex.IsMatch(id, "^(BV[0-9A-Za-z]{10}|av\\d+|ep\\d+|ss\\d+|md\\d+|ml\\d+)$", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
    }

    private static List<string> BuildThumbnailCandidates(string website, string videoId, string sourceThumbnail)
    {
        var results = new List<string>();
        if (!string.IsNullOrWhiteSpace(sourceThumbnail))
        {
            results.Add(sourceThumbnail.Trim());
        }

        if (string.Equals(website, "y2b", StringComparison.OrdinalIgnoreCase))
        {
            results.AddRange([
                $"https://i.ytimg.com/vi/{videoId}/maxresdefault.jpg",
                $"https://i.ytimg.com/vi/{videoId}/hq720.jpg",
                $"https://i.ytimg.com/vi/{videoId}/sddefault.jpg",
                $"https://i.ytimg.com/vi/{videoId}/hqdefault.jpg",
                $"https://i.ytimg.com/vi/{videoId}/mqdefault.jpg",
                $"https://i.ytimg.com/vi/{videoId}/default.jpg"
            ]);
        }
        else
        {
            results.AddRange([
                $"https://i0.hdslb.com/bfs/archive/{videoId}.jpg",
                $"https://i1.hdslb.com/bfs/archive/{videoId}.jpg",
                $"https://i2.hdslb.com/bfs/archive/{videoId}.jpg"
            ]);
        }

        return results.Where(item => !string.IsNullOrWhiteSpace(item)).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

    private static string GetString(JsonElement element, string propertyName, string fallback = "")
    {
        return element.TryGetProperty(propertyName, out var value) && value.ValueKind != JsonValueKind.Null
            ? value.ToString() ?? fallback
            : fallback;
    }
}
