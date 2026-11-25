"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api, fetchCompany, type CompanyRow } from "@/lib/api";
import { PrintDocument, PrintTable, PrintTotals, fmtMoney } from "@/components/print/PrintDocument";
import { format } from "date-fns";

function PrintContent() {
  const params = useParams();
  const id = params.id as string;
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get('autoprint') === '1';

  const [order, setOrder] = useState<any>(null);
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [orderRes, companyData] = await Promise.all([
          api(`/api/fuel/get-order/${id}`).then(res => res.json()),
          fetchCompany().catch(() => null)
        ]);
        if (orderRes.status === "success") {
          setOrder(orderRes.data);
        }
        setCompany(companyData);
      } catch (error) {
        console.error("Failed to load print data", error);
      } finally {
        setLoading(false);
      }
    };
    if (id) loadData();
  }, [id]);

  return (
    <PrintDocument
      title="Fuel Order"
      number={order ? `FO-${String(order.id).padStart(4, "0")}` : undefined}
      size="A5-landscape"
      loading={loading}
      error={!loading && !order ? "Fuel order not found." : null}
      ready={!!order}
      autoPrint={autoPrint}
      company={company}
      meta={order ? [
        ["Date", format(new Date(order.created_at), "d MMM yyyy, HH:mm")],
        ["Vehicle", order.vehicle_no || "–"],
        ["Driver", order.driver_name || "–"],
        ["Odometer", order.mileage ? `${order.mileage} km` : "–"],
        ["Fuel station", order.station_name || "–"],
        ["Issued by", order.created_by_name || "–"],
      ] : []}
      signatures={["Prepared by", "Driver", "Authorized by"]}
    >
      <PrintTable
        columns={[
          { key: "fuel", label: "Fuel" },
          { key: "litres", label: "Litres", align: "right", width: "24mm" },
          { key: "price", label: "Price / litre", align: "right", width: "30mm" },
          { key: "total", label: "Amount (LKR)", align: "right", width: "32mm" },
        ]}
        rows={order ? [{ fuel: order.fuel_type_name || "–", litres: `${order.liters} L`, price: fmtMoney(order.price_per_liter), total: fmtMoney(order.total_cost) }] : []}
      />
      <PrintTotals lines={[{ label: "Total", value: fmtMoney(order?.total_cost), grand: true }]} />
    </PrintDocument>
  );
}

export default function PrintOrderPage() {
  return (
    <Suspense fallback={null}>
      <PrintContent />
    </Suspense>
  );
}
