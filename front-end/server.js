/* eslint-disable no-console */
// Resilient Next.js server wrapper for Windows/XAMPP.
// Goal: if Next throws ENOENT for missing .next artifacts (e.g. app-build-manifest.json),
// do NOT crash the Node process. Return a 500 response instead.
//
// Usage:
//   node server.js --port 9003
//   node server.js --dev --port 9003

const http = require("http");
const url = require("url");
const next = require("next");

function parseArgs(argv) {
  const args = { dev: false, prod: false, port: null, hostname: "0.0.0.0" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dev") args.dev = true;
    else if (a === "--prod" || a === "--production") args.prod = true;
    else if (a === "--port" || a === "-p") args.port = Number(argv[++i]);
    else if (a === "--hostname" || a === "-H") args.hostname = String(argv[++i]);
  }
  return args;
}

function html500(title, details) {
  const safe = (s) =>
    String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Internal Server Error</title>
    <style>
      body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial; padding:24px; color:#0f172a; background:#fff}
      .card{max-width:860px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;padding:18px}
      h1{font-size:18px;margin:0 0 8px}
      p{margin:0 0 10px;color:#475569;font-size:13px;line-height:1.45}
      pre{white-space:pre-wrap;word-break:break-word;background:#0b1220;color:#e2e8f0;padding:12px;border-radius:10px;font-size:12px;overflow:auto}
      code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${safe(title || "Internal Server Error")}</h1>
      <p>The server caught an unexpected error and returned a 500 response instead of crashing.</p>
      <p>If this is a missing <code>.next</code> file: delete <code>front-end/.next</code> and rebuild, or restart the dev server.</p>
      <pre>${safe(details || "")}</pre>
    </div>
  </body>
</html>`;
}

async function main() {
  const args = parseArgs(process.argv);
  // Avoid mixing dev/prod artifacts in `.next`. Explicit flags win.
  const dev = args.dev ? true : args.prod ? false : process.env.NODE_ENV !== "production";
  const port = args.port || Number(process.env.PORT || 9003);
  const hostname = args.hostname || process.env.HOSTNAME || "0.0.0.0";

  // Prevent the whole process from exiting on Next internal errors.
  // (Yes, Node recommends exiting. Here we prefer "always-up + return 500".)
  process.on("uncaughtException", (err) => {
    console.error("[uncaughtException]", err);
  });
  process.on("unhandledRejection", (err) => {
    console.error("[unhandledRejection]", err);
  });

  const app = next({ dev, dir: __dirname });
  const handle = app.getRequestHandler();

  try {
    await app.prepare();
  } catch (err) {
    console.error("[prepare failed]", err);
    // Keep process alive, but respond 500 to all requests.
  }

  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = url.parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      const e = err || {};
      const isMissingNextArtifact =
        e.code === "ENOENT" && typeof e.path === "string" && e.path.includes(".next");

      console.error("[request error]", err);

      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(
          html500(
            isMissingNextArtifact
              ? "Next Build Cache Missing (.next)"
              : "Internal Server Error",
            String(err && err.stack ? err.stack : err)
          )
        );
      } else {
        try {
          res.end();
        } catch {
          // ignore
        }
      }
    }
  });

  server.on("clientError", (err, socket) => {
    try {
      socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
    } catch {
      // ignore
    }
  });

  server.listen(port, hostname, () => {
    console.log(`[server] ${dev ? "dev" : "prod"} listening on http://${hostname}:${port}`);
  });
}

main().catch((err) => {
  console.error("[fatal]", err);
  // Keep process alive; we want to avoid a hard crash.
  setInterval(() => {}, 1 << 30);
});
