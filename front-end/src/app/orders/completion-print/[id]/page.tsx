"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { fetchOrder, fetchOrderParts, type OrderPartRow } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, ArrowLeft } from "lucide-react";

type ChecklistDoneItem = { item: string; checked: boolean; comment?: string };

function safeChecklistDone(value: any): ChecklistDoneItem[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => ({
        item: String((v as any)?.item ?? ""),
        checked: Boolean((v as any)?.checked ?? false),
        comment: (v as any)?.comment ? String((v as any).comment) : "",
      }))
      .filter((v) => v.item);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return safeChecklistDone(parsed);
    } catch {
      return [];
    }
  }
  return [];
}

export default function OrderCompletionPrintPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params?.id;
  const auto = searchParams?.get("autoprint") === "1";

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [parts, setParts] = useState<OrderPartRow[]>([]);
  const printedRef = useRef(false);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const [o, p] = await Promise.all([
          fetchOrder(String(id)),
          fetchOrderParts(String(id)),
        ]);
        setOrder(o);
        setParts(Array.isArray(p) ? p : []);
      } finally {
        setLoading(false);
      }
    };
    if (id) void run();
  }, [id]);

  const data = useMemo(() => {
    const o: any = order || {};
    return {
      id: o.id ?? id,
      vehicleModel: String(o.vehicle_model || ""),
      vehicleIdentifier: String(o.vehicle_identifier || ""),
      mileage: o.mileage ?? "",
      priority: String(o.priority || ""),
      status: String(o.status || ""),
      createdAt: String(o.created_at || ""),
      expectedAt: String(o.expected_time || ""),
      completedAt: String(o.completed_at || ""),
      problem: String(o.problem_description || ""),
      comments: String(o.comments || ""),
      bay: String(o.location || ""),
      technician: String(o.technician || ""),
      completionComments: String(o.completion_comments || ""),
      checklistDone: safeChecklistDone(o.checklist_done_json),
    };
  }, [order, id]);

  const total = useMemo(() => {
    return parts.reduce((sum, l) => sum + (l.line_total ? Number(l.line_total) : 0), 0);
  }, [parts]);

  useEffect(() => {
    if (!auto || loading || !order || printedRef.current) return;
    printedRef.current = true;
    const t = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(t);
  }, [auto, loading, order]);

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }
          html,
          body {
            background: #fff !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>

      <div className="print:hidden sticky top-0 z-10 bg-background/90 backdrop-blur border-b">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="font-semibold">Order Completion Report</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push(`/orders/${id}`)}>
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="w-4 h-4" />
              Print
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-muted/20 min-h-screen py-8 print:bg-white print:py-0">
        <div className="mx-auto max-w-5xl px-4">
          {loading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading report...
            </div>
          ) : !order ? (
            <div className="py-24 text-center text-muted-foreground">Order not found.</div>
          ) : (
            <div className="bg-white border shadow-sm rounded-md p-8 print:border-0 print:shadow-none print:rounded-none">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-2xl font-bold">ServiceBay</div>
                  <div className="text-sm text-muted-foreground">Order Completion Report</div>
                </div>
                <div className="text-sm text-right">
                  <div className="font-semibold">Order #{data.id}</div>
                  <div>Status: {data.status || "-"}</div>
                  <div>Completed: {data.completedAt || "-"}</div>
                </div>
              </div>

              <div className="my-6 border-t" />

              <div className="grid grid-cols-2 gap-6 text-sm">
                <div>
                  <div className="text-muted-foreground">Vehicle</div>
                  <div className="font-semibold">{data.vehicleModel || "-"}</div>
                  {data.vehicleIdentifier ? (
                    <div className="text-muted-foreground">{data.vehicleIdentifier}</div>
                  ) : null}
                  <div>Mileage: {data.mileage ? `${data.mileage} km` : "-"}</div>
                  <div>Priority: {data.priority || "-"}</div>
                </div>
                <div>
                  <div>Created: {data.createdAt || "-"}</div>
                  <div>Expected: {data.expectedAt || "-"}</div>
                  <div>Bay: {data.bay || "-"}</div>
                  <div>Technician: {data.technician || "-"}</div>
                </div>
              </div>

              <div className="my-6 border-t" />

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <div className="font-semibold mb-2">Problem Description</div>
                  <div className="whitespace-pre-wrap text-sm">{data.problem || "-"}</div>
                </div>
                {data.comments ? (
                  <div>
                    <div className="font-semibold mb-2">Comments</div>
                    <div className="whitespace-pre-wrap text-sm">{data.comments}</div>
                  </div>
                ) : null}
              </div>

              <div className="my-6 border-t" />

              <div>
                <div className="font-semibold mb-3">Checklist</div>
                {data.checklistDone.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No checklist items recorded.</div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    {data.checklistDone.map((c, idx) => (
                      <div key={`${c.item}-${idx}`} className="flex items-start justify-between gap-4 border rounded-md p-2">
                        <div>
                          <div className="font-medium">{c.item}</div>
                          {c.comment ? <div className="text-muted-foreground">{c.comment}</div> : null}
                        </div>
                        <div className="text-xs uppercase tracking-widest">
                          {c.checked ? "Checked" : "Not checked"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="my-6 border-t" />

              <div>
                <div className="font-semibold mb-3">Parts Used</div>
                {parts.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No parts issued.</div>
                ) : (
                  <table className="w-full text-sm border">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="text-left p-2 border">Item</th>
                        <th className="text-right p-2 border">Qty</th>
                        <th className="text-right p-2 border">Unit Price</th>
                        <th className="text-right p-2 border">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parts.map((p) => (
                        <tr key={p.id}>
                          <td className="p-2 border">{p.part_name}</td>
                          <td className="p-2 border text-right">{p.quantity}</td>
                          <td className="p-2 border text-right">{p.unit_price}</td>
                          <td className="p-2 border text-right">{p.line_total}</td>
                        </tr>
                      ))}
                      <tr>
                        <td className="p-2 border text-right font-semibold" colSpan={3}>Total</td>
                        <td className="p-2 border text-right font-semibold">{total.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>

              {data.completionComments ? (
                <>
                  <div className="my-6 border-t" />
                  <div>
                    <div className="font-semibold mb-2">Completion Notes</div>
                    <div className="whitespace-pre-wrap text-sm">{data.completionComments}</div>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
