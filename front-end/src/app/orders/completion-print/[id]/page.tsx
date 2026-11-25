"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { 
  fetchOrder, 
  fetchOrderParts, 
  fetchCompany, 
  contentUrl, 
  type OrderPartRow, 
  type CompanyRow 
} from "@/lib/api";
import { format } from "date-fns";
import { PrintDocument, PrintNotes, PrintSection, PrintTable, PrintTotals, fmtMoney } from "@/components/print/PrintDocument";
import { 
  Loader2, 
  Printer, 
  ArrowLeft, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Clock, 
  Wrench, 
  User, 
  Gauge,
  X,
  Tag,
  ClipboardList,
  Boxes,
  Building
} from "lucide-react";

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
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params?.id;
  const auto = searchParams?.get("autoprint") === "1";

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [parts, setParts] = useState<OrderPartRow[]>([]);
  const [company, setCompany] = useState<CompanyRow | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const [o, p, c] = await Promise.all([
          fetchOrder(String(id)),
          fetchOrderParts(String(id)),
          fetchCompany().catch(() => null)
        ]);
        setOrder(o);
        setParts(Array.isArray(p) ? p : []);
        setCompany(c);
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
      priority: String(o.priority || "Medium"),
      status: String(o.status || "Completed"),
      createdAt: String(o.created_at || ""),
      expectedAt: String(o.expected_time || ""),
      completedAt: String(o.completed_at || ""),
      problem: String(o.problem_description || ""),
      comments: String(o.comments || ""),
      bay: String(o.location || ""),
      technician: String(o.technician || ""),
      locationName: String(o.location_name || ""),
      locationAddress: String(o.location_address || ""),
      locationPhone: String(o.location_phone || ""),
      locationTaxNo: String(o.location_tax_no || ""),
      completionComments: String(o.completion_comments || ""),
      departmentName: String(o.department_name || ""),
      checklistDone: safeChecklistDone(o.checklist_done_json),
      jobType: String(o.job_type || "Running Repair"),
    };
  }, [order, id]);

  const total = useMemo(() => {
    return parts.reduce((sum, l) => sum + (l.line_total ? Number(l.line_total) : 0), 0);
  }, [parts]);

  const when = (d: string) => (d ? format(new Date(d), "d MMM yyyy, HH:mm") : "–");

  return (
    <PrintDocument
      title="Service Completion Report"
      number={order ? `RO-${data.id}` : undefined}
      loading={loading}
      error={!loading && !order ? "Order not found." : null}
      ready={!!order}
      autoPrint={auto}
      company={company}
      meta={order ? [
        ["Vehicle", [data.vehicleModel, data.vehicleIdentifier].filter(Boolean).join(" · ") || "–"],
        ["Department", data.departmentName || "–"],
        ["Mileage", data.mileage ? `${Number(data.mileage).toLocaleString()} km` : "–"],
        ["Bay / location", [data.bay, data.locationName].filter(Boolean).join(" · ") || "–"],
        ["Opened", when(data.createdAt)],
        ["Completed", when(data.completedAt)],
        ["Technician", data.technician || "–"],
        ["Job type", `${data.jobType} · ${data.status}`],
      ] : []}
      signatures={["Service advisor", "Quality inspection", "Customer"]}
    >
      <PrintNotes label="Service request">{data.problem || "General inspection and repair"}</PrintNotes>

      {data.checklistDone.length > 0 && (
        <PrintSection title="Work checklist">
          <PrintTable
            columns={[
              { key: "task", label: "Task", width: "60mm" },
              { key: "note", label: "Remarks" },
              { key: "status", label: "Status", align: "center", width: "22mm" },
            ]}
            rows={data.checklistDone.map(c => ({ task: c.item, note: c.comment || "–", status: c.checked ? "Done" : "Pending" }))}
          />
        </PrintSection>
      )}

      {parts.length > 0 && (
        <PrintSection title="Parts used">
          <PrintTable
            columns={[
              { key: "item", label: "Item" },
              { key: "qty", label: "Qty", align: "right", width: "16mm" },
              { key: "price", label: "Unit price", align: "right", width: "28mm" },
              { key: "amt", label: "Amount", align: "right", width: "30mm" },
            ]}
            rows={parts.map(p => ({ item: p.part_name, qty: p.quantity, price: fmtMoney(p.unit_price), amt: fmtMoney(p.line_total) }))}
          />
          <PrintTotals lines={[{ label: "Total parts", value: fmtMoney(total), grand: true }]} />
        </PrintSection>
      )}

      {data.completionComments ? <PrintNotes label="Final remarks">{data.completionComments}</PrintNotes> : null}
    </PrintDocument>
  );
}
