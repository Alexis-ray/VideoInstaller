const { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } = require('fs');
const { extname, join } = require('path');
const { spawn, spawnSync } = require('child_process');
const https = require('https');

const FORCE_RECODE_FORMAT = 'mp4';
const FORCE_VIDEO_CODEC = 'h264';
const JOB_RETENTION_MS = 10 * 60 * 1000;

function createDownloader(runtime) {
    const jobs = new Map();

    return {
        parseVideo: (url) => parseVideo(url, runtime),
        ensureDownload: (query) => ensureDownload(query, runtime, jobs),
        refreshCookies: () => refreshCookies(runtime)
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

        executeDownload(context, runtime)
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

async function executeDownload(context, runtime) {
    const { website, videoID, title, p, format, transcode, sourceUrl } = context;
    const fileBase = buildVideoFileBase(title, videoID, p);
    const downloadDir = buildVideoDir(runtime.tmpDir, title, videoID);
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

    const sourceFile = findPrimaryOutputFile(downloadDir, fileBase);
    if (!sourceFile) {
        throw new Error('下载完成但未找到输出文件');
    }

    let destFile = sourceFile;
    if (transcode) {
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
    const relativeFolder = toUrlPath(buildVideoFolderName(title, videoID));
    const metadataFile = findInfoFile(downloadDir, fileBase);

    return {
        title,
        format,
        transcode,
        phase: 'completed',
        downloading: false,
        downloadSucceed: true,
        folder: `file/${relativeFolder}`,
        dest: `file/${relativeFolder}/${destFile}`,
        video: mediaInfo.hasVideo ? `file/${relativeFolder}/${destFile}` : null,
        audio: mediaInfo.hasAudio && !mediaInfo.hasVideo ? `file/${relativeFolder}/${destFile}` : null,
        metadata: metadataFile ? `file/${relativeFolder}/${metadataFile}` : null
    };
}

async function refreshCookies(runtime) {
    const original = existsSync(runtime.cookiePath) ? readFileSync(runtime.cookiePath) : null;
    const attempts = [];

    for (const attempt of buildCookieRefreshAttempts(runtime.config)) {
        restoreCookieFile(runtime.cookiePath, original);
        const browserSpec = buildCookiesFromBrowserSpec(attempt.browser, attempt.profile, attempt.profilePath);

        try {
            await runProcess(runtime.ytDlpPath, [
                '--cookies-from-browser', browserSpec,
                '--cookies', runtime.cookiePath,
                '--skip-download',
                '--no-warnings',
                'https://www.youtube.com/watch?v=BaW_jenozKc'
            ], runtime.config.taskTimeout.parse);

            if (hasUsableCookie(runtime.cookiePath)) {
                return {
                    browser: attempt.browser,
                    message: `已更新 Cookie：${runtime.cookiePath}`
                };
            }

            attempts.push(`${browserSpec}: 未生成可用 Cookie`);
        } catch (error) {
            attempts.push(`${browserSpec}: ${safeError(error)}`);
        }
    }

    restoreCookieFile(runtime.cookiePath, original);
    throw new Error(attempts.join('\n') || '自动获取 Cookie 失败');
}

function buildCookieRefreshAttempts(config) {
    const attempts = [];
    const seen = new Set();

    const add = (browser, profile, profilePath) => {
        const normalizedBrowser = normalizeBrowserName(browser);
        if (!normalizedBrowser) return;
        const normalizedProfile = String(profile || '').trim() || 'Default';
        const normalizedProfilePath = String(profilePath || '').trim();
        const key = [normalizedBrowser, normalizedProfile, normalizedProfilePath].join('|');
        if (seen.has(key)) return;
        seen.add(key);
        attempts.push({
            browser: normalizedBrowser,
            profile: normalizedProfile,
            profilePath: normalizedProfilePath
        });
    };

    add(config.cookieAutoBrowser, config.cookieAutoProfile, config.cookieAutoProfilePath);
    add('edge', 'Default', '');
    add('chrome', 'Default', '');
    add('firefox', 'default-release', '');
    return attempts;
}

function normalizeBrowserName(browser) {
    const text = String(browser || '').trim().toLowerCase();
    if (!text) return '';
    if (text === 'msedge') return 'edge';
    return text;
}

function buildCookiesFromBrowserSpec(browser, profile, profilePath) {
    const parts = [String(browser || '').trim()];
    if (profilePath) parts.push(`profile=${profilePath}`);
    else if (profile) parts.push(`profile=${profile}`);
    return parts.join(':');
}

function restoreCookieFile(cookiePath, previous) {
    ensureParentDir(cookiePath);
    writeFileSync(cookiePath, previous || '# Netscape HTTP Cookie File\n');
}

function hasUsableCookie(cookiePath) {
    if (!existsSync(cookiePath)) return false;
    const text = readFileSync(cookiePath, 'utf8');
    return text.split(/\r?\n/).some((line) => line && !line.startsWith('#'));
}

function validateDownloadContext(query) {
    const website = String(query.website || '').trim();
    const videoID = String(query.v || '').trim();
    const p = String(query.p || '').trim();
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

function isSafeFormatSelector(format) {
    return /^[A-Za-z0-9][A-Za-z0-9._-]*(?:x[A-Za-z0-9][A-Za-z0-9._-]*)?$/.test(String(format || '').trim());
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

function findPrimaryOutputFile(dir, fileBase) {
    if (!existsSync(dir)) return '';

    const prefix = `${fileBase}.`;
    const ignored = new Set(['.json', '.txt', '.description', '.part', '.ytdl', '.tmp', '.temp']);
    const candidates = readdirSync(dir)
        .filter((name) => name.startsWith(prefix) || name.startsWith(`${fileBase}-h264.`))
        .filter((name) => statSync(join(dir, name)).isFile())
        .filter((name) => !name.endsWith('.info.json'))
        .filter((name) => !ignored.has(extname(name).toLowerCase()))
        .map((name) => ({ name, stat: statSync(join(dir, name)) }))
        .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs || b.stat.size - a.stat.size);

    return candidates[0]?.name || '';
}

function findInfoFile(dir, fileBase) {
    if (!existsSync(dir)) return '';
    return readdirSync(dir).find((name) => name.startsWith(`${fileBase}.`) && name.endsWith('.info.json')) || '';
}

function ensureParentDir(filePath) {
    mkdirSync(join(filePath, '..'), { recursive: true });
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

function toUrlPath(pathText) {
    return String(pathText || '').replace(/\\/g, '/');
}

module.exports = {
    createDownloader
};
