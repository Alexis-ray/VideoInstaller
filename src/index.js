const express = require('express');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('fs');
const { join, resolve, isAbsolute } = require('path');
const { spawn } = require('child_process');
const ffmpegStatic = require('ffmpeg-static');
const { createDownloader } = require('./downloader');

const ROOT_DIR = resolve(__dirname, '..');
const DEFAULT_CONFIG = {
    port: 2878,
    address: '127.0.0.1',
    tmpDir: 'temp',
    cookie: 'cookies.txt',
    proxy: '',
    thumbnailTimeout: 20000,
    thumbnailRetryCount: 2,
    taskTimeout: {
        parse: 60000,
        download: 3600000
    }
};

function start() {
    const runtime = loadConfig();
    const downloader = createDownloader(runtime);
    const app = express();

    app.use(express.json({ limit: '3mb' }));

    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
        next();
    });

    app.use('/', express.static(runtime.staticDir));
    app.use('/file', express.static(runtime.tmpDir));

    app.get('/y2b/parse', requireApiRequest, async (req, res) => {
        try {
            const result = await downloader.parseVideo(req.query.url || '');
            res.send({ success: true, result });
        } catch (error) {
            res.send({ success: false, error: error.message || '解析失败' });
        }
    });

    app.get('/y2b/download', requireApiRequest, (req, res) => {
        try {
            res.send(downloader.ensureDownload(req.query));
        } catch (error) {
            res.send({ success: false, error: error.message || '下载失败' });
        }
    });

    app.get('/y2b/download-cover', requireApiRequest, (req, res) => {
        try {
            res.send(downloader.ensureCoverDownload(req.query));
        } catch (error) {
            res.send({ success: false, error: error.message || '下载封面失败' });
        }
    });

    app.post('/y2b/import-cookie', requireApiRequest, (req, res) => {
        try {
            const result = downloader.importCookiesText(req.body?.cookies || '');
            res.send({ success: true, result });
        } catch (error) {
            res.send({ success: false, error: error.message || '导入 Cookie 失败' });
        }
    });

    app.listen(runtime.config.port, runtime.config.address, () => {
        const url = `http://${runtime.config.address}:${runtime.config.port}`;
        console.log(`服务已启动：${url}`);
        console.log(`正在打开浏览器：${url}`);
        openBrowser(url);
    });
}

async function runCli(args) {
    if (args.length) {
        console.warn('已移除自动获取浏览器 Cookie 的命令；请启动网页后导入 Netscape cookies.txt。');
    }
    start();
}

function openBrowser(url) {
    const targetUrl = String(url || '').trim();
    if (!targetUrl) return;

    try {
        const child = spawn('cmd', ['/c', 'start', '', targetUrl], {
            windowsHide: true,
            detached: true,
            stdio: 'ignore'
        });
        child.unref();
    } catch (error) {
        console.warn(`自动打开浏览器失败: ${error.message}`);
    }
}

function loadConfig() {
    const configPath = join(ROOT_DIR, 'config.json');
    const rawConfig = readJsonFile(configPath, {});
    const config = {
        ...DEFAULT_CONFIG,
        ...rawConfig,
        taskTimeout: {
            ...DEFAULT_CONFIG.taskTimeout,
            ...(rawConfig.taskTimeout || {})
        }
    };

    const tmpDir = resolveProjectPath(config.tmpDir || 'temp');
    const cookiePath = resolveProjectPath(config.cookie || 'cookies.txt');
    const ytDlpPath = join(ROOT_DIR, '.runtime-tools', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

    mkdirSync(tmpDir, { recursive: true });
    ensureCookieFile(cookiePath);

    return {
        staticDir: join(ROOT_DIR, 'static'),
        config,
        tmpDir,
        cookiePath,
        ytDlpPath,
        ffmpegPath: ffmpegStatic || 'ffmpeg'
    };
}

function resolveProjectPath(targetPath) {
    const text = String(targetPath || '').trim();
    if (!text) return ROOT_DIR;
    return isAbsolute(text) ? text : resolve(ROOT_DIR, text);
}

function readJsonFile(filePath, fallback) {
    try {
        if (!existsSync(filePath)) {
            return fallback;
        }
        return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (error) {
        return fallback;
    }
}

function ensureCookieFile(cookiePath) {
    if (existsSync(cookiePath)) {
        return;
    }

    writeFileSync(cookiePath, '# Netscape HTTP Cookie File\n', 'utf8');
}

function requireApiRequest(req, res, next) {
    const requestMarker = String(req.get('x-videoinstaller-request') || '').trim();
    if (requestMarker !== '1') {
        res.status(403).send({ success: false, error: '请求被拒绝' });
        return;
    }

    next();
}

module.exports = {
    start
};

if (require.main === module) {
    runCli(process.argv.slice(2)).catch((error) => {
        console.error(error?.message || error);
        process.exitCode = 1;
    });
}
