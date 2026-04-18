"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { fetchReturnPrintData, fetchCompany } from "@/lib/api";
import { Loader2 } from "lucide-react";

function ReceiptContent() {
  const params = useParams();
  const id = params.id as string;
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get('autoprint') === '1';

  const [returnData, setReturnData] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const printedRef = useRef(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [printData, companyData] = await Promise.all([
          fetchReturnPrintData(id),
          fetchCompany().catch(() => null)
        ]);
        setReturnData(printData);
        setCompany(companyData);
      } catch (error) {
        console.error("Failed to load return receipt data", error);
      } finally {
        setLoading(false);
      }
    };
    if (id) loadData();
  }, [id]);

  useEffect(() => {
    if (autoPrint && !loading && returnData && !printedRef.current) {
      printedRef.current = true;
      const timer = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, loading, returnData]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!returnData) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-red-500 font-bold">Return document not found.</p>
      </div>
    );
  }

  const fmt = (n: number | string) => Number(n).toFixed(2);

  return (
    <>
      <style>{`
        @page {
          size: 80mm auto;
          margin: 4mm 3mm;
        }
        @media print {
          html, body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
        }
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; background: white; font-family: 'Courier New', Courier, monospace; }
        .receipt { width: 100%; max-width: 80mm; margin: 0 auto; padding: 4px 0; font-size: 11px; color: #000; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .hr { border: none; border-top: 1px dashed #000; margin: 5px 0; }
        .hr-solid { border: none; border-top: 1px solid #000; margin: 5px 0; }
        .row { display: flex; justify-content: space-between; margin: 1px 0; }
        .row-item { display: flex; flex-direction: column; margin: 3px 0; }
        .row-item .item-name { font-weight: bold; word-break: break-word; }
        .row-item .item-detail { display: flex; justify-content: space-between; }
        .grand-total { display: flex; justify-content: space-between; font-size: 15px; font-weight: bold; margin: 4px 0; }
        .shop-name { font-size: 16px; font-weight: bold; letter-spacing: 1px; margin-bottom: 2px; }
        .tag { font-size: 10px; color: #333; }
        .preview-wrap { min-height: 100vh; background: #e5e7eb; display: flex; align-items: flex-start; justify-content: center; padding: 24px; }
        .preview-paper { background: white; width: 80mm; padding: 6px 8px; box-shadow: 0 4px 24px rgba(0,0,0,0.15); min-height: 200px; }
      `}</style>

      {/* Screen Preview Wrapper */}
      <div className="no-print preview-wrap">
        <div>
          <div className="preview-paper">
            <div className="receipt">
              <ReturnReceiptBody data={returnData} company={company} fmt={fmt} />
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button
              onClick={() => window.print()}
              style={{ background: '#e11d48', color: 'white', border: 'none', padding: '10px 28px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', marginRight: '8px' }}
            >
              🖨 Print Return Note
            </button>
            <button
              onClick={() => window.close()}
              style={{ background: '#e5e7eb', color: '#111', border: 'none', padding: '10px 28px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Print-only version */}
      <div style={{ display: 'none' }} className="print-only">
        <div className="receipt">
          <ReturnReceiptBody data={returnData} company={company} fmt={fmt} />
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

function ReturnReceiptBody({ data, company, fmt }: any) {
  const returnObj = data.return;
  const items = data.items || [];

  return (
    <>
      <div className="center">
        {company?.name && <div className="shop-name">{company.name}</div>}
        {returnObj.location_name && <div className="tag">{returnObj.location_name}</div>}
        {company?.phone && <div className="tag">Tel: {company.phone}</div>}
        {company?.address && <div className="tag">{company.address}</div>}
      </div>

      <hr className="hr-solid" />
      <div className="center bold" style={{ fontSize: '13px', margin: '4px 0' }}>SALES RETURN NOTE</div>
      <hr className="hr-solid" />

      <div className="row"><span>Return#</span><span className="bold">{returnObj.return_no}</span></div>
      <div className="row"><span>Date</span><span>{new Date(returnObj.return_date).toLocaleDateString('en-GB')}</span></div>
      <div className="row"><span>Invoice#</span><span>{returnObj.invoice_no}</span></div>
      {returnObj.customer_name && <div className="row"><span>Customer</span><span>{returnObj.customer_name}</span></div>}

      <hr className="hr" />

      <div className="bold" style={{ marginBottom: '4px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Returned Items</div>
      {items.map((item: any, idx: number) => (
        <div className="row-item" key={idx}>
          <div className="item-name">{item.description}</div>
          <div className="item-detail">
            <span>{Math.floor(item.quantity)} Unit(s)</span>
            <span className="bold">LKR {fmt(item.line_total)}</span>
          </div>
        </div>
      ))}

      <hr className="hr-solid" />

      <div className="grand-total">
        <span>RETURN TOTAL</span>
        <span>LKR {fmt(returnObj.total_amount)}</span>
      </div>

      {returnObj.reason && (
        <div style={{ marginTop: '8px', fontSize: '10px' }}>
          <span className="bold">Reason:</span> {returnObj.reason}
        </div>
      )}

      <hr className="hr" />

      <div className="center tag" style={{ marginTop: '8px' }}>
        <div>Thank you!</div>
        <div style={{ marginTop: '10px', fontSize: '9px', letterSpacing: '1px' }}>* * * * * * * * * *</div>
      </div>
    </>
  );
}

export default function ReturnReceiptPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <ReceiptContent />
    </Suspense>
  );
}
