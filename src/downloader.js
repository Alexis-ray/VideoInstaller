const { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, createWriteStream, unlinkSync } = require('fs');
const { dirname, extname, join } = require('path');
const { execFile, spawn, spawnSync } = require('child_process');
const https = require('https');
const http = require('http');

const FORCE_RECODE_FORMAT = 'mp4';
const FORCE_VIDEO_CODEC = 'h264';
const JOB_RETENTION_MS = 10 * 60 * 1000;
const DEFAULT_THUMBNAIL_TIMEOUT_MS = 20000;
const DEFAULT_THUMBNAIL_RETRIES = 2;
const MAX_THUMBNAIL_REDIRECTS = 5;
const MAX_COOKIE_IMPORT_BYTES = 2 * 1024 * 1024;

function createDownloader(runtime) {
    const jobs = new Map();

    return {
        parseVideo: (url) => parseVideo(url, runtime),
        ensureDownload: (query) => ensureDownload(query, runtime, jobs),
        ensureCoverDownload: (query) => ensureCoverDownload(query, runtime, jobs),
        importCookiesText: (text) => importCookiesText(text, runtime)
    };
}

async function parseVideo(rawInput, runtime) {
    let url = normalizeInputUrl(safeDecodeURIComponent(rawInput));
    if (/^https?:\/\/b23\.tv\//i.test(url)) {
        const resolved = await resolveShortUrl(url, runtime.config.taskTimeout.parse);
        url = resolved || url;
    }

    const parsedTarget = parseSupportedVideoUrl(url);
    if (!parsedTarget) {
        throw new Error('请提供有效的 YouTube 或 Bilibili 视频 URL');
    }

    const output = await runYtDlp(runtime, [
        '--print-json',
        '--skip-download',
        '--ignore-no-formats-error',
        url
    ], runtime.config.taskTimeout.parse, parsedTarget.website);

    const info = parseAnyJsonLine(output.stdout);
    const playable = resolvePlayableInfo(info, parsedTarget.p);
    if (!playable) {
        throw new Error('解析视频信息失败，未返回可用格式');
    }

    const workingInfo = playable.info;
    const resolvedP = playable.p;
    const parts = playable.parts;
    const resolvedVideoID = resolveVideoID(parsedTarget.website, parsedTarget.videoID, workingInfo, info);

    if (!isValidVideoID(parsedTarget.website, resolvedVideoID)) {
        throw new Error('解析成功但未识别到有效视频ID');
    }

    const available = parseFormats(workingInfo.formats || []);
    const best = {
        audio: [...available.audios].sort((a, b) => b.rateValue - a.rateValue)[0] || null,
        video: [...available.videos].sort((a, b) => b.height - a.height || b.rateValue - a.rateValue)[0] || null
    };

    return {
        website: parsedTarget.website,
        v: resolvedVideoID,
        p: resolvedP,
        source: resolveDownloadSourceUrl(parsedTarget.website, parsedTarget.sourceUrl || url, workingInfo, info, resolvedP),
        title: workingInfo.title || info.title || resolvedVideoID,
        thumbnail: String(workingInfo.thumbnail || info.thumbnail || '').trim(),
        parts,
        best,
        available: {
            audios: available.audios.map(dropInternalFields),
            videos: available.videos.map(dropInternalFields)
        }
    };
}

function ensureDownload(query, runtime, jobs) {
    const context = validateDownloadContext(query);
    const key = JSON.stringify(context);
    if (!jobs.has(key)) {
        jobs.set(key, {
            success: true,
            result: {
                title: context.title,
                format: context.format,
                transcode: context.transcode,
                phase: 'downloading',
                downloading: true,
                downloadSucceed: false,
                dest: context.transcode ? '正在下载原始音视频文件' : '正在下载原始文件'
            }
        });

        executeDownload(context, runtime, (result) => {
            jobs.set(key, { success: true, result });
        })
            .then((result) => {
                jobs.set(key, { success: true, result });
                scheduleJobCleanup(jobs, key);
            })
            .catch((error) => {
                jobs.set(key, {
                    success: true,
                    result: {
                        title: context.title,
                        phase: 'failed',
                        transcode: context.transcode,
                        downloading: false,
                        downloadSucceed: false,
                        dest: context.transcode ? '下载或转码失败' : '下载失败',
                        error: buildSiteAwareError(context.website, error, context.transcode ? 'transcode' : 'download')
                    }
                });
                scheduleJobCleanup(jobs, key);
            });
    }

    return jobs.get(key);
}

function ensureCoverDownload(query, runtime, jobs) {
    const context = validateCoverDownloadContext(query);
    const key = JSON.stringify({ type: 'cover', ...context });
    if (!jobs.has(key)) {
        jobs.set(key, {
            success: true,
            result: {
                title: context.title,
                phase: 'downloading-cover',
                downloading: true,
                downloadSucceed: false,
                dest: '正在下载封面'
            }
        });

        executeCoverDownload(context, runtime)
            .then((result) => {
                jobs.set(key, { success: true, result });
                scheduleJobCleanup(jobs, key);
            })
            .catch((error) => {
                jobs.set(key, {
                    success: true,
                    result: {
                        title: context.title,
                        phase: 'failed',
                        downloading: false,
                        downloadSucceed: false,
                        dest: '下载封面失败',
                        error: safeError(error)
                    }
                });
                scheduleJobCleanup(jobs, key);
            });
    }

    return jobs.get(key);
}

async function executeDownload(context, runtime, onProgress = () => {}) {
    const { website, videoID, title, p, format, transcode, sourceUrl } = context;
    const fileBase = buildVideoFileBase(title, videoID, p);
    const downloadDir = buildVideoDir(runtime.tmpDir, title, videoID);
    assertPathInsideRoot(runtime.tmpDir, downloadDir);
    mkdirSync(downloadDir, { recursive: true });

    const url = buildWebsiteUrl(website, videoID, p, sourceUrl);
    const outputTemplate = join(downloadDir, `${fileBase}.%(ext)s`);
    const formatWithFilter = format.replace('x', '+');

    await runYtDlp(runtime, [
        url,
        '-f', formatWithFilter,
        '-o', outputTemplate,
        '--no-playlist',
        '--write-info-json',
        '-k',
        '--ffmpeg-location', runtime.ffmpegPath
    ], runtime.config.taskTimeout.download, website);

    const sourceFile = findPrimaryOutputFile(downloadDir, fileBase, runtime.ffmpegPath);
    if (!sourceFile) {
        throw new Error('下载完成但未找到输出文件');
    }

    let destFile = sourceFile;
    if (transcode) {
        onProgress({
            title,
            format,
            transcode,
            phase: 'transcoding',
            downloading: true,
            downloadSucceed: false,
            dest: '原始音视频下载完成，正在转码…'
        });
        const transcodedName = `${fileBase}-h264.${FORCE_RECODE_FORMAT}`;
        await runProcess(runtime.ffmpegPath, [
            '-y',
            '-i', join(downloadDir, sourceFile),
            '-c:v', FORCE_VIDEO_CODEC,
            '-c:a', 'aac',
            join(downloadDir, transcodedName)
        ], runtime.config.taskTimeout.download);
        destFile = transcodedName;
    }

    const mediaInfo = detectMediaStream(join(downloadDir, destFile), runtime.ffmpegPath);
    const relativeFolder = toPublicPath(buildVideoFolderName(title, videoID));
    const metadataFile = findInfoFile(downloadDir, fileBase);
    if (metadataFile) {
        const metadataPath = join(downloadDir, metadataFile);
        const formatResult = prettyPrintJsonFile(metadataPath);
        if (!formatResult.ok) {
            console.warn(`[metadata] pretty-print failed: ${metadataPath} :: ${formatResult.error}`);
        }
    }

    const openFolder = await openFolderInBackground(downloadDir);

    return {
        title,
        format,
        transcode,
        phase: 'completed',
        downloading: false,
        downloadSucceed: true,
        folder: `file/${relativeFolder}`,
        dest: `file/${relativeFolder}/${encodeURIComponent(destFile)}`,
        video: mediaInfo.hasVideo ? `file/${relativeFolder}/${encodeURIComponent(destFile)}` : null,
        audio: mediaInfo.hasAudio && !mediaInfo.hasVideo ? `file/${relativeFolder}/${encodeURIComponent(destFile)}` : null,
        metadata: metadataFile ? `file/${relativeFolder}/${encodeURIComponent(metadataFile)}` : null,
        openFolder
    };
}

async function executeCoverDownload(context, runtime) {
    const { website, videoID, title, p, thumbnailUrl } = context;
    const downloadDir = buildVideoDir(runtime.tmpDir, title, videoID);
    assertPathInsideRoot(runtime.tmpDir, downloadDir);
    mkdirSync(downloadDir, { recursive: true });

    const fileBase = buildVideoFileBase(title, videoID, p);
    const coverUrls = resolveCoverUrls(website, videoID, thumbnailUrl);
    if (!coverUrls.length) {
        throw new Error('未找到可用封面地址');
    }

    let coverFileName = '';
    let lastError = null;
    const diagnostics = [];
    let finalUrl = '';
    let downloader = '';
    const timeoutMs = resolveThumbnailTimeout(runtime.config);
    const retryCount = resolveThumbnailRetryCount(runtime.config);
    for (const coverUrl of coverUrls) {
        const extension = resolveCoverExtension(coverUrl);
        coverFileName = `${fileBase}-cover${extension}`;
        const coverPath = join(downloadDir, coverFileName);
        assertPathInsideRoot(runtime.tmpDir, coverPath);
        try {
            const downloadResult = await downloadFileWithRetry(coverUrl, coverPath, {
                timeoutMs,
                retryCount,
                maxRedirects: MAX_THUMBNAIL_REDIRECTS
            });
            diagnostics.push(...downloadResult.attempts);
            finalUrl = downloadResult.finalUrl || coverUrl;
            downloader = downloadResult.method || '';
            lastError = null;
            break;
        } catch (error) {
            if (Array.isArray(error?.details?.attempts)) {
                diagnostics.push(...error.details.attempts);
            }
            lastError = error;
            cleanupFile(coverPath);
        }
    }

    if (lastError) {
        lastError.details = {
            ...(lastError.details || {}),
            cover: {
                candidates: coverUrls,
                finalUrl,
                downloader,
                attempts: diagnostics
            }
        };
        throw lastError;
    }

    const relativeFolder = toPublicPath(buildVideoFolderName(title, videoID));
    return {
        title,
        phase: 'completed',
        downloading: false,
        downloadSucceed: true,
        folder: `file/${relativeFolder}`,
        dest: `file/${relativeFolder}/${encodeURIComponent(coverFileName)}`,
        cover: `file/${relativeFolder}/${encodeURIComponent(coverFileName)}`,
        coverDiagnostics: {
            candidates: coverUrls,
            finalUrl,
            downloader,
            attempts: diagnostics
        }
    };
}

function importCookiesText(rawText, runtime) {
    const text = normalizeCookieImportText(rawText);
    const cookieCount = countNetscapeCookieLines(text);
    if (cookieCount === 0) {
        throw new Error('未发现有效的 Netscape cookies.txt Cookie 行');
    }

    ensureParentDir(runtime.cookiePath);
    writeFileSync(runtime.cookiePath, text, 'utf8');
    return {
        message: `已导入 ${cookieCount} 条 Cookie：${runtime.cookiePath}`,
        cookieCount,
        cookiePath: runtime.cookiePath
    };
}

function normalizeCookieImportText(rawText) {
    const text = String(rawText || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
    if (!text) {
        throw new Error('请先选择或粘贴 cookies.txt 内容');
    }
    if (Buffer.byteLength(text, 'utf8') > MAX_COOKIE_IMPORT_BYTES) {
        throw new Error('Cookie 文件过大，请只导出需要的网站 Cookie');
    }
    return `${text}\n`;
}

function countNetscapeCookieLines(text) {
    return text.split(/\n/).filter(isNetscapeCookieLine).length;
}

function isNetscapeCookieLine(line) {
    const trimmed = String(line || '').trim();
    if (!trimmed) return false;
    const cookieLine = trimmed.startsWith('#HttpOnly_') ? trimmed.slice('#HttpOnly_'.length) : trimmed;
    if (!cookieLine || cookieLine.startsWith('#')) return false;
    const fields = cookieLine.split('\t');
    if (fields.length < 7) return false;
    return Boolean(fields[0] && fields[1] && fields[2] && fields[3] && fields[5]);
}

function validateDownloadContext(query) {
    const website = String(query.website || '').trim();
    const videoID = String(query.v || '').trim();
    const p = normalizePartParam(query.p);
    const format = String(query.format || '').trim();
    const sourceUrl = String(query.source || '').trim();
    const title = String(query.title || '').trim() || videoID;
    const transcode = String(query.transcode || '0') === '1';

    if (!isSupportedWebsite(website)) {
        throw new Error('无效网站参数');
    }
    if (!isValidVideoID(website, videoID)) {
        throw new Error('无效视频ID');
    }
    if (!format) {
        throw new Error('缺少格式参数');
    }
    if (!isSafeFormatSelector(format)) {
        throw new Error('格式参数无效');
    }
    if (transcode && !isCombinedFormatSelector(format)) {
        throw new Error('转码需要同时选择视频和音频格式');
    }

    return {
        website,
        videoID,
        p: p || null,
        format,
        sourceUrl: isValidWebsiteSourceUrl(website, sourceUrl) ? sourceUrl : '',
        title,
        transcode
    };
}

function validateCoverDownloadContext(query) {
    const website = String(query.website || '').trim();
    const videoID = String(query.v || '').trim();
    const p = normalizePartParam(query.p);
    const sourceUrl = String(query.source || '').trim();
    const thumbnailUrl = String(query.thumbnail || '').trim();
    const title = String(query.title || '').trim() || videoID;

    if (!isSupportedWebsite(website)) {
        throw new Error('无效网站参数');
    }
    if (!isValidVideoID(website, videoID)) {
        throw new Error('无效视频ID');
    }

    return {
        website,
        videoID,
        p: p || null,
        sourceUrl: isValidWebsiteSourceUrl(website, sourceUrl) ? sourceUrl : '',
        thumbnailUrl: isAllowedThumbnailUrl(thumbnailUrl) ? thumbnailUrl : '',
        title
    };
}

function isSafeFormatSelector(format) {
    return /^[A-Za-z0-9][A-Za-z0-9._-]*(?:x[A-Za-z0-9][A-Za-z0-9._-]*)?$/.test(String(format || '').trim());
}

function isCombinedFormatSelector(format) {
    return String(format || '').includes('x');
}

function normalizePartParam(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (!/^\d+$/.test(text)) {
        throw new Error('分P参数无效');
    }
    return text;
}

function isValidHttpUrl(url) {
    try {
        const parsed = new URL(String(url || '').trim());
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (error) {
        return false;
    }
}

function isAllowedThumbnailUrl(url) {
    if (!isValidHttpUrl(url)) return false;
    try {
        const parsed = new URL(String(url || '').trim());
        const host = parsed.hostname.toLowerCase();
        return host === '127.0.0.1'
            || host === 'localhost'
            || host === 'ytimg.com'
            || host.endsWith('.ytimg.com')
            || host === 'ggpht.com'
            || host.endsWith('.ggpht.com')
            || host === 'biliimg.com'
            || host.endsWith('.biliimg.com')
            || host === 'hdslb.com'
            || host.endsWith('.hdslb.com');
    } catch (error) {
        return false;
    }
}

function parseFormats(formats) {
    return formats.reduce((acc, fmt) => {
        const fileSize = Number(fmt.filesize || fmt.filesize_approx || 0);
        const size = fileSize > 0 ? `${(fileSize / 1024 / 1024).toFixed(2)}MB` : '未知';

        if (fmt.video_ext && fmt.video_ext !== 'none') {
            acc.videos.push({
                id: String(fmt.format_id || ''),
                format: fmt.ext || '未知',
                codec: fmt.vcodec || '未知',
                scale: fmt.resolution || (fmt.height ? `${fmt.height}p` : '未知'),
                frame: fmt.fps ? `${fmt.fps}fps` : '未知',
                rate: fmt.vbr ? `${Math.round(fmt.vbr)}kbps` : '未知',
                info: fmt.format_note || '无描述',
                size,
                rateValue: Number(fmt.vbr || 0),
                height: Number(fmt.height || 0)
            });
        } else if (fmt.audio_ext && fmt.audio_ext !== 'none') {
            acc.audios.push({
                id: String(fmt.format_id || ''),
                format: fmt.ext || '未知',
                rate: fmt.abr ? `${Math.round(fmt.abr)}kbps` : '未知',
                info: fmt.format_note || '无描述',
                size,
                rateValue: Number(fmt.abr || 0)
            });
        }

        return acc;
    }, { audios: [], videos: [] });
}

function dropInternalFields(item) {
    const clone = { ...item };
    delete clone.rateValue;
    delete clone.height;
    return clone;
}

function normalizeInputUrl(url) {
    return String(url || '')
        .trim()
        .replace(/^y2b:/i, 'https:')
        .replace(/^y2:/i, 'https:');
}

function parseSupportedVideoUrl(url) {
    const input = String(url || '').trim();
    if (!input) return null;

    const youtubeMatch = input.match(/^https?:\/\/(?:youtu\.be\/|(?:www|m)\.youtube\.com\/(?:watch|shorts)(?:\/|\?v=))([\w-]{11})/i);
    if (youtubeMatch) {
        return {
            website: 'y2b',
            videoID: youtubeMatch[1],
            p: null,
            sourceUrl: input
        };
    }

    const bilibiliMatch = input.match(/^https?:\/\/(?:www\.)?bilibili\.com\/video\/(BV[0-9A-Za-z]{10}|av\d+)/i);
    if (bilibiliMatch) {
        const pMatch = input.match(/[?&]p=(\d+)/i);
        return {
            website: 'b2b',
            videoID: bilibiliMatch[1],
            p: pMatch ? String(Number(pMatch[1])) : null,
            sourceUrl: input
        };
    }

    const bangumiMatch = input.match(/^https?:\/\/(?:www\.)?bilibili\.com\/bangumi\/play\/(ep\d+|ss\d+)/i);
    if (bangumiMatch) {
        return { website: 'b2b', videoID: bangumiMatch[1], p: null, sourceUrl: input };
    }

    const listMatch = input.match(/^https?:\/\/(?:www\.)?bilibili\.com\/medialist\/play\/(ml\d+)/i);
    if (listMatch) {
        return { website: 'b2b', videoID: listMatch[1], p: null, sourceUrl: input };
    }

    return null;
}

function isSupportedWebsite(website) {
    return website === 'y2b' || website === 'b2b';
}

function isValidVideoID(website, videoID) {
    const id = String(videoID || '').trim();
    if (!id) return false;
    if (website === 'y2b') return /^[\w-]{11,14}$/.test(id);
    if (website === 'b2b') return /^(BV[0-9A-Za-z]{10}|av\d+|ep\d+|ss\d+|ml\d+)$/i.test(id);
    return false;
}

function isValidWebsiteSourceUrl(website, sourceUrl) {
    const text = String(sourceUrl || '').trim();
    if (!text) return false;
    if (website === 'y2b') {
        return /^https?:\/\/(?:youtu\.be\/|(?:www|m)\.youtube\.com\/)/i.test(text);
    }
    if (website === 'b2b') {
        return /^https?:\/\/(?:b23\.tv\/|(?:www\.)?bilibili\.com\/)/i.test(text);
    }
    return false;
}

function resolvePlayableInfo(info, requestedP) {
    if (!info || typeof info !== 'object') return null;
    if (Array.isArray(info.formats) && info.formats.length) {
        const parts = buildPartsFromEntries(info.entries, info.webpage_url || info.original_url || info.url || '');
        const p = normalizePartNo(requestedP, info);
        return { info, p, parts };
    }

    const entries = Array.isArray(info.entries) ? info.entries.filter(Boolean) : [];
    if (!entries.length) return null;

    const requested = Number(requestedP || 0);
    let chosen = requested > 0 ? entries[requested - 1] : null;
    if (!chosen || !Array.isArray(chosen.formats) || !chosen.formats.length) {
        chosen = entries.find((entry) => Array.isArray(entry.formats) && entry.formats.length) || null;
    }
    if (!chosen) return null;

    const chosenP = requested > 0
        ? requested
        : Number(chosen?.webpage_url?.match(/[?&]p=(\d+)/i)?.[1] || chosen?.episode_number || 1);

    return {
        info: chosen,
        p: Number.isFinite(chosenP) && chosenP > 0 ? String(chosenP) : '1',
        parts: buildPartsFromEntries(entries, info.webpage_url || info.original_url || info.url || '')
    };
}

function buildPartsFromEntries(entries, baseUrl) {
    if (!Array.isArray(entries) || entries.length <= 1) return [];
    return entries.map((entry, index) => {
        const p = String(index + 1);
        const title = String(entry?.title || '').trim() || `分P ${p}`;
        const url = String(entry?.webpage_url || entry?.url || '').trim() || appendPartToUrl(baseUrl, p);
        return { p, title, url };
    });
}

function normalizePartNo(p, info) {
    const requested = Number(p || 0);
    if (requested > 0) return String(requested);
    const pageNo = Number(info?.webpage_url?.match(/[?&]p=(\d+)/i)?.[1] || 0);
    return pageNo > 0 ? String(pageNo) : null;
}

function appendPartToUrl(url, p) {
    const base = String(url || '').trim();
    if (!base) return '';
    const cleaned = base.replace(/([?&])p=\d+/i, '$1').replace(/[?&]$/, '');
    return `${cleaned}${cleaned.includes('?') ? '&' : '?'}p=${p}`;
}

function resolveDownloadSourceUrl(website, inputUrl, workingInfo, rootInfo, p) {
    if (website !== 'b2b') {
        return String(inputUrl || '').trim();
    }

    const candidates = [
        String(workingInfo?.webpage_url || '').trim(),
        String(rootInfo?.webpage_url || '').trim(),
        String(workingInfo?.original_url || '').trim(),
        String(rootInfo?.original_url || '').trim(),
        String(inputUrl || '').trim()
    ].filter(Boolean);

    const picked = candidates[0] || '';
    return p ? appendPartToUrl(picked, p) : picked;
}

function resolveVideoID(website, requestedVideoID, info, rootInfo) {
    const requested = String(requestedVideoID || '').trim();
    if (isValidVideoID(website, requested)) {
        return requested;
    }

    const direct = [String(info?.id || '').trim(), String(rootInfo?.id || '').trim()]
        .find((candidate) => isValidVideoID(website, candidate));
    if (direct) {
        return direct;
    }

    const urls = [
        String(info?.webpage_url || '').trim(),
        String(rootInfo?.webpage_url || '').trim(),
        String(info?.original_url || '').trim(),
        String(rootInfo?.original_url || '').trim()
    ];

    for (const candidate of urls) {
        const match = candidate.match(/(?:\/video\/)(BV[0-9A-Za-z]{10}|av\d+)|(?:\/bangumi\/play\/)(ep\d+|ss\d+)|(?:\/medialist\/play\/)(ml\d+)/i);
        const id = (match?.[1] || match?.[2] || match?.[3] || '').trim();
        if (isValidVideoID(website, id)) {
            return id;
        }
    }

    return requested;
}

function buildVideoFolderName(title, videoID) {
    return sanitizePathSegment(title, videoID);
}

function buildVideoDir(tmpDir, title, videoID) {
    return join(tmpDir, buildVideoFolderName(title, videoID));
}

function buildVideoFileBase(title, videoID, p) {
    const safeTitle = sanitizePathSegment(title, videoID);
    return p ? `${safeTitle}-p${p}` : safeTitle;
}

function sanitizePathSegment(text, fallback = 'video') {
    const normalized = String(text || '').trim()
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        .replace(/\s+/g, ' ')
        .replace(/[. ]+$/g, '');
    const cleaned = normalized || fallback;
    return cleaned.slice(0, 120);
}

function findPrimaryOutputFile(dir, fileBase, ffmpegPath) {
    if (!existsSync(dir)) return '';

    const prefix = `${fileBase}.`;
    const ignored = new Set(['.json', '.txt', '.description', '.part', '.ytdl', '.tmp', '.temp']);
    const candidates = readdirSync(dir)
        .filter((name) => name.startsWith(prefix) || name.startsWith(`${fileBase}-h264.`))
        .filter((name) => statSync(join(dir, name)).isFile())
        .filter((name) => !name.endsWith('.info.json'))
        .filter((name) => !ignored.has(extname(name).toLowerCase()))
        .map((name) => {
            const filePath = join(dir, name);
            const stat = statSync(filePath);
            const mediaInfo = ffmpegPath ? detectMediaStream(filePath, ffmpegPath) : { hasVideo: false, hasAudio: false };
            return {
                name,
                stat,
                mediaInfo,
                score: buildPrimaryOutputScore(name, mediaInfo)
            };
        })
        .sort((a, b) => b.score - a.score || b.stat.mtimeMs - a.stat.mtimeMs || b.stat.size - a.stat.size);

    return candidates[0]?.name || '';
}

function buildPrimaryOutputScore(name, mediaInfo) {
    let score = 0;
    if (mediaInfo.hasVideo) score += 100;
    if (mediaInfo.hasAudio) score += 20;
    if (!/\.f\w+\./i.test(name)) score += 10;
    if (/\.mkv$/i.test(name) || /\.mp4$/i.test(name) || /\.webm$/i.test(name)) score += 5;
    return score;
}

function findInfoFile(dir, fileBase) {
    if (!existsSync(dir)) return '';
    return readdirSync(dir).find((name) => name.startsWith(`${fileBase}.`) && name.endsWith('.info.json')) || '';
}

function prettyPrintJsonFile(filePath) {
    try {
        const raw = readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        const formatted = `${JSON.stringify(parsed, null, 2)}\n`;
        if (raw !== formatted) {
            writeFileSync(filePath, formatted, 'utf8');
        }
        return { ok: true };
    } catch (error) {
        return { ok: false, error: safeError(error) };
    }
}

function ensureParentDir(filePath) {
    mkdirSync(dirname(filePath), { recursive: true });
}

function resolveCoverUrls(website, videoID, thumbnailUrl) {
    const candidates = [];
    if (website === 'y2b') {
        candidates.push(
            `https://i.ytimg.com/vi/${videoID}/maxresdefault.jpg`,
            `https://i.ytimg.com/vi/${videoID}/sddefault.jpg`,
            `https://i.ytimg.com/vi/${videoID}/hq720.jpg`,
            `https://i.ytimg.com/vi/${videoID}/hqdefault.jpg`,
            `https://i.ytimg.com/vi/${videoID}/mqdefault.jpg`,
            `https://i.ytimg.com/vi/${videoID}/default.jpg`
        );
    }

    const directThumbnail = String(thumbnailUrl || '').trim();
    if (directThumbnail && !candidates.includes(directThumbnail)) {
        candidates.push(directThumbnail);
    }

    return candidates.filter((url) => isAllowedThumbnailUrl(url));
}

function resolveCoverExtension(url) {
    const pathname = String(url || '').split('?')[0].split('#')[0];
    const ext = extname(pathname).toLowerCase();
    return ext && /^[.][a-z0-9]{2,5}$/.test(ext) ? ext : '.jpg';
}

function resolveThumbnailTimeout(config) {
    const configured = Number(config?.thumbnailTimeout);
    if (Number.isFinite(configured) && configured > 0) {
        return configured;
    }

    const parseTimeout = Number(config?.taskTimeout?.parse);
    if (Number.isFinite(parseTimeout) && parseTimeout > 0) {
        return Math.min(parseTimeout, DEFAULT_THUMBNAIL_TIMEOUT_MS);
    }

    return DEFAULT_THUMBNAIL_TIMEOUT_MS;
}

function resolveThumbnailRetryCount(config) {
    const configured = Number(config?.thumbnailRetryCount);
    if (Number.isInteger(configured) && configured >= 0) {
        return configured;
    }
    return DEFAULT_THUMBNAIL_RETRIES;
}

async function downloadFileWithRetry(url, destination, options = {}) {
    const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : DEFAULT_THUMBNAIL_TIMEOUT_MS;
    const retryCount = Number.isInteger(options.retryCount) && options.retryCount >= 0 ? options.retryCount : DEFAULT_THUMBNAIL_RETRIES;
    const maxRedirects = Number.isInteger(options.maxRedirects) && options.maxRedirects >= 0 ? options.maxRedirects : MAX_THUMBNAIL_REDIRECTS;
    const attempts = [];

    for (let attempt = 1; attempt <= retryCount + 1; attempt += 1) {
        const startedAt = Date.now();
        try {
            const result = await downloadFile(url, destination, { timeoutMs, maxRedirects });
            attempts.push({
                method: 'node-http',
                url,
                attempt,
                timeoutMs,
                durationMs: Date.now() - startedAt,
                success: true,
                finalUrl: result.finalUrl || url,
                statusCode: result.statusCode || 200
            });
            return {
                method: 'node-http',
                finalUrl: result.finalUrl || url,
                attempts
            };
        } catch (error) {
            attempts.push({
                method: 'node-http',
                url,
                attempt,
                timeoutMs,
                durationMs: Date.now() - startedAt,
                success: false,
                error: safeError(error)
            });
            cleanupFile(destination);
            if (attempt <= retryCount) {
                await delay(Math.min(1000 * attempt, 3000));
            }
        }
    }

    if (process.platform === 'win32') {
        const startedAt = Date.now();
        try {
            await downloadFileWithPowerShell(url, destination, timeoutMs);
            attempts.push({
                method: 'powershell-invoke-webrequest',
                url,
                attempt: 1,
                timeoutMs,
                durationMs: Date.now() - startedAt,
                success: true,
                finalUrl: url,
                statusCode: 200
            });
            return {
                method: 'powershell-invoke-webrequest',
                finalUrl: url,
                attempts
            };
        } catch (error) {
            cleanupFile(destination);
            attempts.push({
                method: 'powershell-invoke-webrequest',
                url,
                attempt: 1,
                timeoutMs,
                durationMs: Date.now() - startedAt,
                success: false,
                error: safeError(error)
            });
        }
    }

    const error = new Error(`下载封面失败：${attempts[attempts.length - 1]?.error || '未知错误'}`);
    error.details = { attempts };
    throw error;
}

function downloadFile(url, destination, options = {}, redirectDepth = 0) {
    return new Promise((resolve, reject) => {
        ensureParentDir(destination);
        const client = selectHttpClient(url);
        const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : DEFAULT_THUMBNAIL_TIMEOUT_MS;
        const maxRedirects = Number.isInteger(options.maxRedirects) && options.maxRedirects >= 0 ? options.maxRedirects : MAX_THUMBNAIL_REDIRECTS;
        const request = client.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        }, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                response.resume();
                if (redirectDepth >= maxRedirects) {
                    reject(new Error('封面重定向次数过多'));
                    return;
                }
                const redirectedUrl = new URL(response.headers.location, url).toString();
                if (!isAllowedThumbnailUrl(redirectedUrl)) {
                    reject(new Error('封面重定向地址不被允许'));
                    return;
                }
                downloadFile(redirectedUrl, destination, { timeoutMs, maxRedirects }, redirectDepth + 1).then(resolve, reject);
                return;
            }

            if (response.statusCode !== 200) {
                response.resume();
                reject(new Error(`下载封面失败，状态码: ${response.statusCode}`));
                return;
            }

            const file = createWriteStream(destination);
            file.on('finish', () => file.close(() => resolve({ statusCode: response.statusCode, finalUrl: url })));
            file.on('error', (error) => file.close(() => reject(error)));
            response.on('error', (error) => file.close(() => reject(error)));
            response.pipe(file);
        });

        request.setTimeout(timeoutMs, () => request.destroy(new Error(`下载封面超时（${timeoutMs}ms）`)));
        request.on('error', reject);
    });
}

function openFolderInBackground(folderPath) {
    return new Promise((resolve) => {
        const targetPath = String(folderPath || '').trim();
        if (!targetPath) {
            resolve({ attempted: false, launched: false, message: '未提供可打开的目录路径', attempts: [] });
            return;
        }
        if (!existsSync(targetPath)) {
            resolve({ attempted: false, launched: false, message: `目录不存在，未执行自动打开：${targetPath}`, attempts: [] });
            return;
        }

        attemptOpenFolder(targetPath)
            .then(resolve)
            .catch((error) => resolve({
                attempted: true,
                launched: false,
                message: `已尝试自动打开目录，但所有策略都失败：${safeError(error)}`,
                attempts: error?.details?.attempts || []
            }));
    });
}

function cleanupFile(filePath) {
    try {
        if (filePath && existsSync(filePath)) {
            unlinkSync(filePath);
        }
    } catch (error) {
        console.warn(`清理文件失败: ${safeError(error)}`);
    }
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function selectHttpClient(url) {
    return String(url || '').trim().toLowerCase().startsWith('http://') ? http : https;
}

async function attemptOpenFolder(targetPath) {
    const attempts = [];
    const strategies = [
        {
            name: 'cmd-start',
            run: () => spawnDetachedSuccess('cmd', ['/c', 'start', '', targetPath])
        },
        {
            name: 'explorer-execFile',
            run: () => execFileSuccess('explorer.exe', [targetPath])
        },
        {
            name: 'powershell-start-process',
            run: () => execFileSuccess('powershell.exe', [
                '-NoProfile',
                '-NonInteractive',
                '-Command',
                `Start-Process explorer.exe -ArgumentList '${escapePowerShellSingleQuoted(targetPath)}'`
            ])
        }
    ];

    for (const strategy of strategies) {
        const startedAt = Date.now();
        try {
            const result = await strategy.run();
            attempts.push({
                strategy: strategy.name,
                success: true,
                durationMs: Date.now() - startedAt,
                ...result
            });
            return {
                attempted: true,
                launched: true,
                visibleUnknown: true,
                strategy: strategy.name,
                attempts,
                message: `已尝试使用 ${strategy.name} 自动打开下载目录；若未看到新窗口，可能被现有资源管理器窗口复用或未切到前台`
            };
        } catch (error) {
            attempts.push({
                strategy: strategy.name,
                success: false,
                durationMs: Date.now() - startedAt,
                error: safeError(error)
            });
            console.warn(`自动打开目录失败 [${strategy.name}]: ${targetPath} - ${safeError(error)}`);
        }
    }

    const error = new Error('所有自动打开目录策略都失败');
    error.details = { attempts };
    throw error;
}

function execFileSuccess(command, args) {
    return new Promise((resolve, reject) => {
        execFile(command, args, { windowsHide: true }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve({
                stdout: String(stdout || ''),
                stderr: String(stderr || '')
            });
        });
    });
}

function spawnDetachedSuccess(command, args) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (handler, payload) => {
            if (settled) return;
            settled = true;
            handler(payload);
        };

        try {
            const child = spawn(command, args, {
                windowsHide: true,
                stdio: 'ignore'
            });
            child.on('error', (error) => finish(reject, error));
            child.on('exit', (code) => {
                if (code !== 0) {
                    finish(reject, new Error(`exit code ${code}`));
                }
            });
            child.on('spawn', () => {
                child.unref();
                setTimeout(() => finish(resolve, { exitCode: 0 }), 300);
            });
        } catch (error) {
            finish(reject, error);
        }
    });
}

async function downloadFileWithPowerShell(url, destination, timeoutMs) {
    ensureParentDir(destination);
    const timeoutSec = Math.max(1, Math.ceil(timeoutMs / 1000));
    await runProcess('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri '${escapePowerShellSingleQuoted(url)}' -OutFile '${escapePowerShellSingleQuoted(destination)}' -UserAgent 'Mozilla/5.0' -TimeoutSec ${timeoutSec}`
    ], timeoutMs + 5000);
}

function assertPathInsideRoot(rootDir, targetPath) {
    const path = require('path');
    const normalizedRoot = path.resolve(rootDir);
    const normalizedTarget = path.resolve(targetPath);
    const relative = path.relative(normalizedRoot, normalizedTarget);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error('输出路径超出允许目录');
    }
}

function scheduleJobCleanup(jobs, key) {
    setTimeout(() => {
        jobs.delete(key);
    }, JOB_RETENTION_MS).unref?.();
}

function detectMediaStream(filePath, ffmpegPath) {
    try {
        const result = spawnSync(ffmpegPath, ['-i', filePath], {
            encoding: 'utf8',
            windowsHide: true,
            timeout: 15000,
            maxBuffer: 4 * 1024 * 1024,
            shell: false
        });

        const output = `${result.stderr || ''}\n${result.stdout || ''}`;
        return {
            hasVideo: /\bVideo:\b/i.test(output),
            hasAudio: /\bAudio:\b/i.test(output)
        };
    } catch (error) {
        return { hasVideo: false, hasAudio: false };
    }
}

function buildWebsiteUrl(website, id, p, sourceUrl) {
    const source = String(sourceUrl || '').trim();
    if (website === 'y2b') {
        return source || `https://youtu.be/${id}`;
    }
    if (source && /^https?:\/\/(?:b23\.tv\/|(?:www\.)?bilibili\.com\/)/i.test(source)) {
        return source;
    }
    const page = p && String(p).match(/^\d+$/) ? `?p=${p}` : '';
    return `https://www.bilibili.com/video/${id}${page}`;
}

async function resolveShortUrl(url, timeoutMs) {
    return new Promise((resolve, reject) => {
        const request = https.request(url, {
            method: 'GET',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        }, (response) => {
            response.resume();
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                resolve(response.headers.location);
                return;
            }
            resolve(url);
        });

        request.setTimeout(timeoutMs, () => request.destroy(new Error('短链解析超时')));
        request.on('error', reject);
        request.end();
    });
}

function runYtDlp(runtime, args, timeout, website) {
    const finalArgs = [];
    const proxy = String(runtime.config.proxy || '').trim();
    if (proxy && website === 'y2b') {
        finalArgs.push('--proxy', proxy);
    }
    if (website === 'y2b') {
        finalArgs.push('--js-runtimes', 'node');
    }
    if (existsSync(runtime.cookiePath)) {
        finalArgs.push('--cookies', runtime.cookiePath);
    }
    finalArgs.push(...args);
    return runProcess(runtime.ytDlpPath, finalArgs, timeout);
}

function runProcess(command, args, timeout) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            shell: false,
            windowsHide: true
        });

        let stdout = '';
        let stderr = '';
        let finished = false;
        let timer = null;

        const done = (handler, payload) => {
            if (finished) return;
            finished = true;
            if (timer) clearTimeout(timer);
            handler(payload);
        };

        if (timeout > 0) {
            timer = setTimeout(() => {
                child.kill();
                done(reject, new Error(`命令执行超时: ${command}`));
            }, timeout);
        }

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
        });
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });
        child.on('error', (error) => done(reject, error));
        child.on('close', (code) => {
            if (code === 0) {
                done(resolve, { stdout, stderr });
                return;
            }
            done(reject, new Error((stderr || stdout || `命令执行失败: ${code}`).trim()));
        });
    });
}

function parseAnyJsonLine(text) {
    const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (let index = lines.length - 1; index >= 0; index -= 1) {
        try {
            return JSON.parse(lines[index]);
        } catch (error) {
            continue;
        }
    }
    return null;
}

function safeDecodeURIComponent(text) {
    try {
        return decodeURIComponent(String(text || ''));
    } catch (error) {
        return String(text || '');
    }
}

function escapePowerShellSingleQuoted(text) {
    return String(text || '').replace(/'/g, "''");
}

function safeError(error) {
    if (!error) return 'unknown error';
    if (typeof error === 'string') return error;
    return error.message || JSON.stringify(error);
}

function buildSiteAwareError(website, error, stage) {
    const base = safeError(error);
    if (website !== 'b2b') return base;

    const lower = base.toLowerCase();
    const cookieSensitive = ['login', 'cookie', '403', 'forbidden', 'permission', '需要登录', '会员', '地区', '风控']
        .some((keyword) => lower.includes(keyword));
    if (!cookieSensitive) return base;

    const stageText = stage === 'parse' ? '解析阶段' : (stage === 'transcode' ? '下载/转码阶段' : '下载阶段');
    return `${base}（Bilibili ${stageText}可能需要有效 cookies.txt 或更高账号权限）`;
}

function toPublicPath(pathText) {
    return String(pathText || '')
        .split('\\')
        .join('/')
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');
}

module.exports = {
    createDownloader
};
