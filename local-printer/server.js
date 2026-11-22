/**
 * BizzFlow Printer - local silent-print bridge for the BizzFlow web app.
 *
 * Public API (used by front-end/src/lib/api/silent-print.ts - keep compatible):
 *   GET  /printers   -> { success, data: [{ name, ... }] }
 *   POST /print      { html, printer?, width?, title? } -> { success, jobId, error? }
 *
 * Dashboard API (only from this PC, same origin):  /api/*
 *
 * Flags:  --startup   launched by Windows at sign-in: run quietly in the tray
 *         --restarted relaunched by "Restart service": wait for the port to free up
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const env = require('./lib/env');
const system = require('./lib/system');
const printer = require('./lib/printer');
const tray = require('./lib/tray');
const queue = require('./lib/queue');

const args = process.argv.slice(2);
const LAUNCHED_AT_STARTUP = args.includes('--startup');
const RESTARTED = args.includes('--restarted');
const startedAt = Date.now();

const config = env.loadConfig();
const port = Number(config.port) || 5001;

process.on('uncaughtException', e => env.log.error('Uncaught exception:', e));
process.on('unhandledRejection', e => env.log.error('Unhandled rejection:', e));

const app = express();
app.disable('x-powered-by');

// Web pages served over http(s) need these to reach a service on localhost (Chrome Private Network Access).
app.use((req, res, next) => {
    if (req.headers['access-control-request-private-network']) res.setHeader('Access-Control-Allow-Private-Network', 'true');
    next();
});

// ---------------------------------------------------------------- public API (CORS open, as before)
const publicCors = cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'] });
app.options(['/print', '/printers', '/health', '/jobs'], publicCors);

app.get('/health', publicCors, (req, res) => res.json({ success: true, app: env.APP_ID, version: env.VERSION }));

// Recent jobs on this PC (no document content) for the POS print queue panel
app.get('/jobs', publicCors, (req, res) => res.json({ success: true, version: env.VERSION, data: printer.getJobs().slice(0, 40) }));

app.get('/printers', publicCors, async (req, res) => {
    try { res.json({ success: true, data: await system.getPrinters(req.query.refresh === '1') }); }
    catch (e) { env.log.error('List printers failed:', e.message); res.status(500).json({ success: false, error: e.message }); }
});

app.post('/print', publicCors, express.json({ limit: '50mb' }), async (req, res) => {
    const { html, printer: printerName, width, title } = req.body || {};
    if (!html || typeof html !== 'string') return res.status(400).json({ success: false, error: 'HTML content is required' });
    const job = await printer.submit({ html, printer: printerName, width, title, source: 'web' });
    if (job.status === 'done') return res.json({ success: true, jobId: job.id, printer: job.printer || 'default' });
    res.status(500).json({ success: false, jobId: job.id, error: job.error });
});

// ---------------------------------------------------------------- dashboard API (this PC only)
function isLoopback(addr = '') {
    return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

const adminOnly = (req, res, next) => {
    if (!isLoopback(req.socket.remoteAddress)) return res.status(403).json({ success: false, error: 'Dashboard is only available on this computer' });
    // Block other websites from changing settings in the background (CSRF).
    const origin = req.headers.origin;
    if (origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) return res.status(403).json({ success: false, error: 'Forbidden origin' });
    next();
};

const api = express.Router();
api.use(adminOnly, express.json());

api.get('/ping', (req, res) => res.json({ app: env.APP_ID, version: env.VERSION }));

api.get('/status', async (req, res) => {
    const cfg = env.getConfig();
    res.json({
        success: true,
        app: env.APP_NAME,
        version: env.VERSION,
        port,
        uptimeMs: Date.now() - startedAt,
        printerName: cfg.printerName,
        paperWidth: cfg.paperWidth,
        configuredPort: Number(cfg.port) || 5001,
        autostart: await system.isAutostartEnabled(),
        browser: system.getBrowserPath(),
        stats: printer.getStats(),
        queue: queue.getStatus(),
        dataDir: env.DATA_DIR,
        packaged: env.IS_PACKAGED,
    });
});

api.get('/jobs', (req, res) => res.json({ success: true, data: printer.getJobs() }));

// Kitchen print stations (from the BizzFlow server) and which local printer each uses
api.get('/stations', async (req, res) => {
    try { res.json({ success: true, data: await queue.getStations() }); }
    catch (e) { res.status(e.status && e.status < 500 ? e.status : 502).json({ success: false, error: e.message }); }
});
api.post('/stations/:id', async (req, res) => {
    const { printerName, paperWidth } = req.body || {};
    try { await queue.setStationPrinter(Number(req.params.id), String(printerName || ''), paperWidth); res.json({ success: true }); }
    catch (e) { res.status(e.status && e.status < 500 ? e.status : 502).json({ success: false, error: e.message }); }
});
api.get('/logs', (req, res) => res.json({ success: true, data: env.log.recent(200) }));

api.post('/settings', async (req, res) => {
    const { printerName, paperWidth, port: newPort, autostart, queueEnabled, queueServerUrl, queueDeviceKey } = req.body || {};
    const patch = {};
    // Server print queue (kitchen tickets from tablets)
    if (typeof queueEnabled === 'boolean') patch.queueEnabled = queueEnabled;
    if (typeof queueServerUrl === 'string') {
        const u = queueServerUrl.trim().replace(/\/+$/, '');
        if (u && !/^https?:\/\//i.test(u)) return res.status(400).json({ success: false, error: 'Server address must start with http:// or https://' });
        patch.queueServerUrl = u;
    }
    if (typeof queueDeviceKey === 'string' && queueDeviceKey.trim()) patch.queueDeviceKey = queueDeviceKey.trim();
    if (typeof printerName === 'string') patch.printerName = printerName;
    if (paperWidth === '80mm' || paperWidth === '58mm') patch.paperWidth = paperWidth;
    if (newPort !== undefined) {
        const p = Number(newPort);
        if (!Number.isInteger(p) || p < 1024 || p > 65535) return res.status(400).json({ success: false, error: 'Port must be between 1024 and 65535' });
        patch.port = p;
    }
    if (typeof autostart === 'boolean') {
        try {
            patch.autostart = await system.setAutostart(autostart);
            tray.setAutostart(patch.autostart);
        } catch (e) { return res.status(500).json({ success: false, error: 'Could not change startup setting: ' + e.message }); }
    }
    const cfg = env.updateConfig(patch);
    env.log.info('Settings saved:', JSON.stringify({ ...patch, queueDeviceKey: patch.queueDeviceKey ? '(set)' : undefined }));
    queue.apply();
    updateTrayStatus();
    res.json({ success: true, config: cfg, restartRequired: cfg.port !== port });
});

api.post('/test-print', async (req, res) => {
    const job = await printer.testPrint(req.body || {});
    res.status(job.status === 'done' ? 200 : 500).json({ success: job.status === 'done', job });
});

api.post('/open-logs', (req, res) => { system.openFolder(env.LOG_DIR); res.json({ success: true }); });
api.post('/restart', (req, res) => { res.json({ success: true }); setTimeout(restart, 300); });

app.use('/api', api);

// ---------------------------------------------------------------- dashboard UI
const UI_DIR = path.join(__dirname, 'ui');
app.get('/', (req, res) => {
    if (!isLoopback(req.socket.remoteAddress)) return res.status(403).send('BizzFlow Printer dashboard is only available on this computer.');
    res.type('html').send(fs.readFileSync(path.join(UI_DIR, 'index.html'), 'utf8'));
});
app.get('/favicon.ico', (req, res) => res.type('image/x-icon').send(fs.readFileSync(path.join(__dirname, 'assets', 'icon.ico'))));

// ---------------------------------------------------------------- lifecycle
let server;

function updateTrayStatus() {
    const cfg = env.getConfig();
    tray.setStatus(`Online - ${cfg.printerName || 'Default printer'} (${cfg.paperWidth})`);
}

async function shutdown(code = 0) {
    env.log.info('Shutting down');
    await tray.stop();
    await printer.closeBrowser();
    if (server) server.close();
    setTimeout(() => process.exit(code), 200);
}

async function restart() {
    env.log.info('Restarting service');
    await tray.stop();
    await printer.closeBrowser();
    if (server) server.close();
    system.relaunch();
    setTimeout(() => process.exit(0), 200);
}

/** Asks an already-running copy (if any) to show its dashboard. */
function pingExisting() {
    return new Promise(resolve => {
        const req = http.get({ host: '127.0.0.1', port, path: '/api/ping', timeout: 2000 }, res => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => { try { resolve(JSON.parse(body).app === env.APP_ID); } catch (_) { resolve(false); } });
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
    });
}

function listen(attempt = 1) {
    server = app.listen(port, '0.0.0.0');
    server.on('listening', onListening);
    server.on('error', async err => {
        if (err.code !== 'EADDRINUSE') {
            env.log.error('Server error:', err);
            return;
        }
        if (RESTARTED && attempt < 20) return setTimeout(() => listen(attempt + 1), 500);
        if (await pingExisting()) {
            env.log.info('Already running - opening the existing dashboard');
            if (!LAUNCHED_AT_STARTUP) system.openDashboard(port);
            return process.exit(0);
        }
        env.log.error(`Port ${port} is used by another program`);
        system.messageBox(`BizzFlow Printer could not start because port ${port} is already used by another program.\n\nClose that program, or change the port in ${env.CONFIG_PATH}.`);
        setTimeout(() => process.exit(1), 1500);
    });
}

async function onListening() {
    env.log.info(`${env.APP_NAME} ${env.VERSION} listening on http://127.0.0.1:${port}`);

    // First run of a copied (not installed) exe: register to start with Windows.
    // When installed with the setup wizard, the wizard's "start with Windows" choice wins.
    let autostart = await system.isAutostartEnabled();
    const cfg = env.getConfig();
    const installedBySetup = fs.existsSync(path.join(env.INSTALL_DIR, 'unins000.exe'));
    if (env.IS_PACKAGED && cfg.autostart === null && !autostart && !installedBySetup) {
        try { autostart = await system.setAutostart(true); env.log.info('Registered to start with Windows'); }
        catch (e) { env.log.warn('Could not register autostart:', e.message); }
    } else if (env.IS_PACKAGED && autostart) {
        // Keep the Run entry pointing at the current exe location (in case the folder was moved).
        system.setAutostart(true).catch(() => { });
    }
    env.updateConfig({ autostart });

    tray.start({
        autostart,
        onOpen: () => system.openDashboard(port),
        onTestPrint: () => printer.testPrint().catch(() => { }),
        onToggleAutostart: async () => {
            const next = await system.setAutostart(!(await system.isAutostartEnabled())).catch(() => null);
            if (next !== null) { env.updateConfig({ autostart: next }); tray.setAutostart(next); }
        },
        onRestart: restart,
        onExit: () => shutdown(0),
    });
    updateTrayStatus();

    // Unpack the PDF print engine now so a broken install shows up in the log immediately.
    system.getSumatraPath();

    // Collect kitchen tickets from the server queue (if set up)
    queue.apply();

    // Warm up the printer list so the dashboard opens instantly.
    system.getPrinters().catch(e => env.log.warn('Printer discovery failed:', e.message));

    if (!LAUNCHED_AT_STARTUP && !RESTARTED) system.openDashboard(port);
}

env.log.info(`Starting ${env.APP_NAME} ${env.VERSION}${LAUNCHED_AT_STARTUP ? ' (Windows startup)' : ''}`);
listen();
