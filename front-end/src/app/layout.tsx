import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: 'BizFlow | Business ERP System',
  description: 'BizFlow - Modern Enterprise Resource Planning for streamlined business flow.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: ['/favicon.ico'],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0b1220',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="application-name" content="BizFlow" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="BizFlow" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `
              #pwa-install-banner{position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;display:none}
              @media (min-width: 640px){#pwa-install-banner{left:auto;right:24px;max-width:420px}}
              #pwa-install-banner .card{border-radius:16px;border:1px solid rgba(148,163,184,.25);background:rgba(15,23,42,.86);backdrop-filter:blur(10px);color:#e2e8f0;box-shadow:0 10px 30px rgba(2,6,23,.35);padding:14px}
              html:not(.dark) #pwa-install-banner .card{background:rgba(255,255,255,.92);color:#0f172a;border-color:rgba(148,163,184,.45)}
              #pwa-install-banner .row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
              #pwa-install-banner .title{font-size:14px;font-weight:700;line-height:1.2}
              #pwa-install-banner .desc{margin-top:4px;font-size:12px;opacity:.8}
              #pwa-install-banner .actions{margin-top:10px;display:flex;justify-content:flex-end;gap:8px}
              #pwa-install-banner button{appearance:none;border-radius:10px;padding:8px 10px;font-size:12px;font-weight:700;border:1px solid rgba(148,163,184,.35);background:transparent;color:inherit;cursor:pointer}
              #pwa-install-banner button.primary{background:#2952a3;border-color:#2952a3;color:#fff}
              #pwa-install-banner button:disabled{opacity:.55;cursor:not-allowed}
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  if ('serviceWorker' in navigator) {
                    var host = (location && location.hostname) ? location.hostname : '';
                    var isLocal = host === 'localhost' || host === '127.0.0.1';

                    // Dev UX: avoid SW caching on localhost (it can cause old bundles to "swap" in after a few seconds).
                    if (isLocal) {
                      try {
                        navigator.serviceWorker.getRegistrations().then(function (regs) {
                          regs.forEach(function (r) { try { r.unregister(); } catch (_) {} });
                        }).catch(function () {});
                      } catch (_) {}
                      try {
                        if (window.caches && window.caches.keys) {
                          window.caches.keys().then(function (keys) {
                            keys.forEach(function (k) { try { window.caches.delete(k); } catch (_) {} });
                          }).catch(function () {});
                        }
                      } catch (_) {}
                      // Don't register in local dev.
                      return;
                    }

                    // Production: register only over HTTPS (required for installability).
                    if (location && location.protocol !== 'https:') return;

                    window.addEventListener('load', function () {
                      navigator.serviceWorker.register('/sw.js').catch(function () {});
                    });
                  }
                } catch (_) {}
              })();
            `,
          }}
        />
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var dismissedUntil = 0;
                  try { dismissedUntil = Number(localStorage.getItem('pwa_install_dismissed_until') || '0') || 0; } catch (_) {}
                  if (dismissedUntil && dismissedUntil > Date.now()) return;

                  var nav = window.navigator;
                  var standalone = false;
                  try {
                    standalone = Boolean(nav && nav.standalone) || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
                  } catch (_) {}
                  if (standalone) return;

                  function isIos() {
                    var ua = (nav && nav.userAgent) || '';
                    return /iPad|iPhone|iPod/i.test(ua);
                  }

                  function ensureBanner() {
                    var el = document.getElementById('pwa-install-banner');
                    if (el) return el;
                    el = document.createElement('div');
                    el.id = 'pwa-install-banner';
                    el.innerHTML = '' +
                      '<div class=\"card\">' +
                        '<div class=\"row\">' +
                          '<div>' +
                            '<div class=\"title\" id=\"pwa-title\">Install BizFlow</div>' +
                            '<div class=\"desc\" id=\"pwa-desc\">Get faster access and offline-friendly loading.</div>' +
                          '</div>' +
                          '<button type=\"button\" id=\"pwa-close\">Close</button>' +
                        '</div>' +
                        '<div class=\"actions\">' +
                          '<button type=\"button\" class=\"primary\" id=\"pwa-install\" style=\"display:none\">Install</button>' +
                        '</div>' +
                      '</div>';
                    document.body.appendChild(el);
                    return el;
                  }

                  function showBanner(opts) {
                    var el = ensureBanner();
                    var t = document.getElementById('pwa-title');
                    var d = document.getElementById('pwa-desc');
                    var btn = document.getElementById('pwa-install');
                    if (t) t.textContent = opts.title || 'Install BizFlow';
                    if (d) d.textContent = opts.desc || '';
                    if (btn) btn.style.display = opts.showInstall ? 'inline-block' : 'none';
                    el.style.display = 'block';
                  }

                  function dismiss(days) {
                    try { localStorage.setItem('pwa_install_dismissed_until', String(Date.now() + (days * 86400000))); } catch (_) {}
                    var el = document.getElementById('pwa-install-banner');
                    if (el) el.style.display = 'none';
                  }

                  // Wire close action once DOM is ready
                  function wireClose() {
                    var c = document.getElementById('pwa-close');
                    if (c) c.onclick = function () { dismiss(14); };
                  }

                  // iOS: no install prompt; show instructions.
                  if (isIos()) {
                    window.setTimeout(function () {
                      showBanner({
                        title: 'Add BizFlow to Home Screen',
                        desc: 'On iPhone/iPad: tap Share, then \"Add to Home Screen\".',
                        showInstall: false
                      });
                      wireClose();
                    }, 1200);
                    return;
                  }

                  // Android/Chrome: capture beforeinstallprompt.
                  var deferred = null;
                  window.addEventListener('beforeinstallprompt', function (e) {
                    try { e.preventDefault(); } catch (_) {}
                    deferred = e;
                    window.setTimeout(function () {
                      showBanner({
                        title: 'Install BizFlow',
                        desc: 'Get faster access and offline-friendly loading.',
                        showInstall: true
                      });
                      wireClose();
                      var btn = document.getElementById('pwa-install');
                      if (btn) btn.onclick = function () {
                        if (!deferred) return;
                        btn.disabled = true;
                        Promise.resolve()
                          .then(function () { return deferred.prompt(); })
                          .then(function () { return deferred.userChoice; })
                          .then(function (res) {
                            deferred = null;
                            dismiss(res && res.outcome === 'accepted' ? 60 : 14);
                          })
                          .catch(function () { dismiss(14); })
                          .finally(function () { btn.disabled = false; });
                      };
                    }, 1200);
                  });
                } catch (_) {}
              })();
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark')
                } else {
                  document.documentElement.classList.remove('dark')
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="font-body antialiased bg-background min-h-screen" suppressHydrationWarning>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
