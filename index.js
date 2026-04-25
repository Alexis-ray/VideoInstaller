const { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync, readdirSync, statSync } = require('fs');
const { join, resolve, extname } = require('path');
const { spawn, spawnSync } = require('child_process');
const { Worker, isMainThread, parentPort } = require('worker_threads');
const express = require('express');
const { getRemoteIP, getWebsiteUrl } = require('./utils.js');
const https = require('https');
const http = require('http');
const disk = require('node-disk-info');
const packageInfo = require('./package.json');

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
    let lastDiskStatus = {
        checkedAt: null,
        action: 'idle',
        usedPercent: null,
        threshold: DISK_CLEANUP_THRESHOLD,
        activeDownloads: 0,
        tmpDir: TMP_DIR,
        message: ''
    };

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
    app.get('/y2b/open-folder', handleOpenFolderRequest);
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
        const safeUrlPath = safeDecodeURIComponent(req.path || '').replace(/\\/g, '/');
        const infoPath = join(TMP_DIR, safeUrlPath.replace(/^\//, '').replace(/\.[\w\d]+$/, '.info.json'));

        if (existsSync(infoPath)) {
            try {
                const info = JSON.parse(readFileSync(infoPath, 'utf8'));
                const fileExt = extname(safeUrlPath) || '.mp4';
                const filename = `${info.title || 'video'}${fileExt}`;
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
        const healthToolStatus = checkExternalTools();
        const cookieExists = Boolean(COOKIE_PATH && existsSync(COOKIE_PATH));
        const tmpDirExists = existsSync(TMP_DIR);
        const queueEntries = Object.values(downloadQueue);
        const activeDownloads = queueEntries.filter((item) => item?.result?.downloading).length;

        res.send({
            success: true,
            result: {
                name: 'VideoInstaller',
                version: packageInfo.version,
                platform: process.platform,
                windowsOptimized: IS_WINDOWS,
                port: config.port || 2878,
                address: config.address || '127.0.0.1',
                runtime: {
                    tmpDir: TMP_DIR,
                    tmpDirExists,
                    diskCleanupThreshold: DISK_CLEANUP_THRESHOLD,
                    taskTimeout: {
                        parse: TASK_TIMEOUT.PARSE,
                        download: TASK_TIMEOUT.DOWNLOAD
                    },
                    activeDownloads,
                    queuedTasks: queueEntries.length,
                    blacklist: {
                        path: BLACKLIST_PATH,
                        loaded: Array.isArray(blackIPs),
                        count: blackIPs.length
                    },
                    cookie: {
                        configured: Boolean(COOKIE_PATH),
                        path: COOKIE_PATH || '',
                        exists: cookieExists
                    },
                    disk: lastDiskStatus
                },
                proxy: {
                    configured: Boolean((config.proxy || '').trim()),
                    value: config.proxy || '',
                    fallbackDirect: config.proxyFallbackDirect !== false,
                    sitePolicy: {
                        y2b: {
                            proxy: getProxyForWebsite('y2b'),
                            fallbackDirect: shouldEnableProxyFallback('y2b')
                        },
                        b2b: {
                            proxy: getProxyForWebsite('b2b'),
                            fallbackDirect: shouldEnableProxyFallback('b2b')
                        }
                    },
                    env: {
                        HTTP_PROXY: process.env.HTTP_PROXY || '',
                        HTTPS_PROXY: process.env.HTTPS_PROXY || ''
                    }
                },
                toolStatus: healthToolStatus
            }
        });
    }

    async function handleThumbnailRequest(req, res) {
        try {
            const website = String(req.query.website || '').trim();
            const videoID = String(req.query.v || '').trim();
            const title = String(req.query.title || '').trim();
            const sourceThumbnail = String(req.query.src || '').trim();
            const shouldSave = String(req.query.save || req.query.download || '0') === '1';

            if (!isSupportedWebsite(website)) {
                return res.status(400).send({ success: false, error: '参数website错误（仅支持 y2b / b2b）' });
            }
            if (!isValidVideoID(website, videoID)) {
                return res.status(400).send({ success: false, error: '参数v错误（无效视频ID）' });
            }

            const candidates = buildThumbnailCandidates(website, videoID, sourceThumbnail);
            const result = await fetchFirstAvailableImage(candidates);

            if (shouldSave) {
                try {
                    const coverPath = saveThumbnailToFolder(title, videoID, result.buffer, result.url || sourceThumbnail);
                    return res.send({
                        success: true,
                        result: {
                            saved: true,
                            path: coverPath,
                            dest: `file/${toUrlPath(coverPath.replace(`${TMP_DIR}\\`, '').replace(`${TMP_DIR}/`, ''))}`
                        }
                    });
                } catch (saveErr) {
                    return res.status(500).send({
                        success: false,
                        error: `封面保存失败: ${safeError(saveErr).substring(0, 200)}`
                    });
                }
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

    async function handleParseRequest(req, res) {
        const rawInput = typeof req.query.url === 'string'
            ? req.query.url
            : (req._parsedUrl.query || '');
        let url = normalizeInputUrl(safeDecodeURIComponent(rawInput));

        if (/^https?:\/\/b23\.tv\//i.test(url)) {
            try {
                url = await resolveBilibiliShortUrl(url, Number(config.taskTimeout?.parse || 60000));
            } catch (err) {
                return res.send({ success: false, error: `短链解析失败: ${safeError(err).substring(0, 200)}` });
            }
        }

        const parsedTarget = parseSupportedVideoUrl(url);

        if (!parsedTarget) {
            return res.send({ success: false, error: '请提供有效的 YouTube 或 Bilibili 视频 URL' });
        }

        lastDiskStatus = checkDiskSpace(downloadQueue);

        const timeout = setTimeout(() => {
            if (!res.headersSent) {
                res.send({ success: false, error: '解析超时，请重试或检查代理/网络' });
            }
        }, TASK_TIMEOUT.PARSE + 5000);

        startWorker({
            op: 'parse',
            website: parsedTarget.website,
            url,
            videoID: parsedTarget.videoID,
            p: parsedTarget.p,
            sourceUrl: parsedTarget.sourceUrl
        }, (msg) => {
            if (!res.headersSent) {
                clearTimeout(timeout);
                res.send(msg);
            }
        });
    }

    function handleDownloadRequest(req, res) {
        const validation = validateDownloadContext(req.query);
        if (!validation.success) {
            return res.send({ success: false, error: validation.error });
        }

        const {
            website,
            videoID,
            p,
            format,
            sourceUrl,
            title,
            transcode
        } = validation.context;

        const queryKey = JSON.stringify({ website, v: videoID, p, format, transcode, sourceUrl });
        if (!downloadQueue[queryKey]) {
            lastDiskStatus = checkDiskSpace(downloadQueue);
            downloadQueue[queryKey] = {
                success: true,
                result: {
                    v: videoID,
                    format,
                    transcode,
                    phase: 'downloading',
                    downloading: true,
                    downloadSucceed: false,
                    dest: transcode ? '正在下载原始音视频文件' : '正在下载原始文件',
                    metadata: ''
                }
            };

            startWorker({
                op: 'download',
                website,
                videoID,
                title,
                p,
                format,
                transcode,
                sourceUrl
            }, (msg) => {
                if (msg?.success && msg?.result?.phase) {
                    downloadQueue[queryKey] = msg;
                    return;
                }

                if (msg?.success && msg?.result) {
                    downloadQueue[queryKey] = msg;
                    return;
                }

                downloadQueue[queryKey] = msg;
            });
        }

        res.send(downloadQueue[queryKey]);
    }

    function handleOpenFolderRequest(req, res) {
        try {
            const folder = String(req.query.folder || '').trim();
            if (!folder) {
                return res.send({ success: false, error: '参数folder不能为空' });
            }

            const relativeFolder = folder.replace(/^file\//i, '').replace(/^\/+/, '');
            const targetPath = resolve(TMP_DIR, relativeFolder);
            const targetNorm = normalizeDiskPath(targetPath);
            const tmpNorm = normalizeDiskPath(TMP_DIR);

            if (!targetNorm.startsWith(tmpNorm + '\\') && targetNorm !== tmpNorm) {
                return res.send({ success: false, error: '仅允许打开 tmp 目录下的文件夹' });
            }

            if (!existsSync(targetPath) || !statSync(targetPath).isDirectory()) {
                return res.send({ success: false, error: '目标文件夹不存在' });
            }

            if (!IS_WINDOWS) {
                return res.send({ success: false, error: '当前仅支持 Windows 打开文件夹' });
            }

            openFolderInExplorer(targetPath);

            res.send({
                success: true,
                result: {
                    folder,
                    opened: true
                }
            });
        } catch (err) {
            res.send({
                success: false,
                error: `打开文件夹失败: ${safeError(err).substring(0, 200)}`
            });
        }
    }

    function handleProxyRequest(req, res) {
        const url = req.query.url;
        if (!url?.startsWith('https://i.ytimg.com/')
            && !url?.match(/^https?:\/\/i\d\.hdslb\.com\//)
            && !url?.match(/^https?:\/\/w\.hdslb\.com\//)) {
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
        const status = {
            checkedAt: new Date().toISOString(),
            action: 'idle',
            usedPercent: null,
            threshold: DISK_CLEANUP_THRESHOLD,
            activeDownloads: countActiveDownloads(queueRef),
            tmpDir: TMP_DIR,
            message: ''
        };

        try {
            const disks = disk.getDiskInfoSync();
            const targetDisk = disks.find((d) => isPathOnDisk(TMP_DIR, d.mountpoint)) || disks[0];

            if (!targetDisk) {
                status.action = 'skipped';
                status.message = '未识别到可用磁盘信息';
                return status;
            }

            const total = Number(targetDisk.total);
            const available = Number(targetDisk.available);
            if (!Number.isFinite(total) || !Number.isFinite(available) || total <= 0) {
                status.action = 'skipped';
                status.message = '磁盘容量信息无效';
                return status;
            }

            const usedPercent = (1 - available / total) * 100;
            status.usedPercent = Number(usedPercent.toFixed(1));

            if (usedPercent <= DISK_CLEANUP_THRESHOLD) {
                status.message = '磁盘占用正常';
                return status;
            }

            if (status.activeDownloads > 0) {
                status.action = 'deferred';
                status.message = `磁盘占用 ${usedPercent.toFixed(1)}%，存在 ${status.activeDownloads} 个活动任务，暂缓清理`;
                console.warn(status.message);
                return status;
            }

            console.warn(`磁盘占用 ${usedPercent.toFixed(1)}%，清理临时目录: ${TMP_DIR}`);
            if (existsSync(TMP_DIR)) {
                rmSync(TMP_DIR, { recursive: true, force: true });
            }
            mkdirSync(TMP_DIR, { recursive: true });

            Object.keys(queueRef).forEach((key) => delete queueRef[key]);
            status.action = 'cleaned';
            status.message = `磁盘占用 ${usedPercent.toFixed(1)}%，已清理临时目录`;
        } catch (err) {
            status.action = 'error';
            status.message = `磁盘空间检查失败: ${err.message}`;
            console.warn('磁盘空间检查失败:', err.message);
        }

        return status;
    }

    function startWorker(message, callback) {
        const worker = new Worker(__filename);
        let settled = false;
        const isResponse = Boolean(callback && typeof callback.send === 'function');

        const done = (payload) => {
            if (settled) return;
            settled = true;
            if (typeof callback === 'function') callback(payload);
            else callback.send(payload);
            worker.terminate().catch(() => {});
        };

        if (isResponse) {
            worker.once('message', (msg) => done(msg));
        } else {
            worker.on('message', (msg) => {
                if (typeof callback === 'function') callback(msg);
            });
        }
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

    function handleParse({ website, url, videoID, p, sourceUrl }) {
        try {
            const output = runYtDlp([
                '--print-json',
                '--skip-download',
                url
            ], TASK_TIMEOUT.PARSE, { website });

            const info = parseAnyJsonLine(output.stdout);

            const playable = resolvePlayableInfo(info, p);
            if (!playable) {
                throw new Error('解析视频信息失败，未返回可用格式');
            }

            const workingInfo = playable.info;
            const resolvedP = playable.p;
            const parts = playable.parts;

            const resolvedVideoID = resolveVideoID(website, videoID, workingInfo, info);
            if (!isValidVideoID(website, resolvedVideoID)) {
                throw new Error('解析成功但未识别到有效视频ID');
            }

            const { audios, videos } = parseFormats(workingInfo.formats || []);
            const bestAudio = [...audios].sort((a, b) => b.rateValue - a.rateValue)[0] || {};
            const bestVideo = [...videos].sort((a, b) => b.height - a.height || b.rateValue - a.rateValue)[0] || {};
            const source = resolveDownloadSourceUrl(website, sourceUrl || url, workingInfo, info, resolvedP);
            const thumbnailCandidates = buildThumbnailCandidates(website, resolvedVideoID, workingInfo.thumbnail || info.thumbnail);
            const sourceType = detectSourceType(website, source, resolvedP, parts);

            parentPort.postMessage({
                success: true,
                result: {
                    website,
                    v: resolvedVideoID,
                    p: resolvedP,
                    source,
                    sourceType,
                    title: workingInfo.title || info.title,
                    thumbnail: thumbnailCandidates[0] || workingInfo.thumbnail || info.thumbnail,
                    thumbnailCandidates,
                    parts,
                    best: { audio: bestAudio, video: bestVideo },
                    available: {
                        audios: audios.map(dropInternalFields),
                        videos: videos.map(dropInternalFields)
                    },
                    note: '可选择原始格式下载，或转码为H.264 MP4下载'
                }
            });
        } catch (err) {
            parentPort.postMessage({
                success: false,
                error: `解析失败: ${buildSiteAwareError(website, err, 'parse').substring(0, 300)}`
            });
        }
    }

    function handleDownload({ website, videoID, title, p, format, transcode, sourceUrl }) {
        try {
            const fileBase = buildVideoFileBase(title, videoID, p);
            const downloadDir = buildVideoDir(title, videoID);
            mkdirSync(downloadDir, { recursive: true });

            const url = getWebsiteUrl(website, videoID, p, sourceUrl);
            const outputTemplate = join(downloadDir, `${fileBase}.%(ext)s`);
            const formatWithFilter = format.replace('x', '+');
            const downloadArgs = [
                url,
                '-f', formatWithFilter,
                '-o', outputTemplate,
                '--no-playlist',
                '--write-info-json',
                '-k',
                '--ffmpeg-location', FFMPEG_PATH
            ];

            parentPort.postMessage({
                success: true,
                result: {
                    v: videoID,
                    title,
                    format,
                    transcode,
                    phase: 'downloading',
                    downloading: true,
                    downloadSucceed: false,
                    dest: transcode ? '正在下载原始音视频文件' : '正在下载原始文件',
                    metadata: ''
                }
            });

            runYtDlp(downloadArgs, TASK_TIMEOUT.DOWNLOAD, { website });

            const transcodeSource = transcode ? findTranscodeSource(downloadDir, fileBase) : null;
            const sourceFile = transcode
                ? transcodeSource?.videoFile
                : findOutputMediaFile(downloadDir, fileBase);
            if (!sourceFile) {
                throw new Error(transcode ? '下载完成但未找到可用于转码的视频源文件' : '下载完成但未找到原始输出文件');
            }

            let destFile = sourceFile;

            if (transcode) {
                parentPort.postMessage({
                    success: true,
                    result: {
                        v: videoID,
                        title,
                        format,
                        transcode,
                        phase: 'transcoding',
                        downloading: true,
                        downloadSucceed: false,
                        dest: '下载完成，正在转码为 H.264 MP4',
                        metadata: ''
                    }
                });

                const transcodeFileName = `${fileBase}-h264.${FORCE_RECODE_FORMAT}`;
                const ffmpegArgs = ['-y', '-i', join(downloadDir, sourceFile)];

                if (transcodeSource?.audioFile) {
                    ffmpegArgs.push(
                        '-i', join(downloadDir, transcodeSource.audioFile),
                        '-map', '0:v:0',
                        '-map', '1:a:0',
                        '-shortest'
                    );
                }

                ffmpegArgs.push(
                    '-c:v', 'libx264',
                    '-c:a', 'aac',
                    '-movflags', '+faststart',
                    join(downloadDir, transcodeFileName)
                );

                runCommand(FFMPEG_PATH, ffmpegArgs, TASK_TIMEOUT.DOWNLOAD);

                destFile = findFileName(downloadDir, new RegExp(`^${escapeRegExp(fileBase)}-h264\\.${FORCE_RECODE_FORMAT}$`, 'i')) || transcodeFileName;
            }

            if (!destFile || !existsSync(join(downloadDir, destFile))) {
                throw new Error(transcode ? '转码完成但未找到输出的MP4文件' : '下载完成但未找到原始输出文件');
            }

            const infoFile = findFileName(downloadDir, /^(?:.+)\.info\.json$/i) || 'video.info.json';
            const relativeFolder = toUrlPath(sanitizePathSegment(title, videoID));
            const mediaFiles = transcode
                ? buildCompletedMediaResult(downloadDir, relativeFolder, destFile, transcodeSource)
                : buildCompletedMediaResult(downloadDir, relativeFolder, destFile, inspectDownloadedMediaFiles(downloadDir, fileBase));
            let openFolder = {
                attempted: false,
                opened: false,
                error: ''
            };

            if (IS_WINDOWS) {
                openFolder.attempted = true;
                try {
                    const launchResult = openFolderInExplorer(downloadDir);
                    openFolder.opened = Boolean(launchResult?.opened);
                } catch (openErr) {
                    openFolder.error = safeError(openErr).substring(0, 200);
                    console.warn(`自动打开目录失败: ${openFolder.error}`);
                }
            }

            parentPort.postMessage({
                success: true,
                result: {
                    v: videoID,
                    title,
                    format,
                    transcode,
                    phase: 'completed',
                    downloading: false,
                    downloadSucceed: true,
                    folder: `file/${relativeFolder}`,
                    dest: `file/${relativeFolder}/${destFile}`,
                    video: mediaFiles.video,
                    audio: mediaFiles.audio,
                    openFolder,
                    metadata: `info/${toUrlPath(join(relativeFolder, infoFile))}`,
                    note: transcode
                        ? `已转换为${FORCE_VIDEO_CODEC}编码的${FORCE_RECODE_FORMAT}格式（文件后缀: -h264.mp4）`
                        : '已按原始格式下载（未转码）'
                }
            });
        } catch (err) {
            parentPort.postMessage({
                success: true,
                result: {
                    v: videoID,
                    title,
                    phase: 'failed',
                    downloading: false,
                    downloadSucceed: false,
                    dest: transcode ? '下载或转码失败' : '下载失败',
                    video: null,
                    audio: null,
                    error: buildSiteAwareError(website, err, transcode ? 'transcode' : 'download').substring(0, 300),
                    metadata: buildSiteAwareError(website, err, transcode ? 'transcode' : 'download').substring(0, 300)
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

function runYtDlp(args, timeout, options = {}) {
    const cookieArgs = COOKIE_PATH && existsSync(COOKIE_PATH) ? ['--cookies', COOKIE_PATH] : [];
    const proxyValue = getProxyForWebsite(options.website);
    const enableFallbackDirect = shouldEnableProxyFallback(options.website);
    const siteArgs = getSiteYtDlpArgs(options.website);

    if (proxyValue) {
        try {
            return runCommand(YT_DLP_PATH, ['--proxy', proxyValue, ...cookieArgs, ...siteArgs, ...args], timeout);
        } catch (err) {
            if (!enableFallbackDirect) {
                throw err;
            }

            console.warn(`代理请求失败，回退直连: ${safeError(err).substring(0, 160)}`);
            return runCommand(YT_DLP_PATH, [...cookieArgs, ...siteArgs, ...args], timeout);
        }
    }

    return runCommand(YT_DLP_PATH, [...cookieArgs, ...siteArgs, ...args], timeout);
}

function getSiteYtDlpArgs(website) {
    if (website === 'b2b') {
        return [
            '--add-header', 'Referer: https://www.bilibili.com',
            '--add-header', 'Origin: https://www.bilibili.com'
        ];
    }
    return [];
}

function getProxyForWebsite(website) {
    if (website === 'b2b') {
        return '';
    }
    return String(config.proxy || '').trim();
}

function shouldEnableProxyFallback(website) {
    if (website === 'b2b') {
        return false;
    }
    return config.proxyFallbackDirect !== false;
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

function openFolderInExplorer(targetPath) {
    if (!IS_WINDOWS) {
        throw new Error('当前仅支持 Windows 打开文件夹');
    }

    const normalizedPath = resolve(String(targetPath || ''));
    const explorerPath = process.env.WINDIR
        ? join(process.env.WINDIR, 'explorer.exe')
        : 'C:\\Windows\\explorer.exe';

    if (!existsSync(normalizedPath)) {
        throw new Error('目标路径不存在');
    }
    if (!existsSync(explorerPath)) {
        throw new Error('未找到 Windows Explorer');
    }

    const child = spawn(explorerPath, [normalizedPath], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
        shell: false
    });

    if (!child.pid) {
        throw new Error('Windows Explorer 启动失败');
    }

    child.unref();
    return {
        opened: true,
        path: normalizedPath
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

function resolvePlayableInfo(info, requestedP) {
    if (!info || typeof info !== 'object') return null;

    if (Array.isArray(info.formats) && info.formats.length) {
        const parts = buildPartsFromEntries(info.entries, info.webpage_url || info.original_url || info.url || '');
        const p = normalizePartNo('b2b', requestedP, info);
        return {
            info,
            p,
            parts
        };
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
        const pNo = index + 1;
        const title = String(entry?.title || '').trim() || `分P ${pNo}`;
        const entryUrl = String(entry?.webpage_url || entry?.url || '').trim();
        const url = entryUrl || appendPartToUrl(baseUrl, pNo);
        return {
            p: String(pNo),
            title,
            url
        };
    });
}

function appendPartToUrl(url, p) {
    const base = String(url || '').trim();
    if (!base) return '';
    const cleaned = base.replace(/([?&])p=\d+/i, '$1').replace(/[?&]$/, '');
    const hasQuery = cleaned.includes('?');
    return `${cleaned}${hasQuery ? '&' : '?'}p=${p}`;
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

function detectSourceType(website, source, p, parts) {
    const text = String(source || '').trim();
    if (website === 'y2b') {
        if (/^https?:\/\/youtu\.be\//i.test(text)) return 'youtube-shortlink';
        if (/\/shorts(?:\/|\?|$)/i.test(text)) return 'youtube-short';
        return 'youtube-watch';
    }
    if (/^https?:\/\/b23\.tv\//i.test(text)) return 'bilibili-short';
    if (/\/bangumi\/play\/ep\d+/i.test(text)) return 'bilibili-bangumi-episode';
    if (/\/bangumi\/play\/ss\d+/i.test(text)) return 'bilibili-bangumi-season';
    if (/\/medialist\/play\/ml\d+/i.test(text)) return 'bilibili-medialist';
    if (Array.isArray(parts) && parts.length > 1) return 'bilibili-multi-part';
    if (p) return 'bilibili-part';
    return 'bilibili-video';
}

function normalizeInputUrl(url) {
    return String(url || '')
        .trim()
        .replace('y2b', 'youtube')
        .replace('y2', 'youtu');
}

async function resolveBilibiliShortUrl(shortUrl, timeoutMs) {
    const maxRedirects = 6;
    let current = String(shortUrl || '').trim();
    if (!current) {
        throw new Error('短链为空');
    }

    for (let i = 0; i < maxRedirects; i += 1) {
        const result = await requestUrlWithRedirect(current, timeoutMs);
        const nextUrl = result.location;
        if (!nextUrl) {
            return result.finalUrl || current;
        }
        current = nextUrl;
    }

    return current;
}

function requestUrlWithRedirect(inputUrl, timeoutMs) {
    return new Promise((resolvePromise, rejectPromise) => {
        let targetUrl;
        try {
            targetUrl = new URL(inputUrl);
        } catch (err) {
            rejectPromise(new Error('无效URL'));
            return;
        }

        const client = targetUrl.protocol === 'http:' ? http : https;
        const req = client.request(targetUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VideoInstaller/1.1',
                'Accept': '*/*'
            },
            timeout: Math.max(1000, Number(timeoutMs || 10000))
        }, (resp) => {
            const statusCode = Number(resp.statusCode || 0);
            const location = String(resp.headers.location || '').trim();
            resp.resume();

            if (statusCode >= 300 && statusCode < 400 && location) {
                const nextUrl = new URL(location, targetUrl).toString();
                return resolvePromise({ location: nextUrl, finalUrl: targetUrl.toString() });
            }

            resolvePromise({ location: '', finalUrl: targetUrl.toString() });
        });

        req.on('timeout', () => {
            req.destroy(new Error('请求超时'));
        });
        req.on('error', (err) => rejectPromise(err));
        req.end();
    });
}

function parseSupportedVideoUrl(url) {
    const input = String(url || '').trim();
    if (!input) return null;

    const y2bMatch = input.match(/^https?:\/\/(?:youtu\.be\/|(?:www|m)\.youtube\.com\/(?:watch|shorts)(?:\/|\?v=))([\w-]{11})/i);
    if (y2bMatch) {
        const sourceType = /^https?:\/\/youtu\.be\//i.test(input)
            ? 'youtube-shortlink'
            : (/\/shorts(?:\/|\?|$)/i.test(input) ? 'youtube-short' : 'youtube-watch');
        return {
            website: 'y2b',
            videoID: y2bMatch[1],
            p: null,
            sourceUrl: input,
            sourceType
        };
    }

    const b2bMatch = input.match(/^https?:\/\/(?:www\.)?bilibili\.com\/video\/(BV[0-9A-Za-z]{10}|av\d+)/i);
    if (b2bMatch) {
        const pMatch = input.match(/[?&]p=(\d+)/i);
        return {
            website: 'b2b',
            videoID: b2bMatch[1],
            p: pMatch ? String(Number(pMatch[1])) : null,
            sourceUrl: input
        };
    }

    const bangumiMatch = input.match(/^https?:\/\/(?:www\.)?bilibili\.com\/bangumi\/play\/(ep\d+|ss\d+)/i);
    if (bangumiMatch) {
        return {
            website: 'b2b',
            videoID: bangumiMatch[1],
            p: null,
            sourceUrl: input
        };
    }

    const mediaListMatch = input.match(/^https?:\/\/(?:www\.)?bilibili\.com\/medialist\/play\/(ml\d+)/i);
    if (mediaListMatch) {
        return {
            website: 'b2b',
            videoID: mediaListMatch[1],
            p: null,
            sourceUrl: input
        };
    }

    if (/^https?:\/\/(?:www\.)?bilibili\.com\//i.test(input)) {
        return {
            website: 'b2b',
            videoID: extractBilibiliIDFromUrl(input),
            p: null,
            sourceUrl: input
        };
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
    if (website === 'b2b') return /^(BV[0-9A-Za-z]{10}|av\d+|ep\d+|ss\d+|md\d+|ml\d+)$/i.test(id);
    return false;
}

function isValidWebsiteSourceUrl(website, sourceUrl) {
    const url = String(sourceUrl || '').trim();
    if (!url) return false;
    if (website === 'y2b') {
        return /^https?:\/\/(?:youtu\.be\/|(?:www|m)\.youtube\.com\/)/i.test(url);
    }
    if (website === 'b2b') {
        return /^https?:\/\/(?:b23\.tv\/|(?:www\.)?bilibili\.com\/)/i.test(url);
    }
    return false;
}

function extractBilibiliIDFromUrl(url) {
    const text = String(url || '').trim();
    const match = text.match(/(?:\/video\/)(BV[0-9A-Za-z]{10}|av\d+)|(?:\/bangumi\/play\/)(ep\d+|ss\d+)|(?:\/medialist\/play\/)(ml\d+)/i);
    if (!match) return '';
    return (match[1] || match[2] || match[3] || '').trim();
}

function normalizePartNo(website, p, info) {
    if (website !== 'b2b') return p || null;

    const pages = Array.isArray(info.entries) ? info.entries : [];
    if (!pages.length) return p || null;

    const requested = Number(p || 0);
    if (requested > 0) return String(requested);

    const pageNo = Number(info?.webpage_url?.match(/[?&]p=(\d+)/i)?.[1] || 0);
    return pageNo > 0 ? String(pageNo) : '1';
}

function resolveVideoID(website, requestedVideoID, info, rootInfo) {
    const requested = String(requestedVideoID || '').trim();
    if (isValidVideoID(website, requested)) {
        return requested;
    }

    const infoID = String(info?.id || '').trim();
    if (isValidVideoID(website, infoID)) {
        return infoID;
    }

    const rootID = String(rootInfo?.id || '').trim();
    if (isValidVideoID(website, rootID)) {
        return rootID;
    }

    if (website === 'b2b') {
        const candidates = [
            String(info?.webpage_url || '').trim(),
            String(rootInfo?.webpage_url || '').trim(),
            String(info?.original_url || '').trim(),
            String(rootInfo?.original_url || '').trim(),
            String(info?.url || '').trim(),
            String(rootInfo?.url || '').trim()
        ];
        for (const candidate of candidates) {
            const extracted = extractBilibiliIDFromUrl(candidate);
            if (extracted) {
                return extracted;
            }
        }
    }

    return infoID || requested;
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

function findOutputMediaFile(dir, fileBase) {
    if (!existsSync(dir)) return null;
    const prefix = `${fileBase}.`;
    const ignoredExt = new Set(['.json', '.txt', '.description', '.part', '.ytdl', '.tmp', '.temp']);

    const candidates = readdirSync(dir)
        .filter((name) => name.startsWith(prefix))
        .filter((name) => statSync(join(dir, name)).isFile())
        .filter((name) => {
            const lower = name.toLowerCase();
            if (lower.endsWith('.info.json')) return false;
            const ext = extname(lower);
            return !ignoredExt.has(ext);
        })
        .map((name) => ({
            name,
            mtime: statSync(join(dir, name)).mtimeMs
        }))
        .sort((a, b) => b.mtime - a.mtime);

    return candidates[0]?.name || null;
}

function findTranscodeSource(dir, fileBase) {
    if (!existsSync(dir)) return null;
    const prefix = `${fileBase}.`;
    const ignoredExt = new Set(['.json', '.txt', '.description', '.part', '.ytdl', '.tmp', '.temp']);
    const preferredVideoExt = new Set(['.mkv', '.mp4', '.webm', '.mov']);
    const preferredAudioExt = new Set(['.m4a', '.aac', '.opus', '.mp3', '.ogg', '.webm']);

    const candidates = readdirSync(dir)
        .filter((name) => name.startsWith(prefix))
        .filter((name) => statSync(join(dir, name)).isFile())
        .filter((name) => {
            const lower = name.toLowerCase();
            if (lower.endsWith('.info.json')) return false;
            const ext = extname(lower);
            return !ignoredExt.has(ext);
        })
        .map((name) => {
            const fullPath = join(dir, name);
            const stats = statSync(fullPath);
            const stream = detectMediaStream(fullPath);
            return {
                name,
                fullPath,
                ext: extname(name).toLowerCase(),
                size: stats.size,
                mtime: stats.mtimeMs,
                hasVideo: stream.hasVideo,
                hasAudio: stream.hasAudio
            };
        })
        .sort((a, b) => b.mtime - a.mtime);

    const muxed = candidates.find((item) => item.hasVideo && item.hasAudio && preferredVideoExt.has(item.ext))
        || candidates.find((item) => item.hasVideo && item.hasAudio);
    if (muxed) {
        return { videoFile: muxed.name, audioFile: null };
    }

    const largestContainer = [...candidates]
        .filter((item) => preferredVideoExt.has(item.ext))
        .sort((a, b) => b.size - a.size || b.mtime - a.mtime)[0];
    if (largestContainer) {
        return { videoFile: largestContainer.name, audioFile: null };
    }

    const videoOnly = candidates.find((item) => item.hasVideo && preferredVideoExt.has(item.ext))
        || candidates.find((item) => item.hasVideo);
    if (!videoOnly) return null;

    const audioOnly = candidates.find((item) => !item.hasVideo && item.hasAudio && preferredAudioExt.has(item.ext))
        || candidates.find((item) => !item.hasVideo && item.hasAudio);

    return {
        videoFile: videoOnly.name,
        audioFile: audioOnly?.name || null
    };
}

function inspectDownloadedMediaFiles(dir, fileBase) {
    if (!existsSync(dir)) return { videoFile: null, audioFile: null };

    const prefix = `${fileBase}.`;
    const ignoredExt = new Set(['.json', '.txt', '.description', '.part', '.ytdl', '.tmp', '.temp']);
    const files = readdirSync(dir)
        .filter((name) => name.startsWith(prefix))
        .filter((name) => statSync(join(dir, name)).isFile())
        .filter((name) => {
            const lower = name.toLowerCase();
            if (lower.endsWith('.info.json')) return false;
            return !ignoredExt.has(extname(lower));
        })
        .map((name) => {
            const stream = detectMediaStream(join(dir, name));
            return {
                name,
                hasVideo: stream.hasVideo,
                hasAudio: stream.hasAudio,
                mtime: statSync(join(dir, name)).mtimeMs
            };
        })
        .sort((a, b) => b.mtime - a.mtime);

    const muxed = files.find((file) => file.hasVideo && file.hasAudio);
    if (muxed) {
        return {
            videoFile: muxed.name,
            audioFile: muxed.name
        };
    }

    const videoOnly = files.find((file) => file.hasVideo);
    const audioOnly = files.find((file) => !file.hasVideo && file.hasAudio);
    return {
        videoFile: videoOnly?.name || null,
        audioFile: audioOnly?.name || null
    };
}

function buildCompletedMediaResult(downloadDir, relativeFolder, destFile, media) {
    const result = {
        video: null,
        audio: null
    };

    const videoFile = media?.videoFile && existsSync(join(downloadDir, media.videoFile))
        ? media.videoFile
        : null;
    const audioFile = media?.audioFile && existsSync(join(downloadDir, media.audioFile))
        ? media.audioFile
        : null;

    if (videoFile) {
        result.video = `file/${relativeFolder}/${videoFile}`;
    }
    if (audioFile) {
        result.audio = `file/${relativeFolder}/${audioFile}`;
    }

    if ((!result.video || !result.audio) && destFile && existsSync(join(downloadDir, destFile))) {
        const detected = detectMediaStream(join(downloadDir, destFile));
        const destUrl = `file/${relativeFolder}/${destFile}`;

        if (!result.video && detected.hasVideo) {
            result.video = destUrl;
        }
        if (!result.audio && detected.hasAudio) {
            result.audio = destUrl;
        }
    }

    return result;
}

function countActiveDownloads(queueRef) {
    return Object.values(queueRef || {}).filter((item) => item?.result?.downloading).length;
}

function safeDecodeURIComponent(value) {
    const text = String(value || '');
    try {
        return decodeURIComponent(text);
    } catch (err) {
        return text;
    }
}

function validateDownloadContext(query) {
    const website = String(query.website || '').trim();
    const videoID = String(query.v || '').trim();
    const p = String(query.p || '').trim();
    const format = String(query.format || '').trim();
    const sourceUrl = String(query.source || '').trim();
    const title = String(query.title || '').trim();
    const transcodeRaw = String(query.transcode ?? '1').trim().toLowerCase();
    const transcode = !['0', 'false', 'no'].includes(transcodeRaw);

    if (!isSupportedWebsite(website)) {
        return { success: false, error: '参数website错误（仅支持 y2b / b2b）' };
    }
    if (p && !/^\d+$/.test(p)) {
        return { success: false, error: '参数p错误（无效分P编号）' };
    }
    if (!format || !/^([\w\d-]+)(?:x([\w\d-]+))?$/.test(format)) {
        return { success: false, error: '参数format格式错误（应为"视频IDx音频ID"）' };
    }

    const hasValidVideoID = isValidVideoID(website, videoID);
    const hasValidSourceUrl = isValidWebsiteSourceUrl(website, sourceUrl);

    if (!hasValidVideoID && !hasValidSourceUrl) {
        return { success: false, error: '参数v错误（无效视频ID）' };
    }

    return {
        success: true,
        context: {
            website,
            videoID,
            p: p || null,
            format,
            sourceUrl: hasValidSourceUrl ? sourceUrl : '',
            title,
            transcode
        }
    };
}

function detectMediaStream(filePath) {
    try {
        const result = spawnSync(FFMPEG_PATH, ['-i', filePath], {
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
    } catch (err) {
        return { hasVideo: false, hasAudio: false };
    }
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

function buildSiteAwareError(website, err, stage) {
    const base = safeError(err);
    if (website !== 'b2b') return base;

    const lower = String(base).toLowerCase();
    const cookieMissing = [
        'login', 'cookie', '403', 'forbidden', 'permission',
        '需要登录', '会员', '地区', '风控', 'access denied'
    ].some((key) => lower.includes(key));

    if (!cookieMissing) return base;

    const stageText = stage === 'parse'
        ? '解析阶段'
        : (stage === 'transcode' ? '下载/转码阶段' : '下载阶段');

    return `${base}（Bilibili ${stageText}可能需要有效 cookies.txt 或更高账号权限）`;
}

function sanitizePathSegment(text, fallback = 'video') {
    const normalized = String(text || '').trim()
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        .replace(/\s+/g, ' ')
        .replace(/[. ]+$/g, '');

    const cleaned = normalized.length ? normalized : fallback;
    return cleaned.slice(0, 120);
}

function buildVideoFileBase(title, videoID, p) {
    const safeTitle = sanitizePathSegment(title, videoID);
    return p ? `${safeTitle}-p${p}` : safeTitle;
}

function buildVideoDir(title, videoID) {
    return join(TMP_DIR, sanitizePathSegment(title, videoID));
}

function buildCoverPath(title, videoID, ext = '.jpg') {
    const normalizedExt = ext.startsWith('.') ? ext : `.${ext}`;
    return join(buildVideoDir(title, videoID), `cover${normalizedExt}`);
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
    } else if (website === 'b2b') {
        candidates.push(
            `https://i0.hdslb.com/bfs/archive/${videoID}.jpg`,
            `https://i1.hdslb.com/bfs/archive/${videoID}.jpg`,
            `https://i2.hdslb.com/bfs/archive/${videoID}.jpg`
        );
    }

    return [...new Set(candidates.filter(Boolean))];
}

function saveThumbnailToFolder(title, videoID, buffer, sourceThumbnail) {
    const ext = `.${(sourceThumbnail?.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1] || 'jpg').toLowerCase()}`;
    const dir = buildVideoDir(title, videoID);
    mkdirSync(dir, { recursive: true });
    const coverPath = buildCoverPath(title, videoID, ext);
    writeFileSync(coverPath, buffer);
    return coverPath;
}

function buildInfoPath(title, videoID) {
    return join(buildVideoDir(title, videoID), 'video.info.json');
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
    return url.startsWith('https://i.ytimg.com/')
        || /^https?:\/\/i\d\.hdslb\.com\//.test(url)
        || /^https?:\/\/w\.hdslb\.com\//.test(url);
}

function downloadBinaryUrl(url, timeoutMs) {
    const proxyValue = getProxyForUrl(url);
    const useProxy = Boolean(proxyValue);
    const curlPath = 'curl.exe';
    const maxTime = Math.max(1, Math.ceil(Number(timeoutMs || 8000) / 1000));
    const args = [
        '--location',
        '--silent',
        '--show-error',
        '--fail',
        '--max-time', String(maxTime),
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VideoInstaller/1.1'
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

function getProxyForUrl(url) {
    const text = String(url || '').trim();
    if (!text) return '';
    if (/^https?:\/\/(?:i\.ytimg\.com|(?:www\.)?(?:youtube\.com|youtu\.be))/i.test(text)) {
        return String(config.proxy || '').trim();
    }
    if (/^https?:\/\/(?:i\d\.hdslb\.com|w\.hdslb\.com|(?:www\.)?bilibili\.com|b23\.tv)/i.test(text)) {
        return '';
    }
    return String(config.proxy || '').trim();
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
