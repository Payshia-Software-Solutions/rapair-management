"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { fetchPaymentReceiptDetails, fetchCompany, contentUrl, type CompanyRow } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, X, Phone, Mail, MapPin, Receipt, CheckCircle2, CreditCard, Banknote, Building2 } from "lucide-react";

function PrintContent() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get('autoprint') === '1';

  const [receipt, setReceipt] = useState<any>(null);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const printedRef = useRef(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [receiptData, companyData] = await Promise.all([
          fetchPaymentReceiptDetails(id),
          fetchCompany().catch(() => null)
        ]);
        setReceipt(receiptData);
        setCompany(companyData);
      } catch (error) {
        console.error("Failed to load print data", error);
      } finally {
        setLoading(false);
      }
    };
    if (id) loadData();
  }, [id]);

  useEffect(() => {
    if (autoPrint && !loading && receipt && !printedRef.current) {
      printedRef.current = true;
      const timer = setTimeout(() => {
        window.print();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, loading, receipt]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-slate-500 font-medium tracking-tight">Preparing Receipt...</p>
        </div>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <p className="text-rose-500 font-bold">Error: Receipt Not Found</p>
          <Button variant="outline" onClick={() => window.close()}>Close Window</Button>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number | string) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'LKR' }).format(Number(amount));
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'Cash': return <Banknote className="w-5 h-5 text-emerald-500" />;
      case 'Card': return <CreditCard className="w-5 h-5 text-blue-500" />;
      case 'Cheque': return <Receipt className="w-5 h-5 text-amber-500" />;
      default: return <Building2 className="w-5 h-5 text-violet-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/50 print:bg-white">
      {/* 1. Control Bar */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 print:hidden px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Printer className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">Receipt Preview</span>
            <span className="text-slate-400 text-xs font-mono ml-2">{receipt.receipt_no}</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => window.close()} className="text-slate-500 hover:text-slate-900">
              <X className="w-4 h-4 mr-2" /> Close
            </Button>
            <Button size="sm" onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200">
              <Printer className="w-4 h-4 mr-2" /> Print Receipt
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Paper Area */}
      <div className="py-6 print:py-0">
        <div className="mx-auto w-[210mm] min-h-[148mm] bg-white shadow-2xl print:shadow-none print:w-full print:border-none px-12 py-10 text-slate-900 border border-slate-200 relative overflow-hidden">
          
          {/* Subtle Background Mark */}
          <div className="absolute -right-20 -top-20 opacity-[0.03] rotate-12 pointer-events-none">
            <CheckCircle2 className="w-96 h-96 text-emerald-900" />
          </div>

          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
            <div className="space-y-3">
              {company?.logo_filename && (
                <img src={contentUrl('company', company.logo_filename)} alt="Logo" className="w-16 h-16 object-contain" />
              )}
              <div>
                <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase leading-none">Official Receipt</h1>
                <p className="text-slate-400 font-mono text-xs tracking-[0.2em] mt-1 uppercase">Payment Confirmation</p>
              </div>
            </div>
            
            <div className="text-right space-y-1 pt-1">
              <p className="text-lg font-black text-slate-900 uppercase leading-none">
                {company?.name || "ServiceBay Solutions"}
              </p>
              <div className="text-[11px] text-slate-500 whitespace-pre-line leading-tight">
                {company?.address || "Main Street, Colombo"}
                <div className="mt-2 space-y-0.5">
                  <div className="flex items-center justify-end gap-1.5 font-bold text-slate-700 italic">
                    <Phone className="w-3 h-3"/> {company?.phone}
                  </div>
                  {company?.tax_no && (
                    <div className="flex items-center justify-end gap-1.5 font-black text-slate-900 uppercase text-[10px]">
                      {company?.tax_label || "TAX ID"}: {company?.tax_no}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Meta Info Grid */}
          <div className="grid grid-cols-2 gap-12 py-8">
            <div className="space-y-6">
              <div className="space-y-1.5">
                <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Received From</h4>
                <p className="text-lg font-black text-slate-900 leading-none">{receipt.customer_name}</p>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">{receipt.customer_phone}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <h4 className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">Receipt No</h4>
                  <p className="text-sm font-mono font-black text-emerald-600">{receipt.receipt_no}</p>
                </div>
                <div className="space-y-1 text-right">
                  <h4 className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">Date</h4>
                  <p className="text-sm font-bold text-slate-700">{new Date(receipt.payment_date).toLocaleDateString('en-GB')}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4">
              <div className="flex justify-between items-start">
                <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 leading-none">Amount Paid</h4>
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  {getMethodIcon(receipt.payment_method)}
                </div>
              </div>
              <div className="space-y-0.5">
                <p className="text-3xl font-black text-slate-900 tracking-tighter tabular-nums">
                  LKR {Number(receipt.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest italic">In Local Currency</p>
              </div>
              
              <div className="pt-3 border-t border-slate-200">
                <div className="flex justify-between text-[11px]">
                  <span className="font-bold text-slate-500 uppercase">Payment Method</span>
                  <span className="font-black text-slate-900 uppercase italic">{receipt.payment_method}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Payment Specs */}
          <div className="border-t-2 border-slate-100 pt-6">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-4">Transaction Reference</h4>
            
            <div className="grid grid-cols-3 gap-8">
              <div className="space-y-1">
                <h5 className="text-[8px] font-bold uppercase text-slate-400">In Relation To</h5>
                <p className="text-xs font-black text-slate-700 uppercase">Invoice #{receipt.invoice_no}</p>
              </div>

              {receipt.payment_method === 'Card' && (
                <>
                  <div className="space-y-1">
                    <h5 className="text-[8px] font-bold uppercase text-slate-400">Card Details</h5>
                    <p className="text-xs font-black text-slate-700 uppercase leading-tight">
                      {receipt.card_type} {receipt.card_last4 && `(**** ${receipt.card_last4})`}
                    </p>
                    <p className="text-[10px] font-bold text-indigo-600 uppercase">
                      {receipt.card_bank_name || 'Processed via Gateway'}
                    </p>
                    {receipt.card_category && (
                      <span className="text-[8px] font-black px-1.5 py-0.5 bg-slate-100 rounded uppercase tracking-tighter">
                        {receipt.card_category} Card
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 text-right">
                    <h5 className="text-[8px] font-bold uppercase text-slate-400">Authorization Code</h5>
                    <p className="text-xs font-mono font-black text-slate-900">
                      {receipt.card_auth_code || "N/A"}
                    </p>
                  </div>
                </>
              )}

              {receipt.payment_method === 'Cheque' && (
                <>
                  <div className="space-y-1">
                    <h5 className="text-[8px] font-bold uppercase text-slate-400">Cheque Info</h5>
                    <p className="text-xs font-black text-slate-700 uppercase">
                      #{receipt.cheque_no_last6}
                    </p>
                    <p className="text-[10px] font-bold text-amber-600 uppercase">
                      {receipt.cheque_bank_name}
                    </p>
                  </div>
                  <div className="space-y-1 text-right">
                    <h5 className="text-[8px] font-bold uppercase text-slate-400">Cheque Date</h5>
                    <p className="text-xs font-bold text-slate-700">
                      {receipt.cheque_date ? new Date(receipt.cheque_date).toLocaleDateString('en-GB') : "N/A"}
                    </p>
                  </div>
                </>
              )}

              {receipt.payment_method === 'Bank Transfer' && receipt.reference_no && (
                <div className="space-y-1">
                  <h5 className="text-[8px] font-bold uppercase text-slate-400">Ref Code</h5>
                  <p className="text-xs font-mono font-black text-slate-700">{receipt.reference_no}</p>
                </div>
              )}
            </div>
          </div>

          {/* Words Section */}
          <div className="mt-12 p-4 bg-slate-50/50 border border-slate-100 rounded-xl">
             <div className="flex gap-4 items-center">
                <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest whitespace-nowrap">Amount in Words</div>
                <div className="text-[11px] font-bold text-slate-600 italic border-l border-slate-200 pl-4 capitalize">
                   {/* Placeholder for real currency to words converter if needed, usually LKR receipts just have amount */}
                   Total payment of {formatCurrency(receipt.amount)} received in full satisfaction of the above reference.
                </div>
             </div>
          </div>

          {/* Footer Signatures */}
          <div className="mt-16 flex justify-between items-end">
            <div className="w-48 text-center space-y-4">
               <div className="h-px bg-slate-200 w-full"></div>
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Customer Signature</p>
            </div>

            <div className="text-center space-y-4">
              <div className="flex flex-col items-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                <p className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Digitally Verified</p>
              </div>
              <p className="text-[8px] text-slate-400 font-medium">Thank you for your business!</p>
            </div>

            <div className="w-48 text-center space-y-4">
               <div className="h-px bg-slate-200 w-full"></div>
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Authorized Officer</p>
            </div>
          </div>

        </div>
      </div>
      
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body {
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .min-h-screen {
            min-height: auto !important;
            background: none !important;
          }
          .mx-auto {
            margin: 0 !important;
            width: 210mm !important;
            min-height: 148mm !important; /* Half A4 height if desired, but 297mm for full A4 */
          }
          /* Control specifically the printable card container */
          .shadow-2xl, .bg-slate-100\\/50, .py-6, .sticky {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function ReceiptPrintPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    }>
      <PrintContent />
    </Suspense>
  );
}
