const { existsSync, readFileSync, rmSync, mkdirSync, readdirSync, statSync } = require('fs');
const { join, resolve } = require('path');
const { spawnSync } = require('child_process');
const { Worker, isMainThread, parentPort } = require('worker_threads');
const express = require('express');
const { getRemoteIP, getWebsiteUrl } = require('./utils.js');
const https = require('https');
const http = require('http');
const disk = require('node-disk-info');

const config = require('./config.json');
const IS_WINDOWS = process.platform === 'win32';

const TMP_DIR = resolve(__dirname, config.tmpDir || 'tmp');
const BLACKLIST_PATH = resolve(__dirname, config.blacklist || 'blacklist.txt');
const COOKIE_PATH = config.cookie ? resolve(__dirname, config.cookie) : null;

const YT_DLP_PATH = config.ytDlpPath || 'yt-dlp';
const FFMPEG_PATH = config.ffmpegPath || 'ffmpeg';

const FORCE_RECODE_FORMAT = 'mp4';
const FORCE_VIDEO_CODEC = 'h264';
const TASK_TIMEOUT = {
    PARSE: config.taskTimeout?.parse || 60000,
    DOWNLOAD: config.taskTimeout?.download || 3600000
};
const DISK_CLEANUP_THRESHOLD = Number(config.diskCleanupThreshold || 90);

if (!existsSync(TMP_DIR)) {
    mkdirSync(TMP_DIR, { recursive: true });
}

if (isMainThread) {
    const app = express();
    let blackIPs = loadBlacklist();
    const downloadQueue = {};
    const toolStatus = checkExternalTools();

    if (!IS_WINDOWS) {
        console.warn('当前版本已按 Windows 场景优化，非 Windows 环境不保证行为一致。');
    }

    app.use('/y2b', (req, res, next) => {
        config.disable
            ? res.send({ success: false, error: '服务已暂停使用' })
            : next();
    });

    app.use((req, res, next) => {
        const clientIP = getRemoteIP(req);
        console.log(`[${new Date().toISOString()}] ${clientIP} => ${req.url}`);

        blackIPs.includes(clientIP)
            ? res.status(500).send("<div style='font-size: 33vw; text-align: center'>500</div>")
            : next();
    });

    app.use('/', express.static(join(__dirname, 'static')));
    app.use('/file', setDownloadHeaders, express.static(TMP_DIR));
    app.use('/info', express.static(TMP_DIR));

    app.get('/y2b/health', handleHealthRequest);
    app.get('/y2b/parse', handleParseRequest);
    app.get('/y2b/download', handleDownloadRequest);
    app.get('/y2b/thumbnail', handleThumbnailRequest);
    app.get('/pxy', handleProxyRequest);

    app.listen(config.port || 2878, config.address || '127.0.0.1', () => {
        const host = config.address || '127.0.0.1';
        const port = config.port || 2878;
        console.log(`服务已启动，监听: http://${host}:${port}`);
        console.log(`支持功能: 解析与下载 | 自动H.264 MP4转码 | Windows路径兼容`);
        console.log(`工具状态: yt-dlp=${toolStatus.ytDlp.ok ? 'OK' : 'FAIL'}, ffmpeg=${toolStatus.ffmpeg.ok ? 'OK' : 'FAIL'}`);
    });

    function setDownloadHeaders(req, res, next) {
        const safeUrlPath = decodeURIComponent(req.path || '').replace(/\\/g, '/');
        const infoPath = join(TMP_DIR, safeUrlPath.replace(/^\//, '').replace(/\.[\w\d]+$/, '.info.json'));

        if (existsSync(infoPath)) {
            try {
                const info = JSON.parse(readFileSync(infoPath, 'utf8'));
                const filename = `${info.title || 'video'}.mp4`;
                res.setHeader(
                    'Content-Disposition',
                    `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`
                );
            } catch (err) {
                console.warn('文件名处理失败:', err.message);
            }
        }
        next();
    }

    function handleHealthRequest(req, res) {
        res.send({
            success: true,
            result: {
                platform: process.platform,
                windowsOptimized: true,
                port: config.port || 2878,
                proxy: {
                    configured: Boolean((config.proxy || '').trim()),
                    value: config.proxy || '',
                    fallbackDirect: config.proxyFallbackDirect !== false,
                    env: {
                        HTTP_PROXY: process.env.HTTP_PROXY || '',
                        HTTPS_PROXY: process.env.HTTPS_PROXY || ''
                    }
                },
                toolStatus
            }
        });
    }

    async function handleThumbnailRequest(req, res) {
        try {
            const website = String(req.query.website || '').trim();
            const videoID = String(req.query.v || '').trim();
            const sourceThumbnail = String(req.query.src || '').trim();
            const shouldDownload = String(req.query.download || '0') === '1';

            if (!['y2b', 'bilibili'].includes(website)) {
                return res.status(400).send({ success: false, error: '参数website错误' });
            }
            if (!videoID.match(/^[\w-]{11,14}$/)) {
                return res.status(400).send({ success: false, error: '参数v错误（无效视频ID）' });
            }

            const candidates = buildThumbnailCandidates(website, videoID, sourceThumbnail);
            const result = await fetchFirstAvailableImage(candidates);

            if (shouldDownload) {
                const filename = buildThumbnailFilename(website, videoID, result.url || sourceThumbnail);
                res.setHeader(
                    'Content-Disposition',
                    `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`
                );
            }

            res.setHeader('Content-Type', result.contentType || 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.send(result.buffer);
        } catch (err) {
            const website = String(req.query.website || '').trim();
            const videoID = String(req.query.v || '').trim();
            const sourceThumbnail = String(req.query.src || '').trim();
            const candidates = buildThumbnailCandidates(website, videoID, sourceThumbnail);
            const fallbackUrl = candidates.find((u) => isAllowedThumbnailUrl(u));

            if (fallbackUrl) {
                console.warn(`封面服务端抓取失败，回退浏览器直连: ${safeError(err).substring(0, 120)}`);
                return res.redirect(302, `/pxy?url=${encodeURIComponent(fallbackUrl)}`);
            }

            res.status(502).send({ success: false, error: `封面获取失败: ${safeError(err).substring(0, 200)}` });
        }
    }

    function handleParseRequest(req, res) {
        const rawInput = typeof req.query.url === 'string'
            ? req.query.url
            : (req._parsedUrl.query || '');
        const url = decodeURIComponent(rawInput).replace('y2b', 'youtube').replace('y2', 'youtu');

        const [y2bMatch, biliMatch] = [
            url.match(/^https?:\/\/(?:youtu\.be\/|(?:www|m)\.youtube\.com\/(?:watch|shorts)(?:\/|\?v=))([\w-]{11})/),
            url.match(/^https?:\/\/(?:www\.|m\.)?bilibili\.com\/video\/([\w\d]{11,14})\/?(?:\?p=(\d+))?$/)
        ];

        if (!y2bMatch && !biliMatch) {
            return res.send({ success: false, error: '请提供有效的 YouTube 或 Bilibili 视频 URL' });
        }

        checkDiskSpace(downloadQueue);
        startWorker({
            op: 'parse',
            website: y2bMatch ? 'y2b' : 'bilibili',
            url,
            videoID: (y2bMatch || biliMatch)[1],
            p: biliMatch?.[2]
        }, res);
    }

    function handleDownloadRequest(req, res) {
        const { website, v, p, format } = req.query;

        if (!website || !['y2b', 'bilibili'].includes(website)) {
            return res.send({ success: false, error: '参数website错误（仅支持 y2b 或 bilibili）' });
        }
        if (!v || !v.match(/^[\w-]{11,14}$/)) {
            return res.send({ success: false, error: '参数v错误（无效视频ID）' });
        }
        if (p && !p.match(/^\d+$/)) {
            return res.send({ success: false, error: '参数p错误（无效分P编号）' });
        }
        if (!format || !format.match(/^([\w\d-]+)(?:x([\w\d-]+))?$/)) {
            return res.send({ success: false, error: '参数format格式错误（应为"视频IDx音频ID"）' });
        }

        const queryKey = JSON.stringify({ website, v, p, format });
        if (!downloadQueue[queryKey]) {
            checkDiskSpace(downloadQueue);
            downloadQueue[queryKey] = {
                success: true,
                result: {
                    v,
                    downloading: true,
                    downloadSucceed: false,
                    dest: '正在下载并转换为 H.264 MP4',
                    metadata: ''
                }
            };

            startWorker({
                op: 'download',
                website,
                videoID: v,
                p,
                format
            }, (msg) => {
                downloadQueue[queryKey] = msg;
            });
        }

        res.send(downloadQueue[queryKey]);
    }

    function handleProxyRequest(req, res) {
        const url = req.query.url;
        if (!url?.startsWith('https://i.ytimg.com/') && !url?.match(/^https?:\/\/i\d\.hdslb\.com\//)) {
            return res.status(403).end();
        }

        try {
            const buffer = downloadBinaryUrl(url, Number(config.thumbnailTimeout || 8000));
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.send(buffer);
        } catch (err) {
            console.warn('封面代理失败，已回退直连:', safeError(err).substring(0, 160));
            res.redirect(302, url);
        }
    }

    function loadBlacklist() {
        try {
            if (!existsSync(BLACKLIST_PATH)) return [];
            return readFileSync(BLACKLIST_PATH, 'utf8')
                .split(/\s+/)
                .filter((ip) => ip.trim() && ip.match(/^\d+\.\d+\.\d+\.\d+$/));
        } catch (err) {
            console.warn('黑名单加载失败:', err.message);
            return [];
        }
    }

    function checkDiskSpace(queueRef) {
        try {
            const disks = disk.getDiskInfoSync();
            const cwd = resolve(__dirname);
            const targetDisk = disks.find((d) => isPathOnDisk(cwd, d.mountpoint)) || disks[0];

            if (!targetDisk) return;

            const total = Number(targetDisk.total);
            const available = Number(targetDisk.available);
            if (!Number.isFinite(total) || !Number.isFinite(available) || total <= 0) return;

            const usedPercent = (1 - available / total) * 100;
            if (usedPercent <= DISK_CLEANUP_THRESHOLD) return;

            console.warn(`磁盘占用 ${usedPercent.toFixed(1)}%，清理临时目录: ${TMP_DIR}`);
            if (existsSync(TMP_DIR)) {
                rmSync(TMP_DIR, { recursive: true, force: true });
            }
            mkdirSync(TMP_DIR, { recursive: true });

            Object.keys(queueRef).forEach((key) => delete queueRef[key]);
        } catch (err) {
            console.warn('磁盘空间检查失败:', err.message);
        }
    }

    function startWorker(message, callback) {
        const worker = new Worker(__filename);
        let settled = false;

        const done = (payload) => {
            if (settled) return;
            settled = true;
            if (typeof callback === 'function') callback(payload);
            else callback.send(payload);
            worker.terminate().catch(() => {});
        };

        worker.once('message', (msg) => done(msg));
        worker.once('error', (err) => done({ success: false, error: `Worker执行失败: ${err.message}` }));
        worker.once('exit', (code) => {
            if (!settled && code !== 0) {
                done({ success: false, error: `Worker异常退出: ${code}` });
            }
        });

        worker.postMessage(message);
    }
} else {
    parentPort.once('message', (msg) => {
        const handlers = {
            parse: handleParse,
            download: handleDownload
        };
        if (handlers[msg.op]) handlers[msg.op](msg);
    });

    function handleParse({ website, url, videoID, p }) {
        try {
            const output = runYtDlp([
                '--print-json',
                '--skip-download',
                url
            ], TASK_TIMEOUT.PARSE);

            let info = parseAnyJsonLine(output.stdout);
            if (!info && website === 'bilibili' && !p) {
                const pUrl = `${url}?p=1`;
                const fallback = runYtDlp([
                    '--print-json',
                    '--skip-download',
                    pUrl
                ], TASK_TIMEOUT.PARSE);
                info = parseAnyJsonLine(fallback.stdout);
            }

            if (!info || !Array.isArray(info.formats)) {
                throw new Error('解析视频信息失败，未返回可用格式');
            }

            const { audios, videos } = parseFormats(info.formats);
            const bestAudio = [...audios].sort((a, b) => b.rateValue - a.rateValue)[0] || {};
            const bestVideo = [...videos].sort((a, b) => b.height - a.height || b.rateValue - a.rateValue)[0] || {};
            const thumbnailCandidates = buildThumbnailCandidates(website, videoID, info.thumbnail);

            parentPort.postMessage({
                success: true,
                result: {
                    website,
                    v: videoID,
                    p,
                    title: info.title,
                    thumbnail: thumbnailCandidates[0] || info.thumbnail,
                    thumbnailCandidates,
                    best: { audio: bestAudio, video: bestVideo },
                    available: {
                        audios: audios.map(dropInternalFields),
                        videos: videos.map(dropInternalFields)
                    },
                    note: '所有视频将自动转换为H.264编码的MP4格式'
                }
            });
        } catch (err) {
            parentPort.postMessage({
                success: false,
                error: `解析失败: ${safeError(err).substring(0, 300)}`
            });
        }
    }

    function handleDownload({ website, videoID, p, format }) {
        try {
            const folderParts = [videoID, p ? `p${p}` : null, format].filter(Boolean);
            const downloadDir = join(TMP_DIR, ...folderParts);
            mkdirSync(downloadDir, { recursive: true });

            const url = getWebsiteUrl(website, videoID, p);
            const outputTemplate = join(downloadDir, `${videoID}.%(ext)s`);
            const formatWithFilter = format.replace('x', '+');
            const postprocessorArgs = 'ffmpeg:-c:v libx264 -c:a aac -movflags +faststart';

            runYtDlp([
                url,
                '-f', formatWithFilter,
                '-o', outputTemplate,
                '--recode-video', FORCE_RECODE_FORMAT,
                '--postprocessor-args', postprocessorArgs,
                '--ffmpeg-location', FFMPEG_PATH,
                '--no-playlist',
                '--write-info-json',
                '-k'
            ], TASK_TIMEOUT.DOWNLOAD);

            const destFile = findFileName(downloadDir, new RegExp(`^${escapeRegExp(videoID)}\\.${FORCE_RECODE_FORMAT}$`, 'i'));
            if (!destFile) {
                throw new Error('下载完成但未找到转换后的MP4文件');
            }

            const infoFile = findFileName(downloadDir, new RegExp(`^${escapeRegExp(videoID)}\\.info\\.json$`, 'i'));
            const relativeFolder = toUrlPath(join(...folderParts));

            parentPort.postMessage({
                success: true,
                result: {
                    v: videoID,
                    downloading: false,
                    downloadSucceed: true,
                    dest: `file/${toUrlPath(join(relativeFolder, destFile))}`,
                    metadata: infoFile ? `info/${toUrlPath(join(relativeFolder, infoFile))}` : '',
                    note: `已转换为${FORCE_VIDEO_CODEC}编码的${FORCE_RECODE_FORMAT}格式`
                }
            });
        } catch (err) {
            parentPort.postMessage({
                success: true,
                result: {
                    v: videoID,
                    downloading: false,
                    downloadSucceed: false,
                    dest: '下载或转码失败',
                    metadata: safeError(err).substring(0, 300)
                }
            });
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
                    rateValue: Number(fmt.abr || 0),
                    height: 0
                });
            }

            return acc;
        }, { audios: [], videos: [] });
    }

}

function runYtDlp(args, timeout) {
    const cookieArgs = COOKIE_PATH && existsSync(COOKIE_PATH) ? ['--cookies', COOKIE_PATH] : [];
    const proxyValue = String(config.proxy || '').trim();
    const enableFallbackDirect = config.proxyFallbackDirect !== false;

    if (proxyValue) {
        try {
            return runCommand(YT_DLP_PATH, ['--proxy', proxyValue, ...cookieArgs, ...args], timeout);
        } catch (err) {
            if (!enableFallbackDirect) {
                throw err;
            }

            console.warn(`代理请求失败，回退直连: ${safeError(err).substring(0, 160)}`);
            return runCommand(YT_DLP_PATH, [...cookieArgs, ...args], timeout);
        }
    }

    return runCommand(YT_DLP_PATH, [...cookieArgs, ...args], timeout);
}

function runCommand(command, args, timeout) {
    const result = spawnSync(command, args, {
        encoding: 'utf8',
        windowsHide: true,
        timeout,
        maxBuffer: 20 * 1024 * 1024,
        shell: false
    });

    if (result.error) {
        throw new Error(result.error.message);
    }
    if (result.status !== 0) {
        const output = `${result.stderr || ''}\n${result.stdout || ''}`.trim();
        throw new Error(output || `命令执行失败，退出码: ${result.status}`);
    }

    return {
        stdout: result.stdout || '',
        stderr: result.stderr || ''
    };
}

function checkExternalTools() {
    const ytDlp = checkTool(YT_DLP_PATH, ['--version']);
    const ffmpeg = checkTool(FFMPEG_PATH, ['-version']);
    return { ytDlp, ffmpeg };
}

function checkTool(command, args) {
    const result = spawnSync(command, args, {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 6000,
        shell: false
    });

    if (result.error || result.status !== 0) {
        return {
            ok: false,
            message: result.error?.message || (result.stderr || result.stdout || 'unknown error').trim()
        };
    }

    return {
        ok: true,
        message: (result.stdout || result.stderr || '').trim().split(/\r?\n/)[0] || 'ok'
    };
}

function parseAnyJsonLine(text) {
    const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
        try {
            return JSON.parse(lines[i]);
        } catch (err) {
            continue;
        }
    }
    return null;
}

function dropInternalFields(item) {
    const { rateValue, height, ...rest } = item;
    return rest;
}

function findFileName(dir, regex) {
    if (!existsSync(dir)) return null;
    const file = readdirSync(dir).find((name) => regex.test(name) && statSync(join(dir, name)).isFile());
    return file || null;
}

function escapeRegExp(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toUrlPath(pathText) {
    return String(pathText).replace(/\\/g, '/');
}

function safeError(err) {
    if (!err) return 'unknown error';
    if (typeof err === 'string') return err;
    return err.message || JSON.stringify(err);
}

function buildThumbnailCandidates(website, videoID, sourceThumbnail) {
    const candidates = [];

    if (sourceThumbnail) {
        candidates.push(sourceThumbnail);
    }

    if (website === 'y2b') {
        candidates.push(
            `https://i.ytimg.com/vi/${videoID}/maxresdefault.jpg`,
            `https://i.ytimg.com/vi/${videoID}/hq720.jpg`,
            `https://i.ytimg.com/vi/${videoID}/sddefault.jpg`,
            `https://i.ytimg.com/vi/${videoID}/hqdefault.jpg`,
            `https://i.ytimg.com/vi/${videoID}/mqdefault.jpg`,
            `https://i.ytimg.com/vi/${videoID}/default.jpg`
        );
    }

    return [...new Set(candidates.filter(Boolean))];
}

function buildThumbnailFilename(website, videoID, sourceThumbnail) {
    const first = buildThumbnailCandidates(website, videoID, sourceThumbnail)[0] || sourceThumbnail || '';
    const ext = (first.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1] || 'jpg').toLowerCase();
    return `${videoID}.${ext}`;
}

async function fetchFirstAvailableImage(candidates) {
    const timeoutMs = Number(config.thumbnailTimeout || 8000);

    for (const candidate of candidates) {
        if (!isAllowedThumbnailUrl(candidate)) continue;

        try {
            const buffer = downloadBinaryUrl(candidate, timeoutMs);
            if (!buffer.length) continue;

            return {
                buffer,
                contentType: 'image/jpeg',
                url: candidate
            };
        } catch (err) {
            continue;
        }
    }

    throw new Error('无可用封面图源');
}

function isAllowedThumbnailUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return url.startsWith('https://i.ytimg.com/') || /^https?:\/\/i\d\.hdslb\.com\//.test(url);
}

function downloadBinaryUrl(url, timeoutMs) {
    const proxyValue = String(config.proxy || '').trim();
    const useProxy = proxyValue && config.proxyFallbackDirect !== false;
    const curlPath = 'curl.exe';
    const maxTime = Math.max(1, Math.ceil(Number(timeoutMs || 8000) / 1000));
    const args = [
        '--location',
        '--silent',
        '--show-error',
        '--fail',
        '--max-time', String(maxTime),
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) YoutubeVideoInstaller/1.0'
    ];

    if (useProxy) {
        args.push('--proxy', proxyValue);
    }

    args.push(url);

    const result = spawnSync(curlPath, args, {
        encoding: 'buffer',
        windowsHide: true,
        timeout: timeoutMs,
        maxBuffer: 25 * 1024 * 1024,
        shell: false
    });

    if (result.error) {
        throw new Error(result.error.message);
    }

    if (result.status !== 0) {
        const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8') : String(result.stderr || '');
        throw new Error(stderr.trim() || `curl failed with code ${result.status}`);
    }

    return Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout || []);
}


function isPathOnDisk(filePath, mountpoint) {
    const fileNorm = normalizeDiskPath(filePath);
    const mountNorm = normalizeDiskPath(mountpoint);
    return fileNorm.startsWith(mountNorm);
}

function normalizeDiskPath(pathText) {
    return String(pathText || '')
        .replace(/\//g, '\\')
        .replace(/\\+$/, '')
        .toLowerCase();
}
