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

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const printedRef = useRef(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchKOTDetails(id, isFullKOT);
        setOrder(data);
      } catch (error) {
        console.error("Failed to load KOT data", error);
      } finally {
        setLoading(false);
      }
    };
    if (id) loadData();
  }, [id, isFullKOT]);

  useEffect(() => {
    if (autoPrint && !loading && order && (order.items?.length > 0) && !printedRef.current) {
      printedRef.current = true;
      const timer = setTimeout(async () => {
        window.print();
        // After print dialog, mark as printed in background
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

  if (!order || !order.items || order.items.length === 0) {
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
          margin: 4mm 3mm;
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
        .kot { width: 100%; max-width: 80mm; margin: 0 auto; padding: 4px 0; color: #000; background: white; }
        .center { text-align: center; }
        .bold { font-weight: 800; }
        .hr { border: none; border-top: 2px solid #000; margin: 8px 0; }
        .hr-dashed { border: none; border-top: 1px dashed #000; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; margin: 2px 0; font-size: 14px; }
        .item-row { padding: 4px 0; border-bottom: 1px solid #eee; }
        .item-name { font-size: 14px; font-weight: 700; line-height: 1.2; text-transform: uppercase; }
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

function KOTBody({ order, isFullKOT }: { order: any; isFullKOT?: boolean }) {
  const totalQty = (order.items || []).reduce((acc: number, it: any) => acc + Number(it.quantity || 0), 0);
  const itemCount = (order.items || []).length;

  return (
    <>
      <div className="center kot-header">
        <div className="kot-title">{isFullKOT ? 'REPRINT - K.O.T' : 'K.O.T'}</div>
        <div style={{ fontSize: '10px', marginTop: '2px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.9 }}>
          {isFullKOT ? 'Kitchen Order Ticket (Duplicate / Reprint)' : 'Kitchen Order Ticket'}
        </div>
      </div>

      {/* Outlet Location Header */}
      {order.location_name && (
        <div className="center bold" style={{ fontSize: '13px', textTransform: 'uppercase', marginBottom: '6px' }}>
          {order.location_name}
        </div>
      )}

      {/* Prominent Table & Order Type Box */}
      <div style={{ border: '2px solid #000', padding: '6px 8px', borderRadius: '4px', marginBottom: '6px' }}>
        <div className="row" style={{ alignItems: 'center' }}>
          <div>
            <span className="meta-label">TABLE: </span>
            <span style={{ fontSize: '17px', fontWeight: 900 }}>{order.table_name || 'Counter / Take Away'}</span>
          </div>
          <div className="text-right">
            <span style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', background: '#000', color: '#fff', padding: '2px 6px', borderRadius: '3px' }}>
              {order.order_type?.replace('_', ' ') || 'RETAIL'}
            </span>
          </div>
        </div>
      </div>

      {/* Order Meta Info */}
      <div className="row" style={{ fontSize: '12px' }}>
        <div>
           <span className="meta-label">KOT / Order #: </span>
           <span className="bold">#{order.id}</span>
        </div>
        <div className="text-right">
           <span className="meta-label">Date: </span>
           <span>{new Date(order.created_at || Date.now()).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</span>
        </div>
      </div>

      {/* Steward & Customer Info */}
      {(order.steward_name || order.customer_name) && (
        <div className="row" style={{ fontSize: '11px', marginTop: '2px' }}>
          {order.steward_name && (
            <div>
              <span className="meta-label">Steward: </span>
              <span className="bold">{order.steward_name}</span>
            </div>
          )}
          {order.customer_name && (
            <div className="text-right">
              <span className="meta-label">Guest: </span>
              <span>{order.customer_name}</span>
            </div>
          )}
        </div>
      )}

      <div className="hr" />

      {/* Items List */}
      <table className="w-full text-left" style={{ width: '100%' }}>
        <thead>
          <tr className="meta-label" style={{ borderBottom: '1.5px solid #000' }}>
            <th className="pb-1" style={{ width: '45px', textAlign: 'center' }}>QTY</th>
            <th className="pb-1">ITEM DESCRIPTION</th>
          </tr>
        </thead>
        <tbody>
          {(order.items || []).map((item: any, idx: number) => (
            <tr key={idx} className="item-row" style={{ borderBottom: '1px dashed #ccc' }}>
              <td className="py-2.5" style={{ verticalAlign: 'top', textAlign: 'center' }}>
                <span style={{ fontSize: '17px', fontWeight: 900, border: '1.5px solid #000', padding: '1px 6px', borderRadius: '3px', display: 'inline-block' }}>
                  {Number(item.quantity)}
                </span>
              </td>
              <td className="py-2.5" style={{ paddingLeft: '8px', verticalAlign: 'top' }}>
                <div className="item-name" style={{ fontSize: '14px', fontWeight: 800 }}>{item.description}</div>
                {item.item_type && item.item_type !== 'Part' && (
                  <div className="item-type">{item.item_type}</div>
                )}
                {item.notes && (
                  <div style={{ fontSize: '10px', fontStyle: 'italic', fontWeight: 700, color: '#444', marginTop: '2px' }}>
                    ** {item.notes}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="hr" />

      {/* Summary Row */}
      <div className="row bold" style={{ fontSize: '12px', margin: '4px 0' }}>
        <span>Total Items: {itemCount}</span>
        <span>Total Qty: {totalQty}</span>
      </div>

      {order.notes && (
        <div style={{ border: '1px dashed #000', padding: '4px 6px', marginTop: '6px', fontSize: '11px' }}>
          <span className="bold">Special Instructions: </span>
          <span>{order.notes}</span>
        </div>
      )}

      <div className="center" style={{ marginTop: '10px', borderTop: '1px solid #000', paddingTop: '6px' }}>
        <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase' }}>
          {isFullKOT ? '*** REPRINT - KITCHEN COPY ***' : '*** KITCHEN COPY ***'}
        </div>
        <div style={{ fontSize: '9px', marginTop: '2px', color: '#555' }}>Printed: {new Date().toLocaleString()}</div>
      </div>
    </>
  );
}

export default function KOTPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <KOTContent />
    </Suspense>
  );
}
