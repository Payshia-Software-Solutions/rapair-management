"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ShoppingCart, Search, MoreHorizontal, Clock, CreditCard, FileText, Eye, RefreshCw, TrendingUp, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader, StatCard, LoadingState, EmptyState } from "@/components/page-shell";
import { format } from "date-fns";
import { fetchOnlineOrders } from "@/lib/api";

const ORDER_STYLE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  processing: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  shipped: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-red-500/15 text-red-700 dark:text-red-300",
};
const money = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const when = (d: any) => { try { return format(new Date(d), "dd MMM yyyy, hh:mm a"); } catch { return "—"; } };

export default function OnlineOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchOnlineOrders();
      const data = res.status === "success" ? res.data : [];
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch orders", err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const statuses = useMemo(() => Array.from(new Set(orders.map(o => String(o.order_status || "")).filter(Boolean))), [orders]);
  const paidTotal = orders.filter(o => String(o.payment_status).toLowerCase() === "paid").reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const avg = orders.length ? orders.reduce((s, o) => s + Number(o.total_amount || 0), 0) / orders.length : 0;

  const shown = orders.filter(o => {
    const q = searchTerm.toLowerCase();
    const matchQ = !q || [o.order_no, o.customer_name, o.location_name].some(v => String(v || "").toLowerCase().includes(q));
    return matchQ && (status === "all" || o.order_status === status);
  });

  const open = (id: any) => router.push(`/ecommerce/orders/view/${id}`);

  return (
    <DashboardLayout>
      <div className="space-y-5 w-full">
        <PageHeader
          title="Online orders"
          description="Orders from your web store. Open one to see details, or turn it into an invoice."
          actions={<Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>}
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Orders" value={orders.length} icon={<ShoppingCart className="w-4 h-4" />} />
          <StatCard label="Waiting to fulfil" value={orders.filter(o => String(o.order_status).toLowerCase() === "pending").length} icon={<Clock className="w-4 h-4" />} />
          <StatCard label="Paid (LKR)" value={money(paidTotal)} icon={<CreditCard className="w-4 h-4" />} />
          <StatCard label="Average order (LKR)" value={money(avg)} icon={<TrendingUp className="w-4 h-4" />} />
        </div>

        <Card className="p-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search order no., customer or location" className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          {statuses.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {["all", ...statuses].map(s => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={`h-8 px-3 rounded-full border text-sm ${status === s ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
                  {s === "all" ? "All" : s}
                  <span className="ml-1 tabular-nums opacity-70">{s === "all" ? orders.length : orders.filter(o => o.order_status === s).length}</span>
                </button>
              ))}
            </div>
          )}
        </Card>

        {loading ? (
          <LoadingState label="Loading orders…" />
        ) : shown.length === 0 ? (
          <EmptyState title={orders.length ? "No orders match" : "No online orders yet"} description={orders.length ? "Try another search or status." : "Orders placed on your web store appear here."} />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr className="text-left">
                    <th className="px-4 py-2.5 font-medium">Order</th>
                    <th className="px-4 py-2.5 font-medium">Customer</th>
                    <th className="px-4 py-2.5 font-medium hidden md:table-cell">Placed</th>
                    <th className="px-4 py-2.5 font-medium">Payment</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium text-right hidden lg:table-cell">Shipping</th>
                    <th className="px-4 py-2.5 font-medium text-right">Total (LKR)</th>
                    <th className="px-2 py-2.5 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {shown.map(order => {
                    const paid = String(order.payment_status).toLowerCase() === "paid";
                    return (
                      <tr key={order.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => open(order.id)}>
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{order.order_no}</td>
                        <td className="px-4 py-3">
                          <div>{order.customer_name}</div>
                          {order.location_name && <div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{order.location_name}</div>}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell whitespace-nowrap text-muted-foreground">{when(order.created_at)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge variant="outline" className={`border-transparent ${paid ? ORDER_STYLE.completed : "bg-muted text-muted-foreground"}`}>{order.payment_status}</Badge>
                          <div className="text-xs text-muted-foreground mt-0.5">{order.payment_method === "IPG" ? "Card" : order.payment_method}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`border-transparent ${ORDER_STYLE[String(order.order_status).toLowerCase()] || "bg-muted text-muted-foreground"}`}>{order.order_status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground hidden lg:table-cell">{money(order.shipping_fee)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">{money(order.total_amount)}</td>
                        <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Actions"><MoreHorizontal className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem onClick={() => open(order.id)}><Eye className="w-4 h-4 mr-2" /> Open order</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => router.push(`/cms/invoices/create/online/${order.id}`)}><FileText className="w-4 h-4 mr-2" /> Create invoice</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t px-4 py-2.5 text-sm text-muted-foreground">{shown.length} of {orders.length} orders</div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
