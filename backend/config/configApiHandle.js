/**
 * ANSI color codes for terminal output (no extra dependency)
 */
const colors = {
    reset: '\x1b[0m',
    dim: '\x1b[2m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

/**
 * Get status color: green 2xx, yellow 3xx/4xx, red 5xx
 */
function getStatusColor(statusCode) {
    if (statusCode >= 200 && statusCode < 300) return colors.green;
    if (statusCode >= 300 && statusCode < 500) return colors.yellow;
    return colors.red;
}

/**
 * Get the IP of the device that made the request (client/device IP).
 * When you open the app in a browser on the same PC as the server, that device = localhost (127.0.0.1).
 * To see another device's IP, that device must call the API (e.g. from phone: http://<server-lan-ip>:3000).
 * Order: X-Forwarded-For → X-Real-IP → CF-Connecting-IP → socket.remoteAddress
 */
function getClientIp(req) {
    let raw =
        (req.headers['x-forwarded-for'] && req.headers['x-forwarded-for'].split(',')[0].trim()) ||
        req.headers['x-real-ip'] ||
        req.headers['cf-connecting-ip'] ||
        (req.socket && req.socket.remoteAddress) ||
        '';
    if (!raw) return 'unknown';
    if (raw === '::1' || raw === '::ffff:127.0.0.1') return '127.0.0.1 (localhost)';
    if (raw.startsWith('::ffff:')) return raw.slice(7);
    return raw;
}

/**
 * Optional device ID from headers (client sends X-Device-ID or X-Client-ID).
 */
function getDeviceId(req) {
    return req.headers['x-device-id'] || req.headers['x-client-id'] || null;
}


const http = require("node:http");

const api = {
    host: "api.ipify.org",
    port: 80,
    path: "/",
};

exports.getPublicIpAddress = () => {
    return new Promise((resolve, reject) => {
        http.get(api, (response) => {
            response.on("data", (ip) => {
                resolve(ip);
            });
            response.on("error", (err) => {
                reject(err);
            });
        });
    });
}





/**
 * API request logger middleware.
 * Logs once per HTTP request when response finishes.
 * (Multiple log lines = browser sent multiple requests, e.g. / and /favicon.ico)
 */
exports.apiLogger = (req, res, next) => {
    const start = Date.now();

    try {
        const clientIp = getClientIp(req);
        const deviceId = getDeviceId(req);

        res.on('finish', () => {
            try {
                const duration = Date.now() - start;
                const statusColor = getStatusColor(res.statusCode);

                const timestamp = `${colors.dim}${colors.cyan}[${new Date().toISOString()}]${colors.reset}`;
                const ipPart = `${colors.blue}Client: ${clientIp}${colors.reset}`;
                const devicePart = deviceId ? ` ${colors.dim}Device: ${deviceId}${colors.reset}` : '';
                const methodPart = `${colors.yellow}${req.method}${colors.reset}`;
                const urlPart = `${colors.cyan}${req.originalUrl || req.url}${colors.reset}`;
                const statusPart = `${statusColor}${res.statusCode}${colors.reset}`;
                const timePart = `${colors.magenta}${duration} ms${colors.reset}`;

                console.log(
                    `::==> ${timestamp} ${ipPart}${devicePart} | ${methodPart} ${urlPart} | Status: ${statusPart} | ${timePart}`
                );
            } catch (logErr) {
                console.error('[apiLogger] Log write failed:', logErr?.message || logErr);
            }
        });

        next();
    } catch (err) {
        console.error('[apiLogger] Middleware error:', err?.message || err);
        next(err);
    }
};

/** Attach client IP and device ID to req for use in routes (req.clientIp, req.deviceId) */
exports.attachClientInfo = (req, res, next) => {
    req.clientIp = getClientIp(req);
    req.deviceId = getDeviceId(req);
    next();
};

/**
 * Get this machine's LAN IPv4 addresses (for startup hint: "call from another device via http://<ip>:port").
 * When you open localhost, Client is always 127.0.0.1; to see another device's IP, that device must call this server using the LAN URL.
 */
function getLocalNetworkIps() {
    const os = require('os');
    const nets = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
        }
    }
    return ips;
}
exports.getLocalNetworkIps = getLocalNetworkIps;

/**
 * Error handling middleware (must be registered last, with 4 args).
 * Do not call next() after sending response.
 */
exports.errorHandler = (err, req, res, next) => {
    try {
        const status = err.status ?? err.statusCode ?? 500;
        console.error(`${colors.red}[ERROR]${colors.reset}`, err.stack || err.message);

        if (res.headersSent) {
            return next(err);
        }

        res.status(status).json({
            success: false,
            message: err.message || 'Internal Server Error',
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
        });
    } catch (handlerErr) {
        console.error('[errorHandler] Failed:', handlerErr?.message || handlerErr);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    }
};

/**
 * 404 Not Found handler. Register after all routes.
 * Do not call next() after sending response.
 */
exports.notFoundHandler = (req, res, next) => {
    try {
        if (res.headersSent) return next();
        res.status(404).json({
            success: false,
            message: 'API Not Found',
        });
    } catch (err) {
        console.error('[notFoundHandler] Failed:', err?.message || err);
        next(err);
    }
};
