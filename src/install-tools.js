const { createWriteStream, existsSync, mkdirSync, renameSync, unlinkSync } = require('fs');
const { join } = require('path');
const https = require('https');

const ROOT_DIR = join(__dirname, '..');
const RUNTIME_TOOLS_DIR = join(ROOT_DIR, '.runtime-tools');
const YT_DLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
const YT_DLP_PATH = join(RUNTIME_TOOLS_DIR, 'yt-dlp.exe');

async function main() {
    if (process.platform !== 'win32') {
        return;
    }

    ensureDir(RUNTIME_TOOLS_DIR);
    await ensureYtDlp();
}

function ensureDir(dirPath) {
    if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
    }
}

async function ensureYtDlp() {
    if (existsSync(YT_DLP_PATH)) {
        return;
    }

    const tempPath = `${YT_DLP_PATH}.download`;
    await downloadFile(YT_DLP_URL, tempPath);
    renameSync(tempPath, YT_DLP_PATH);
}

function downloadFile(url, destination) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                response.resume();
                downloadFile(response.headers.location, destination).then(resolve, reject);
                return;
            }

            if (response.statusCode !== 200) {
                response.resume();
                reject(new Error(`下载 yt-dlp 失败，状态码: ${response.statusCode}`));
                return;
            }

            const file = createWriteStream(destination);
            file.on('finish', () => {
                file.close(resolve);
            });
            file.on('error', (err) => {
                file.close(() => {
                    cleanupFile(destination);
                    reject(err);
                });
            });
            response.on('error', (err) => {
                file.close(() => {
                    cleanupFile(destination);
                    reject(err);
                });
            });
            response.pipe(file);
        });

        request.on('error', (err) => {
            cleanupFile(destination);
            reject(err);
        });
    });
}

function cleanupFile(filePath) {
    try {
        if (existsSync(filePath)) {
            unlinkSync(filePath);
        }
    } catch (err) {
        console.warn(`清理临时下载文件失败: ${err.message}`);
    }
}

main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});
