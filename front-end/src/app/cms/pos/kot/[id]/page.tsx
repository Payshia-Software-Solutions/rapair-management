"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { fetchKOTDetails, markKOTPrinted } from "@/lib/api";
import { Loader2 } from "lucide-react";

function KOTContent() {
  const params = useParams();
  const id = params.id as string;
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get('autoprint') === '1';
  const isFullKOT = searchParams.get('full') === '1';
  // Split KOT (print stations): this window prints one station's part; the POS marks the KOT sent after all parts
  const station = searchParams.get('station');

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const printedRef = useRef(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchKOTDetails(id, isFullKOT, station);
        setOrder(data);
      } catch (error) {
        console.error("Failed to load KOT data", error);
      } finally {
        setLoading(false);
      }
    };
    if (id) loadData();
  }, [id, isFullKOT, station]);

  useEffect(() => {
    if (autoPrint && !loading && order && ((order.items?.length || 0) + (order.voids?.length || 0) > 0) && !printedRef.current) {
      printedRef.current = true;
      const timer = setTimeout(async () => {
        window.print();
        // After print dialog, mark as printed in background (split parts are marked by the POS)
        if (station) return;
        try {
          await markKOTPrinted(id);
        } catch (e) {
          console.error("Failed to mark KOT as printed", e);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, loading, order, id]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!order || ((order.items?.length || 0) + (order.voids?.length || 0)) === 0) {
    return (
      <div className="flex flex-col h-screen items-center justify-center p-8 text-center">
        <div className="mb-4 text-gray-400">
           <svg className="w-16 h-16 mx-auto mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
           </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-700">No New Items</h2>
        <p className="text-gray-500 mt-2 max-w-xs">All items in this bill have already been sent to the service team (Order printed).</p>
        <button 
          onClick={() => window.close()}
          className="mt-6 px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium border border-gray-200"
        >
          Close Window
        </button>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @page {
          size: 80mm auto;
          margin: 1mm 2mm;
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print { display: none !important; }
        }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: white !important; background-color: white !important; font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #000000 !important; }
        .kot { width: 100%; max-width: 80mm; margin: 0 auto; padding: 0; color: #000; background: white; }
        .center { text-align: center; }
        .bold { font-weight: 800; }
        .hr { border: none; border-top: 2px solid #000; margin: 8px 0; }
        .hr-dashed { border: none; border-top: 1px dashed #000; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; margin: 2px 0; font-size: 14px; }
        .item-row { padding: 4px 0; border-bottom: 1px solid #eee; }
        .item-name { font-size: 14px; font-weight: 700; line-height: 1.2; }
        .item-type { font-size: 9px; color: #666; text-transform: uppercase; margin-top: 2px; }
        .item-qty { font-size: 16px; font-weight: 900; text-align: right; }
        .kot-header { background: #000; color: #fff; padding: 10px; margin-bottom: 12px; border-radius: 4px; }
        .kot-title { font-size: 22px; font-weight: 900; letter-spacing: 1px; }
        .meta-label { font-size: 10px; text-transform: uppercase; color: #666; font-weight: 600; margin-bottom: 2px; }
        .meta-val { font-size: 14px; font-weight: 800; }
        
        /* Preview UI */
        .preview-wrap { min-height: 100vh; background: #f3f4f6; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; }
        .preview-paper { background: white; width: 80mm; padding: 15px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); border-radius: 4px; border: 1px solid #e5e7eb; }
        .btn-primary { background: #111827; color: white; border: none; padding: 12px 32px; borderRadius: 10px; fontWeight: 700; cursor: pointer; fontSize: 15px; border-radius: 8px; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .btn-primary:hover { background: #000; transform: translateY(-1px); }
        .btn-secondary { background: white; color: #374151; border: 1px solid #d1d5db; padding: 12px 32px; borderRadius: 10px; fontWeight: 700; cursor: pointer; fontSize: 15px; border-radius: 8px; }
        .btn-secondary:hover { background: #f9fafb; }
      `}</style>

      {/* Screen Preview Wrapper (hidden on print) */}
      <div className="no-print preview-wrap">
        <div className="mb-6 text-center">
            <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2 inline-block ${isFullKOT ? 'bg-amber-100 text-amber-800' : 'bg-yellow-100 text-yellow-800'}`}>
              {isFullKOT ? 'Kitchen Order (Reprint)' : 'Kitchen Order'}
            </span>
            <h1 className="text-2xl font-black text-gray-900">{isFullKOT ? 'KOT Reprint Preview' : 'KOT Preview'}</h1>
        </div>
        
        <div className="preview-paper">
          <div className="kot">
            <KOTBody order={order} isFullKOT={isFullKOT} />
          </div>
        </div>

        <div className="mt-8 flex gap-4">
          <button onClick={() => window.print()} className="btn-primary">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            {isFullKOT ? 'Print KOT (Reprint)' : 'Print KOT'}
          </button>
          <button onClick={() => window.close()} className="btn-secondary">
            Close
          </button>
        </div>
      </div>

      {/* Print-only version */}
      <div style={{ display: 'none' }} className="print-only">
        <div className="kot">
          <KOTBody order={order} isFullKOT={isFullKOT} />
        </div>
      </div>

      <style>{`
        @media print {
          .preview-wrap { display: none !important; }
          .print-only { display: block !important; }
        }
      `}</style>
    </>
  );
}

/**
 * Compact kitchen ticket (internal, saves paper):
 *  - 2-line header: KOT no / table / type, then time / steward
 *  - items in large type, qty first; identical lines (same item + notes) merged
 *  - no customer, no footer banner, minimal rules and spacing
 */
function KOTBody({ order, isFullKOT }: { order: any; isFullKOT?: boolean }) {
  const parseMods = (it: any): string[] => {
    try { const m = it.modifiers_json ? JSON.parse(it.modifiers_json) : []; return Array.isArray(m) ? m : []; } catch { return []; }
  };
  const merged: any[] = [];
  for (const it of order.items || []) {
    const notes = it.item_notes || it.notes || '';
    const mods = parseMods(it);
    const key = `${it.item_id ?? it.description}|${notes}|${mods.join(',')}`;
    const hit = merged.find(m => m.key === key);
    if (hit) hit.qty += Number(it.quantity || 0);
    else merged.push({ key, name: it.description, qty: Number(it.quantity || 0), notes, mods });
  }
  const totalQty = merged.reduce((s, m) => s + m.qty, 0);
  const time = new Date(order.created_at || Date.now()).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const type = (order.order_type || 'retail').replace('_', ' ').toUpperCase();

  return (
    <div style={{ fontSize: '13px', lineHeight: 1.25 }}>
      {/* Header: 2 lines */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontWeight: 900 }}>
        <span style={{ fontSize: '15px' }}>{order.ticket_label || 'KOT'}{isFullKOT ? ' REPRINT' : ''} #{order.id}</span>
        <span style={{ fontSize: '15px' }}>{order.table_name ? `T: ${order.table_name}` : type}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
        <span>{time}{order.table_name ? ` · ${type}` : ''}</span>
        {order.steward_name && <span>{order.steward_name}</span>}
      </div>
      <div style={{ borderTop: '1px dashed #000', margin: '3px 0' }} />

      {/* Items */}
      {merged.map((m, i) => (
        <div key={i} style={{ display: 'flex', gap: '6px', padding: '2px 0' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, minWidth: '24px' }}>{m.qty}x</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>{m.name}</div>
            {m.mods.map((x: string) => <div key={x} style={{ fontSize: '13px', fontWeight: 800 }}>&gt; {x}</div>)}
            {m.notes && <div style={{ fontSize: '12px', fontStyle: 'italic', fontWeight: 700 }}>** {m.notes}</div>}
          </div>
        </div>
      ))}

      {/* Items removed after they were sent: kitchen must stop/discard these */}
      {Array.isArray(order.voids) && order.voids.length > 0 && (
        <div style={{ marginTop: '4px', borderTop: '1px dashed #000', paddingTop: '3px' }}>
          <div style={{ fontSize: '13px', fontWeight: 900, letterSpacing: '1px' }}>*** CANCELLED ***</div>
          {order.voids.map((v: any) => (
            <div key={v.id} style={{ padding: '2px 0' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, minWidth: '24px', textDecoration: 'line-through' }}>{Number(v.quantity)}x</span>
                <span style={{ fontSize: '14px', fontWeight: 700, textDecoration: 'line-through' }}>{v.description}</span>
              </div>
              <div style={{ fontSize: '11px', paddingLeft: '32px' }}>
                {v.reason ? `${v.reason} · ` : ''}By {v.removed_by_name || '—'} · Appr: {v.approved_by_name || '—'}
              </div>
            </div>
          ))}
        </div>
      )}

      {order.notes && (
        <div style={{ fontSize: '12px', fontWeight: 700, marginTop: '2px' }}>NOTE: {order.notes}</div>
      )}
      <div style={{ borderTop: '1px dashed #000', margin: '3px 0 0', paddingTop: '2px', display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
        <span>{merged.length} items · {totalQty} qty</span>
        <span>{[order.station_name, isFullKOT ? 'REPRINT' : ''].filter(Boolean).join(' · ')}</span>
      </div>
    </div>
  );
}

export default function KOTPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <KOTContent />
    </Suspense>
  );
}
