"use client";

import {
  LayoutDashboard,
  ClipboardList,
  PlusCircle,
  BarChart3,
  PlayCircle,
  CheckCircle2,
  Grid,
  Car,
  Tag,
  Layers,
  Users,
  Tags,
  CheckSquare,
  Boxes,
  Truck,
  FileText,
  PackageCheck,
  ArrowLeftRight,
  History,
  ClipboardList as ClipboardListIcon,
  Shield,
  Database,
  Settings,
  Percent,
} from "lucide-react";

export type NavItem = {
  icon: any;
  label: string;
  href: string;
  perm?: string;
};

export const mainNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: ClipboardList, label: "Order Queue", href: "/orders", perm: "orders.read" },
  { icon: PlayCircle, label: "Active Jobs", href: "/orders/active", perm: "orders.read" },
  { icon: CheckCircle2, label: "Completed Orders", href: "/orders/completed", perm: "orders.read" },
  { icon: PlusCircle, label: "Create Order", href: "/orders/new", perm: "orders.write" },
  { icon: Grid, label: "Bays Board", href: "/dashboard/bays", perm: "bays.read" },
  { icon: BarChart3, label: "Reports", href: "/reports", perm: "reports.read" },
];

export const masterDataItems: NavItem[] = [
  { icon: Car, label: "Vehicles", href: "/master-data/vehicles", perm: "vehicles.read" },
  { icon: Tag, label: "Brands", href: "/master-data/brands", perm: "brands.read" },
  { icon: Percent, label: "Taxes", href: "/master-data/taxes", perm: "taxes.read" },
  { icon: Tag, label: "Vehicle Makes", href: "/master-data/makes", perm: "makes.read" },
  { icon: Layers, label: "Vehicle Models", href: "/master-data/models", perm: "models.read" },
  { icon: Users, label: "Technicians", href: "/master-data/technicians", perm: "technicians.read" },
  { icon: Grid, label: "Service Bays", href: "/master-data/bays", perm: "bays.read" },
  { icon: Grid, label: "Departments", href: "/master-data/departments", perm: "departments.read" },
  { icon: Tags, label: "Units", href: "/master-data/units", perm: "units.read" },
  { icon: Tags, label: "Repair Categories", href: "/master-data/categories", perm: "categories.read" },
  { icon: CheckSquare, label: "Checklist Items", href: "/master-data/checklists", perm: "checklists.read" },
];

export const inventoryItems: NavItem[] = [
  { icon: Boxes, label: "Items", href: "/inventory/items", perm: "parts.read" },
  { icon: Truck, label: "Suppliers", href: "/inventory/suppliers", perm: "suppliers.read" },
  { icon: FileText, label: "Purchase Orders", href: "/inventory/purchase-orders", perm: "purchase.read" },
  { icon: PackageCheck, label: "GRN", href: "/inventory/grn", perm: "grn.read" },
  { icon: ClipboardListIcon, label: "Stock Requests", href: "/inventory/stock-requests", perm: "transfer.read" },
  { icon: ArrowLeftRight, label: "Stock Transfers", href: "/inventory/transfers", perm: "transfer.read" },
  { icon: History, label: "Stock", href: "/inventory/stock", perm: "stock.read" },
  { icon: ArrowLeftRight, label: "Stock Adjustments", href: "/inventory/stock/adjustments", perm: "stock.read" },
];

export const adminNavItems: NavItem[] = [
  { icon: Shield, label: "RBAC", href: "/admin/rbac" },
  { icon: Users, label: "Users", href: "/admin/users" },
  { icon: Database, label: "Locations", href: "/admin/locations" },
  { icon: Settings, label: "Company", href: "/admin/company" },
];
