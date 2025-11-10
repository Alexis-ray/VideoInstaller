const { existsSync, readFileSync, rmSync, mkdirSync, writeFileSync } = require('fs');
const { join, resolve } = require('path');
const { execSync } = require('child_process');
const { Worker, isMainThread, parentPort } = require('worker_threads');
const express = require('express');
const { json } = require('body-parser');
const { getRemoteIP, getWebsiteUrl } = require('./utils.js');
const https = require('https');
const http = require('http');
const disk = require('node-disk-info');

// 配置与常量定义
const config = require('./config.json');
const TMP_DIR = resolveLongPath(join(__dirname, 'tmp'));
const BILI_DIR = resolveLongPath(join(__dirname, 'bilibili'));
const BLACKLIST_PATH = resolve(__dirname, config.blacklist || 'blacklist.txt');
const COOKIE_PATH = config.cookie ? resolve(__dirname, config.cookie) : null;

const YT_DLP_PATH = config.ytDlpPath ? resolve(__dirname, config.ytDlpPath) : 'yt-dlp';
const FFMPEG_PATH = config.ffmpegPath ? resolve(__dirname, config.ffmpegPath) : 'ffmpeg';

// 强制转码为H.264编码的MP4格式
const FORCE_RECODE_FORMAT = 'mp4';
const FORCE_VIDEO_CODEC = 'h264';
const TASK_TIMEOUT = {
    PARSE: 60000,
    DOWNLOAD: 3600000, // 延长下载超时时间（60分钟），因为增加了转码步骤
    SUBTITLE: 30000
};

// 初始化目录
[TMP_DIR, BILI_DIR].forEach(dir => {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
});

// 工具函数
function resolveLongPath(path) {
    if (process.platform === 'win32') {
        const resolved = resolve(path);
        return resolved.startsWith('\\\\?\\') ? resolved : `\\\\?\\${resolved}`;
    }
    return resolve(path);
}

// 主线程逻辑
if (isMainThread) {
    const app = express();
    let blackIPs = loadBlacklist();
    const downloadQueue = {};

    // 中间件配置
    app.use('/y2b', (req, res, next) => {
        config.disable
            ? res.send({ success: false, error: '服务已暂停使用' })
            : next();
    });

    app.use((req, res, next) => {
        const clientIP = getRemoteIP(req);
        console.log(`[${new Date().toISOString()}] ${clientIP} => ${req.url}`);

        blackIPs.includes(clientIP)
            ? res.status(500).send(`<div style='font-size: 33vw; text-align: center'>500</div>`)
            : next();
    });

    // 静态资源路由
    app.use('/', express.static(join(__dirname, 'static')));
    app.use('/file', setDownloadHeaders, express.static(TMP_DIR));
    app.use('/info', express.static(TMP_DIR));
    app.use('/bili_file', express.static(BILI_DIR));

    // API 路由
    app.get('/y2b/parse', handleParseRequest);
    app.get('/y2b/download', handleDownloadRequest);
    app.use(json());
    app.post('/y2b/subtitle', handleSubtitleRequest);
    app.get('/pxy', handleProxyRequest);

    // 启动服务
    app.listen(config.port || 2878, config.address || '127.0.0.1', () => {
        console.log(`服务已启动，监听: http://${config.address || '127.0.0.1'}:${config.port || 2878}`);
        console.log(`支持的功能: 强制H.264编码MP4转换 | 4K下载 | 字幕处理 | 跨平台兼容`);
    });

    // 路由处理函数
    function setDownloadHeaders(req, res, next) {
        console.log(`[下载请求] ${req.url}`);
        const infoPath = join(TMP_DIR, req.url.replace(/\.\w+$/, '.info.json'));

        if (existsSync(infoPath)) {
            try {
                const info = JSON.parse(readFileSync(infoPath, 'utf8'));
                const ext = '.mp4'; // 强制使用mp4扩展名
                const filename = `${info.title || 'video'}${ext}`;
                res.setHeader('Content-Disposition',
                    `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
            } catch (err) {
                console.warn('文件名处理失败:', err.message);
            }
        }
        next();
    }

    function handleParseRequest(req, res) {
        const url = decodeURIComponent(req._parsedUrl.query || '').replace('y2b', 'youtube').replace('y2', 'youtu');
        console.log(`[解析任务] URL: ${url}`);

        const [y2bMatch, biliMatch] = [
            url.match(/^https?:\/\/(?:youtu.be\/|(?:www|m).youtube.com\/(?:watch|shorts)(?:\/|\?v=))([\w-]{11})$/),
            url.match(/^https?:\/\/(?:www\.|m\.)?bilibili\.com\/video\/([\w\d]{11,14})\/?(?:\?p=(\d+))?$/)
        ];

        if (!y2bMatch && !biliMatch) {
            return res.send({ success: false, error: '请提供有效的YouTube或B站视频URL' });
        }

        checkDiskSpace();
        startWorker({
            op: 'parse',
            website: y2bMatch ? 'y2b' : 'bilibili',
            url,
            videoID: (y2bMatch || biliMatch)[1],
            p: biliMatch?.[2]
        }, res);
    }

    function handleDownloadRequest(req, res) {
        const { website, v, p, format, subs } = req.query; // 移除recode和codec参数，因为我们强制转码

        if (!v?.match(/^[\w-]{11,14}$/)) {
            return res.send({ success: false, error: '参数v错误（无效视频ID）' });
        }
        if (p && !p.match(/^[\d]+$/)) {
            return res.send({ success: false, error: '参数p错误（无效分P编号）' });
        }
        if (!format?.match(/^([\w\d-]+)(?:x([\w\d-]+))?$/)) {
            return res.send({ success: false, error: '参数format格式错误（应为"视频IDx音频ID"）' });
        }

        const queryKey = JSON.stringify({ website, v, p, format, subs }); // 移除recode和codec
        if (!downloadQueue[queryKey]) {
            checkDiskSpace();
            downloadQueue[queryKey] = {
                success: true,
                result: {
                    v,
                    downloading: true,
                    downloadSucceed: false,
                    dest: '正在下载中，将自动转换为H.264编码的MP4格式',
                    metadata: ''
                }
            };

            startWorker({
                op: 'download',
                website,
                videoID: v,
                p,
                format,
                subs,
                // 强制设置转码参数
                recode: FORCE_RECODE_FORMAT,
                codec: FORCE_VIDEO_CODEC
            }, (msg) => downloadQueue[queryKey] = msg);
        }

        res.send(downloadQueue[queryKey]);
    }

    function handleSubtitleRequest(req, res) {
        const { website, id, p, locale, ext, type } = req.body;

        if (!id?.match(/^[\w-]{11,14}$/) ||
            !ext?.match(/^.(srt|ass|vtt|lrc|xml)$/) ||
            !type?.match(/^(auto|native)$/) ||
            (p && !p.match(/^[\d]+$/))
        ) {
            console.log('无效字幕请求:', req.body);
            return res.send({ success: false });
        }

        startWorker({
            op: 'subtitle',
            website,
            id,
            p,
            locale,
            ext,
            type
        }, res);
    }

    function handleProxyRequest(req, res) {
        const url = req.query.url;
        if (!url?.startsWith('https://i.ytimg.com/') && !url?.match(/^https?:\/\/i\d\.hdslb\.com\//)) {
            return res.status(403).end();
        }

        (url.startsWith('https') ? https : http).get(url, (response) => {
            res.writeHead(response.statusCode, response.headers);
            response.pipe(res);
        }).on('error', (err) => {
            console.error('代理请求错误:', err);
            res.status(502).end();
        });
    }

    // 辅助函数
    function loadBlacklist() {
        try {
            if (existsSync(BLACKLIST_PATH)) {
                return readFileSync(BLACKLIST_PATH, 'utf8')
                    .split(/\s+/)
                    .filter(ip => ip.trim() && ip.match(/^\d+\.\d+\.\d+\.\d+$/));
            }
        } catch (err) {
            console.warn('黑名单加载失败:', err.message);
        }
        return [];
    }

    function checkDiskSpace() {
        try {
            const disks = disk.getDiskInfoSync();
            const targetDisk = disks.find(d => resolve(__dirname).startsWith(d.mountpoint));

            if (targetDisk) {
                const usedPercent = (1 - targetDisk.available / targetDisk.total) * 100;
                console.log(`磁盘空间占用: ${usedPercent.toFixed(1)}%`);

                if (usedPercent > 90) {
                    console.log('磁盘空间不足，清理临时文件...');
                    [TMP_DIR, BILI_DIR].forEach(dir => {
                        if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
                        mkdirSync(dir, { recursive: true });
                    });
                    Object.keys(downloadQueue).forEach(key => delete downloadQueue[key]);
                }
            }
        } catch (err) {
            console.error('磁盘空间检查失败:', err.message);
        }
    }

    function startWorker(message, callback) {
        const worker = new Worker(__filename);
        worker.once('message', msg => {
            if (typeof callback === 'function') callback(msg);
            else callback.send(msg);
            worker.terminate().catch(err => console.warn('Worker终止失败:', err.message));
        });
        worker.postMessage(message);
    }
}
// Worker线程逻辑
else {
    parentPort.once('message', (msg) => {
        const handlers = {
            subtitle: handleSubtitle,
            parse: handleParse,
            download: handleDownload
        };
        if (handlers[msg.op]) handlers[msg.op](msg);
    });

    function handleSubtitle({ website, id, p, locale, ext, type }) {
        try {
            const subDir = resolveLongPath(join(TMP_DIR, `${id}${p ? `/p${p}` : ''}`));
            mkdirSync(subDir, { recursive: true });

            const url = getWebsiteUrl(website, id, p);
            const outputPath = resolveLongPath(join(subDir, `%(id)s.%(ext)s`));
            const cookieParam = COOKIE_PATH && existsSync(COOKIE_PATH) ? `--cookies "${COOKIE_PATH}"` : '';
            const subType = type === 'native' ? '--write-sub' : '--write-auto-sub';
            const proxyParam = config.proxy ? `--proxy "${config.proxy}"` : '';

            const cmd = [
                `"${YT_DLP_PATH}" ${subType} --sub-lang "${locale}"`,
                `-o "${outputPath}" --skip-download --write-info-json`,
                `"${url}" ${cookieParam} ${proxyParam} 2> nul`
            ].join(' ');

            console.log(`[字幕命令] ${cmd}`);
            execSync(cmd, { stdio: 'pipe', timeout: TASK_TIMEOUT.SUBTITLE });

            const infoPath = join(subDir, `${id}.info.json`);
            if (!existsSync(infoPath)) throw new Error('未找到字幕信息文件');

            const info = JSON.parse(readFileSync(infoPath, 'utf8'));
            const srcExt = website === 'y2b' ? 'vtt' : 'srt';
            const srcFile = join(subDir, `${id}.${locale}.${srcExt}`);
            const destFile = join(subDir, `${id}.${locale}${ext}`);

            if (existsSync(srcFile) && srcFile !== destFile) {
                const ffmpegCmd = `"${FFMPEG_PATH}" -i "${srcFile}" "${destFile}" -y 2> nul`;
                console.log(`[字幕转换] ${ffmpegCmd}`);
                execSync(ffmpegCmd, { stdio: 'pipe', timeout: TASK_TIMEOUT.SUBTITLE });
            }

            const subContent = readFileSync(destFile, 'utf8');
            parentPort.postMessage({
                success: true,
                title: info.title || 'subtitle',
                filename: `${info.title || 'subtitle'}.${locale}${ext}`,
                text: Buffer.from(subContent).toString('base64')
            });
        } catch (err) {
            const errorMsg = err.stderr?.toString() || err.message;
            console.error('字幕处理失败:', errorMsg);
            parentPort.postMessage({ success: false, error: errorMsg.substring(0, 200) });
        }
    }

    function handleParse({ website, url, videoID, p }) {
        try {
            const cookieParam = COOKIE_PATH && existsSync(COOKIE_PATH) ? `--cookies "${COOKIE_PATH}"` : '';
            const proxyParam = config.proxy ? `--proxy "${config.proxy}"` : '';
            let cmd = `"${YT_DLP_PATH}" ${proxyParam} --print-json --skip-download ${cookieParam} "${url}" 2> nul`;

            console.log(`[解析命令] ${cmd}`);
            let rs = execSync(cmd, { stdio: 'pipe', timeout: TASK_TIMEOUT.PARSE }).toString().trim();

            if (!rs) {
                console.log('尝试分P解析...');
                const pUrl = `${url}?p=1`;
                cmd = `"${YT_DLP_PATH}" ${proxyParam} --print-json --skip-download ${cookieParam} "${pUrl}" 2> nul`;
                rs = execSync(cmd, { stdio: 'pipe', timeout: TASK_TIMEOUT.PARSE }).toString().trim();
            }

            if (!rs) throw new Error('解析视频信息失败');
            const info = JSON.parse(rs);

            const { audios, videos } = info.formats.reduce((acc, fmt) => {
                const size = fmt.filesize || fmt.filesize_approx || 0;
                const sizeStr = size ? `${(size / 1024 / 1024).toFixed(2)}MB` : '未知';

                if (fmt.video_ext !== 'none') {
                    acc.videos.push({
                        id: fmt.format_id,
                        format: fmt.ext,
                        codec: fmt.vcodec || '未知',
                        scale: fmt.resolution || '未知',
                        frame: fmt.fps ? `${fmt.fps}fps` : '未知',
                        rate: fmt.vbr ? `${fmt.vbr.toFixed(0)}kbps` : '未知',
                        info: fmt.format_note || '无描述',
                        size: sizeStr
                    });
                } else if (fmt.audio_ext !== 'none') {
                    acc.audios.push({
                        id: fmt.format_id,
                        format: fmt.ext,
                        rate: fmt.abr ? `${fmt.abr.toFixed(0)}kbps` : '未知',
                        info: fmt.format_note || '无描述',
                        size: sizeStr
                    });
                }
                return acc;
            }, { audios: [], videos: [] });

            const bestAudio = [...audios].sort((a, b) => b.rate.localeCompare(a.rate))[0] || {};
            const bestVideo = [...videos].sort((a, b) => b.rate.localeCompare(a.rate))[0] || {};
            const subs = parseSubtitle({ url });

            parentPort.postMessage({
                success: true,
                result: {
                    website,
                    v: videoID,
                    p,
                    title: info.title,
                    thumbnail: info.thumbnail,
                    best: { audio: bestAudio, video: bestVideo },
                    available: { audios, videos, subs },
                    note: "所有视频将自动转换为H.264编码的MP4格式"
                }
            });
        } catch (err) {
            const errorMsg = err.stderr?.toString() || err.message;
            console.error('视频解析失败:', errorMsg);
            parentPort.postMessage({ success: false, error: `解析失败: ${errorMsg.substring(0, 200)}` });
        }
    }

    function handleDownload({ website, videoID, p, format, subs, recode, codec }) {
        try {
            const path = `${videoID}${p ? `/p${p}` : ''}/${format}`;
            const downloadDir = resolveLongPath(join(TMP_DIR, path));
            mkdirSync(downloadDir, { recursive: true });

            const url = getWebsiteUrl(website, videoID, p);
            // 输出文件名强制为MP4
            const outputPath = resolveLongPath(join(downloadDir, `${videoID}.${FORCE_RECODE_FORMAT}`));
            const cookieParam = COOKIE_PATH && existsSync(COOKIE_PATH) ? `--cookies "${COOKIE_PATH}"` : '';
            const proxyParam = config.proxy ? `--proxy "${config.proxy}"` : '';

            // 强制转码为H.264编码的MP4，使用更详细的ffmpeg参数确保编码正确
            const recodeParam = `--recode ${FORCE_RECODE_FORMAT} -S vcodec:${FORCE_VIDEO_CODEC}`;
            const formatWithFilter = `${format.replace('x', '+')}`;

            const cmd = [
                `"${YT_DLP_PATH}" ${cookieParam} ${proxyParam} "${url}" -f "${formatWithFilter}"`,
                `-o "${outputPath}" ${recodeParam} --ffmpeg-location "${FFMPEG_PATH}"`,
                `-k --write-info-json 2> nul`
            ].join(' ');

            console.log(`[下载命令] ${cmd}`);
            const output = execSync(cmd, { stdio: 'pipe', timeout: TASK_TIMEOUT.DOWNLOAD });

            // 强制查找MP4文件
            const destMatch = output.toString().match(new RegExp(`${videoID}\\.${FORCE_RECODE_FORMAT}`));
            if (!destMatch) throw new Error('未找到转换后的MP4文件');
            const destFile = destMatch[0];

            parentPort.postMessage({
                success: true,
                result: {
                    v: videoID,
                    downloading: false,
                    downloadSucceed: true,
                    dest: `file/${path}/${destFile}`,
                    metadata: `info/${path}/${videoID}.info.json`,
                    note: `已转换为${FORCE_VIDEO_CODEC}编码的${FORCE_RECODE_FORMAT}格式`
                }
            });
        } catch (err) {
            const errorMsg = err.stderr?.toString() || err.message;
            console.error('视频下载或转码失败:', errorMsg);
            parentPort.postMessage({
                success: true,
                result: {
                    v: videoID,
                    downloading: false,
                    downloadSucceed: false,
                    dest: '下载或转码失败',
                    metadata: errorMsg.substring(0, 200)
                }
            });
        }
    }

    function parseSubtitle({ url }) {
        try {
            const cookieParam = COOKIE_PATH && existsSync(COOKIE_PATH) ? `--cookies "${COOKIE_PATH}"` : '';
            const proxyParam = config.proxy ? `--proxy "${config.proxy}"` : '';
            const cmd = `"${YT_DLP_PATH}" ${proxyParam} --list-subs ${cookieParam} "${url}" 2> nul`;
            console.log(`[字幕列表命令] ${cmd}`);
            const output = execSync(cmd, { stdio: 'pipe', timeout: TASK_TIMEOUT.SUBTITLE }).toString();

            let hasAutoSub = false;
            const officialSubs = [];
            const lines = output.split(/\r?\n/);

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                if (line.includes('Available automatic captions')) {
                    hasAutoSub = true;
                } else if (line.includes('Available subtitles')) {
                    for (let j = i + 1; j < lines.length; j++) {
                        const subLine = lines[j].trim();
                        if (!subLine) continue;
                        const subCode = subLine.match(/^([a-z]{2}(-[A-Za-z]+)?|danmaku)/)?.[1];
                        if (!subCode) break;
                        if (!officialSubs.includes(subCode)) officialSubs.push(subCode);
                    }
                    break;
                }
            }

            return officialSubs.length > 0 ? [...officialSubs, 'auto'] : hasAutoSub ? ['auto'] : [];
        } catch (err) {
            console.warn('解析字幕列表失败:', err.message);
            return [];
        }
    }
}