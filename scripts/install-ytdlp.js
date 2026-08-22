const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const BIN_DIR = path.join(ROOT, 'bin');
const TARGET = path.join(BIN_DIR, 'yt-dlp');
const VERSION = process.env.YTDLP_VERSION || '2026.08.19';

if (process.env.SKIP_YTDLP_INSTALL === '1') {
    console.log('SKIP_YTDLP_INSTALL=1; pulando instalação do yt-dlp.');
    process.exit(0);
}

if (process.platform !== 'linux') {
    console.log(`Instalação automática do yt-dlp ignorada em ${process.platform}. Use YTDLP_PATH para informar o executável.`);
    process.exit(0);
}

const asset = process.arch === 'x64'
    ? 'yt-dlp_linux'
    : process.arch === 'arm64'
        ? 'yt-dlp_linux_aarch64'
        : '';

if (!asset) {
    console.log(`Arquitetura ${process.arch} não suportada pelo instalador automático. Use YTDLP_PATH.`);
    process.exit(0);
}

const url = `https://github.com/yt-dlp/yt-dlp/releases/download/${encodeURIComponent(VERSION)}/${asset}`;
fs.mkdirSync(BIN_DIR, { recursive: true });

function download(currentUrl, redirects = 0) {
    if (redirects > 5) throw new Error('Muitos redirecionamentos ao baixar yt-dlp.');

    return new Promise((resolve, reject) => {
        const request = https.get(currentUrl, {
            headers: { 'User-Agent': 'SkyNetApi yt-dlp installer' },
            timeout: 30000
        }, response => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                response.resume();
                const next = new URL(response.headers.location, currentUrl).toString();
                resolve(download(next, redirects + 1));
                return;
            }

            if (response.statusCode !== 200) {
                response.resume();
                reject(new Error(`Falha ao baixar yt-dlp: HTTP ${response.statusCode}`));
                return;
            }

            const temp = `${TARGET}.tmp-${process.pid}`;
            const file = fs.createWriteStream(temp, { mode: 0o755 });
            response.pipe(file);
            file.on('finish', () => {
                file.close(error => {
                    if (error) return reject(error);
                    try {
                        fs.chmodSync(temp, 0o755);
                        fs.renameSync(temp, TARGET);
                        resolve();
                    } catch (renameError) {
                        reject(renameError);
                    }
                });
            });
            file.on('error', error => {
                response.destroy();
                fs.rm(temp, { force: true }, () => reject(error));
            });
        });

        request.on('timeout', () => request.destroy(new Error('Timeout ao baixar yt-dlp.')));
        request.on('error', reject);
    });
}

(async () => {
    try {
        await download(url);
        console.log(`yt-dlp ${VERSION} instalado em ${TARGET}`);
    } catch (error) {
        console.error(`Não foi possível instalar yt-dlp: ${error.message}`);
        process.exit(1);
    }
})();
