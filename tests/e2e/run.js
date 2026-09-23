// يشغّل خادماً ثابتاً محلياً لجذر المستودع ثم اختبارات المتصفح الثلاثة على المحاكاة (بلا شبكة خارجية).
// الاستخدام: npm test   (أو: node tests/e2e/run.js [مجلد لقطات الشاشة])
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const PORT = 8099;
const OUT = process.argv[2] || path.join(require('os').tmpdir(), 'bellarosa-shots');
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };

const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
});
// الاختبارات تعمل كعمليات فرعية غير متزامنة كي يبقى الخادم مستجيباً
const run = spec => new Promise(resolve => {
    console.log(`\n=== ${spec} ===`);
    const child = spawn(process.execPath, [path.join(__dirname, spec), OUT], { stdio: 'inherit', env: { ...process.env, PORT: String(PORT) } });
    child.on('exit', code => resolve(code === 0));
});
server.listen(PORT, '127.0.0.1', async () => {
    let failed = false;
    for (const spec of ['store.spec.js', 'admin.spec.js', 'gateway.spec.js']) {
        if (!await run(spec)) failed = true;
    }
    server.close();
    console.log(failed ? '\nFAILED' : `\nALL PASSED — screenshots in ${OUT}`);
    process.exit(failed ? 1 : 0);
});
