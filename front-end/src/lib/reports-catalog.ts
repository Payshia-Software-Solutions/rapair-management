import type React from "react";
import {
  Activity, AlertTriangle, ArrowLeftRight, BarChart3, Boxes, Car, Clock, FileText, Filter,
  MapPin, Percent, Receipt, ShoppingCart, TrendingUp, Users,
} from "lucide-react";

/**
 * Every report, grouped. The Reports hub and the sidebar's Reports section both read this,
 * so a new report only needs adding here. `module` = SaaS module that must be licensed.
 */
export type ReportLink = { title: string; desc: string; href: string; icon: React.ComponentType<{ className?: string }> };
export type ReportGroup = { id: string; label: string; icon: React.ComponentType<{ className?: string }>; module: string | null; items: ReportLink[] };

export const REPORT_GROUPS: ReportGroup[] = [
  {
    id: "sales", label: "Sales", icon: TrendingUp, module: "sales", items: [
      { title: "Sale Summary", desc: "Daily or monthly sales totals", href: "/reports/sales/summary", icon: TrendingUp },
      { title: "Day End Report", desc: "Everything for one trading day", href: "/reports/sales/day-end", icon: Clock },
      { title: "Invoice Report", desc: "Invoices with status and totals", href: "/reports/sales/invoices", icon: FileText },
      { title: "Payment Receipts", desc: "Receipts by payment method", href: "/reports/sales/receipts", icon: Receipt },
      { title: "Customer Statement", desc: "Invoices, payments and running balance for a customer", href: "/reports/sales/statement", icon: FileText },
      { title: "Receivables Aging", desc: "Outstanding balances by age (0–30, 31–60 days…)", href: "/reports/sales/aging", icon: AlertTriangle },
      { title: "Credit Sale Summary", desc: "Outstanding balances and days on credit", href: "/reports/sales/credit-summary", icon: TrendingUp },
      { title: "Location Sales", desc: "Sales by location", href: "/reports/sales/locations", icon: MapPin },
      { title: "Customer Sales", desc: "Sales totals per customer", href: "/reports/sales/customers", icon: Users },
      { title: "Top Selling Items", desc: "Best sellers by quantity and revenue", href: "/reports/sales/top-items", icon: BarChart3 },
      { title: "Item Wise Sales", desc: "Sales detail grouped by item", href: "/reports/sales/item-wise", icon: BarChart3 },
      { title: "Cancellations", desc: "All cancelled documents", href: "/reports/sales/cancellations", icon: AlertTriangle },
      { title: "Comps & Voids", desc: "Complimentary items and items removed after KOT, with who approved them", href: "/reports/sales/comps-voids", icon: AlertTriangle },
    ],
  },
  {
    id: "tax", label: "Tax", icon: Percent, module: "sales", items: [
      { title: "Tax Report", desc: "Taxes collected, summarised", href: "/reports/sales/tax", icon: Percent },
      { title: "Tax Invoice Register", desc: "Per invoice: net, service charge and each tax, for returns and audits", href: "/reports/sales/tax-register", icon: Percent },
      { title: "Menu Pricing Tax Breakdown", desc: "Item-wise base price, service charge, TDL, SSCL and VAT", href: "/reports/sales/menu-tax", icon: Percent },
      { title: "Menu Pricing Tax by Invoice", desc: "Invoice-wise base price, service charge, TDL, SSCL and VAT", href: "/reports/sales/menu-tax-invoices", icon: Percent },
    ],
  },
  {
    id: "accounting", label: "Accounting", icon: Receipt, module: "accounting", items: [
      { title: "Profit & Loss", desc: "Income statement with period, branch and monthly-trend compare", href: "/accounting/statements?tab=pnl", icon: TrendingUp },
      { title: "Expenses by Category", desc: "Paid expenses per expense account, with compare", href: "/reports/expenses", icon: Receipt },
    ],
  },
  {
    id: "inventory", label: "Stock", icon: Boxes, module: "inventory", items: [
      { title: "Stock Balance", desc: "Item balances, all or by location", href: "/reports/stock-balance", icon: Boxes },
      { title: "Low Stock", desc: "Items at or below reorder level", href: "/reports/low-stock", icon: AlertTriangle },
      { title: "Item Movements", desc: "Every movement of one item (GRN, adjustment, transfer, issue)", href: "/reports/item-movements", icon: Activity },
      { title: "Stock Transfers", desc: "Transfer requests and fulfilment", href: "/reports/stock-transfers", icon: ArrowLeftRight },
      { title: "Material Issues Summary", desc: "Stock issued on issue notes in a period", href: "/reports/material-issues-summary", icon: FileText },
      { title: "BOM Stock Consumption", desc: "Expected material use from sales and recipes", href: "/reports/bom-consumption", icon: Activity },
      { title: "Item Master", desc: "Items filtered by brand, supplier or status", href: "/reports/items", icon: Filter },
    ],
  },
  {
    id: "purchasing", label: "Purchasing", icon: ShoppingCart, module: "vendors", items: [
      { title: "Purchase Orders", desc: "Purchase orders and their status", href: "/reports/purchase-orders", icon: FileText },
      { title: "GRN Summary", desc: "Goods received notes", href: "/reports/grn", icon: FileText },
    ],
  },
  {
    id: "fleet", label: "Vehicles", icon: Car, module: "fleet", items: [
      { title: "Vehicles", desc: "Vehicle register", href: "/reports/vehicles", icon: Car },
      { title: "Maintenance History", desc: "Job history for a vehicle", href: "/reports/maintenance-history", icon: FileText },
      { title: "Upcoming Services", desc: "Vehicles due for service", href: "/reports/vehicles/upcoming", icon: Clock },
    ],
  },
];
