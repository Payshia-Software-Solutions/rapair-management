/**
 * Silent Print Utility
 * Sends HTML content to the local print service
 */
import { api } from "@/lib/api";

export type PrinterRole = 'Receipt' | 'KOT' | 'Bar' | 'Label';
type PrinterSettings = { mode: 'Silent' | 'Browser'; byType: Record<string, { printer_name: string; paper_width?: string }> };

/** Printer mappings + printing mode from Settings → Printers (cached briefly; POS prints often). */
let settingsCache: { at: number; value: PrinterSettings } | null = null;
export const getPrinterSettings = async (): Promise<PrinterSettings> => {
  if (settingsCache && Date.now() - settingsCache.at < 60_000) return settingsCache.value;
  const value: PrinterSettings = { mode: 'Silent', byType: {} };
  try {
    const res = await api('/printer/get_settings');
    const data = await res.json();
    if (data.success && Array.isArray(data.data)) {
      for (const s of data.data) {
        if (s.printer_type === 'PrintingMode') value.mode = s.printer_name === 'Browser' ? 'Browser' : 'Silent';
        else value.byType[s.printer_type] = { printer_name: s.printer_name, paper_width: s.paper_width };
      }
    }
  } catch (e) {
    console.error('Failed to load printer settings:', e);
  }
  settingsCache = { at: Date.now(), value };
  return value;
};

export const silentPrint = async (html: string, printerNameOrType?: string, paperWidth?: '80mm' | '58mm', docName: string = 'BizzFlow Print Job') => {
  // Detect if we are on Android
  const isAndroid = /Android/i.test(navigator.userAgent);
  let targetPrinter = printerNameOrType;
  let width: string = paperWidth || '80mm';

  // A role ('KOT', 'Receipt', ...) resolves to the mapped Windows printer and its paper width
  if (printerNameOrType && ['Receipt', 'KOT', 'Bar', 'Label'].includes(printerNameOrType)) {
    const mapping = (await getPrinterSettings()).byType[printerNameOrType];
    targetPrinter = mapping?.printer_name || undefined; // unmapped -> Windows default printer
    if (!paperWidth && mapping?.paper_width) width = mapping.paper_width;
  }

  if (isAndroid) {
    try {
      const encodedHtml = btoa(unescape(encodeURIComponent(html)));
      const intentUrl = `intent:${encodedHtml}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;S.text_type=html;end;`;
      window.location.href = intentUrl;
      return { success: true, printer: 'Android RawBT' };
    } catch (error) {
      console.error('Android RawBT print failed:', error);
      return { success: false, printer: 'Android RawBT' };
    }
  }

  try {
    const response = await fetch('http://127.0.0.1:5001/print', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html,
        printer: targetPrinter,
        width,
        title: docName
      }),
    });

    const data = await response.json().catch(() => ({}));
    return { success: !!data.success, printer: data.printer || targetPrinter || 'Default Printer', error: data.error as string | undefined };
  } catch (error: any) {
    console.error('Silent print failed:', error);
    return { success: false, printer: targetPrinter || 'Default Printer', error: error?.message || 'Print service not reachable' };
  }
};

const openBrowserPrint = (url: string) => {
  const u = url.includes('?') ? `${url}&autoprint=1` : `${url}?autoprint=1`;
  const w = 400, h = 600;
  const left = window.screen.width / 2 - w / 2, top = window.screen.height / 2 - h / 2;
  window.open(u, 'BizzFlowPrint', `width=${w},height=${h},top=${top},left=${left}`);
};

/** Render a print page in a hidden iframe and return its printable HTML (styles + body). */
// 25s: the first open of a page in dev mode compiles it, which can take 10-15s
const capturePageHtml = (url: string, readySelector: string, timeoutMs = 25000) =>
  new Promise<string | null>((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(iframe);
    iframe.src = url;
    const cleanup = () => { clearInterval(poll); clearTimeout(timer); iframe.remove(); };
    const poll = setInterval(() => {
      const doc = iframe.contentDocument;
      if (!doc || !doc.querySelector(readySelector)) return;
      clearInterval(poll);
      // short settle so late data (company, payments) is in the DOM
      setTimeout(() => {
        const styles = Array.from(doc.querySelectorAll('style')).map((s) => s.outerHTML).join('\n');
        const clone = doc.body.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('nextjs-portal, .no-print, button, script, #__next-build-watcher').forEach((el) => el.remove());
        // print the print-only copy directly (it is display:none on screen)
        clone.querySelectorAll<HTMLElement>('.print-only').forEach((el) => { el.style.display = 'block'; });
        cleanup();
        resolve(`<html><head><meta charset="utf-8">${styles}</head><body>${clone.innerHTML}</body></html>`);
      }, 400);
    }, 100);
    const timer = setTimeout(() => { cleanup(); resolve(null); }, timeoutMs);
  });

/**
 * One print path for every POS document (receipt, guest bill, KOT):
 *  - "Browser" mode, no bridge, or capture/bridge failure -> browser print window (never loses a print)
 *  - otherwise -> silent print to the printer mapped for the role, at its paper width
 */
export const printPage = async (
  url: string,
  role: PrinterRole,
  docName: string,
  readySelector = '.receipt',
  /** Print station override (Kitchen / Bar ...): this printer + paper instead of the role's mapping */
  target?: { printer?: string | null; width?: '80mm' | '58mm' | null }
): Promise<{ mode: 'silent' | 'browser'; success: boolean; printer?: string; error?: string }> => {
  const isAndroid = /Android/i.test(navigator.userAgent);
  const settings = await getPrinterSettings();
  const bridge = isAndroid || (await isPrinterServiceAvailable());

  if (settings.mode === 'Browser' || !bridge) {
    openBrowserPrint(url);
    return { mode: 'browser', success: true, error: !bridge ? 'Print service not running on this PC' : undefined };
  }

  const html = await capturePageHtml(url, readySelector);
  if (!html) {
    openBrowserPrint(url);
    return { mode: 'browser', success: true, error: 'Could not prepare the document for silent printing' };
  }
  const result = target?.printer
    ? await silentPrint(html, target.printer, target.width || '80mm', docName)
    : await silentPrint(html, role, undefined, docName);
  if (!result.success) {
    openBrowserPrint(url);
    return { mode: 'browser', success: true, printer: result.printer, error: result.error || 'Printer did not accept the job' };
  }
  return { mode: 'silent', success: true, printer: result.printer };
};

/**
 * Checks if the local print service is running
 */
export const isPrinterServiceAvailable = async () => {
  if (/Android/i.test(navigator.userAgent)) return true;

  const endpoints = ['http://127.0.0.1:5001/printers', 'http://localhost:5001/printers'];
  for (const url of endpoints) {
      try {
          const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(3000) });
          if (response.ok) return true;
      } catch (e) {}
  }
  return false;
};
