const dns = require('dns').promises;
const net = require('net');

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 9000;
const ALLOWED_TYPES = /^(image|video)\//i;

function registerPublicMediaProxy(app) {
    app.get('/api/public-media-proxy', async (req, res, next) => {
        try {
            let target = parseTarget(req.query?.url);
            let response = null;

            for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
                await assertPublicUrl(target);
                response = await fetchOnce(target);

                if (response.status >= 300 && response.status < 400) {
                    const location = response.headers.get('location');
                    if (!location || redirect === MAX_REDIRECTS) {
                        return res.status(502).json({ ok: false, error: 'Redirecionamento de mídia inválido.' });
                    }
                    target = new URL(location, target);
                    continue;
                }
                break;
            }

            if (!response?.ok) {
                return res.status(response?.status || 502).json({ ok: false, error: 'Não foi possível carregar a mídia.' });
            }

            const contentType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
            if (!ALLOWED_TYPES.test(contentType)) {
                return res.status(415).json({ ok: false, error: 'O endereço não retornou uma imagem ou vídeo.' });
            }

            const declaredLength = Number(response.headers.get('content-length') || 0);
            if (Number.isFinite(declaredLength) && declaredLength > MAX_BYTES) {
                return res.status(413).json({ ok: false, error: 'Mídia muito grande para a captura.' });
            }

            const reader = response.body?.getReader?.();
            if (!reader) return res.status(502).json({ ok: false, error: 'Resposta de mídia inválida.' });

            const chunks = [];
            let total = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                total += value.byteLength;
                if (total > MAX_BYTES) {
                    try { await reader.cancel(); } catch {}
                    return res.status(413).json({ ok: false, error: 'Mídia muito grande para a captura.' });
                }
                chunks.push(Buffer.from(value));
            }

            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Length', String(total));
            res.setHeader('Cache-Control', 'public, max-age=600, stale-while-revalidate=1800');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            return res.send(Buffer.concat(chunks, total));
        } catch (error) {
            if (error?.name === 'AbortError') return res.status(504).json({ ok: false, error: 'Tempo limite ao carregar mídia.' });
            if (Number(error?.statusCode) >= 400 && Number(error?.statusCode) < 500) {
                return res.status(error.statusCode).json({ ok: false, error: error.message });
            }
            return next(error);
        }
    });
}

function parseTarget(value) {
    let url;
    try { url = new URL(String(value || '')); }
    catch { throw clientError(400, 'URL de mídia inválida.'); }
    if (!['http:', 'https:'].includes(url.protocol)) throw clientError(400, 'Protocolo de mídia não permitido.');
    if (url.username || url.password) throw clientError(400, 'Credenciais na URL não são permitidas.');
    if (url.port && !['80', '443'].includes(url.port)) throw clientError(400, 'Porta de mídia não permitida.');
    return url;
}

async function assertPublicUrl(url) {
    const hostname = String(url.hostname || '').toLowerCase().replace(/\.$/, '');
    if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
        throw clientError(403, 'Host de mídia não permitido.');
    }

    const direct = net.isIP(hostname) ? [{ address: hostname }] : await dns.lookup(hostname, { all: true, verbatim: true });
    if (!direct.length || direct.some(item => isPrivateAddress(item.address))) {
        throw clientError(403, 'Endereço de mídia não permitido.');
    }
}

function isPrivateAddress(address) {
    const ip = String(address || '').toLowerCase();
    if (net.isIP(ip) === 4) {
        const parts = ip.split('.').map(Number);
        const [a, b] = parts;
        return a === 0 || a === 10 || a === 127 ||
            (a === 100 && b >= 64 && b <= 127) ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 0) ||
            (a === 192 && b === 168) ||
            (a === 198 && (b === 18 || b === 19)) ||
            a >= 224;
    }
    if (net.isIP(ip) === 6) {
        if (ip === '::' || ip === '::1') return true;
        if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb')) return true;
        const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
        if (mapped) return isPrivateAddress(mapped[1]);
        return ip.startsWith('2001:db8:');
    }
    return true;
}

async function fetchOnce(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        return await fetch(url, {
            method: 'GET',
            redirect: 'manual',
            signal: controller.signal,
            headers: {
                'User-Agent': 'SkyNetApi-PublicProfile/1.0',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,video/*;q=0.9,*/*;q=0.1'
            }
        });
    } finally {
        clearTimeout(timer);
    }
}

function clientError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

module.exports = { registerPublicMediaProxy, isPrivateAddress };
