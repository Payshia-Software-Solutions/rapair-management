"use client"

import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  rbacCreateRole,
  rbacDeleteRole,
  rbacFetchPermissions,
  rbacFetchRolePermissions,
  rbacFetchRoles,
  rbacSetRolePermissions,
} from "@/lib/api";
import { Loader2, Plus, Shield, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type RoleRow = { id: number; name: string; created_at: string };
type PermRow = { id: number; perm_key: string; description: string | null };

type PermMatrixRow = { module: string; page: string; read: string; write?: string };

const basePagePermissionMatrix: PermMatrixRow[] = [
  // Service Center
  { module: "Service Center", page: "Orders (Queue / Dashboard)", read: "orders.read", write: "orders.write" },
  { module: "Service Center", page: "Active Jobs & Completed", read: "orders.read", write: "orders.write" },
  { module: "Service Center", page: "Service Bays & Board", read: "bays.read", write: "bays.write" },
  { module: "Service Center", page: "Technicians Management", read: "technicians.read", write: "technicians.write" },
  { module: "Service Center", page: "Vehicles List & History", read: "vehicles.read", write: "vehicles.write" },
  { module: "Service Center", page: "Repair Categories", read: "categories.read", write: "categories.write" },
  { module: "Service Center", page: "Checklist Repository", read: "checklists.read", write: "checklists.write" },

  // Inventory & Vendors
  { module: "Inventory", page: "Item Master (Parts/Products)", read: "parts.read", write: "parts.write" },
  { module: "Inventory", page: "Stock Balance & Movements", read: "stock.read", write: "stock.adjust" },
  { module: "Inventory", page: "Stock Adjustments", read: "stock.read", write: "stock.adjust" },
  { module: "Inventory", page: "Purchase Orders", read: "purchase.read", write: "purchase.write" },
  { module: "Inventory", page: "Goods Receive Note (GRN)", read: "grn.read", write: "grn.write" },
  { module: "Inventory", page: "Supplier Management", read: "suppliers.read", write: "suppliers.write" },
  { module: "Inventory", page: "Vendor Payments & Vouchers", read: "suppliers.read", write: "accounting.write" },
  { module: "Inventory", page: "Supplier Returns", read: "suppliers.read", write: "suppliers.write" },
  { module: "Inventory", page: "Stock Requisitions & Transfers", read: "transfer.read", write: "transfer.write" },

  // Sales & CRM
  { module: "Sales & CRM", page: "Customer 360 (Profiles)", read: "customers.read", write: "customers.write" },
  { module: "Sales & CRM", page: "Customer Vehicles", read: "vehicles.read", write: "vehicles.write" },
  { module: "Sales & CRM", page: "Quotations (Create / Manage)", read: "sales.read", write: "sales.create" },
  { module: "Sales & CRM", page: "Quotations (Update Status)", read: "sales.read", write: "sales.update" },
  { module: "Sales & CRM", page: "Invoices & Online Orders", read: "invoices.read", write: "invoices.write" },
  { module: "Sales & CRM", page: "POS (Point of Sale)", read: "pos.read", write: "pos.write" },
  { module: "Sales & CRM", page: "Online Orders Dashboard", read: "invoices.read", write: "invoices.write" },
  { module: "Sales & CRM", page: "Payment Receipts History", read: "payments.read", write: "payments.write" },
  { module: "Sales & CRM", page: "Cheque Inventory Tracking", read: "payments.read", write: "payments.write" },
  { module: "Sales & CRM", page: "Sales Returns & Refunds", read: "sales.read", write: "sales.write" },

  // Accounting
  { module: "Accounting", page: "Financial Dashboard", read: "accounting.read" },
  { module: "Accounting", page: "Chart of Accounts", read: "accounting.read", write: "accounting.write" },
  { module: "Accounting", page: "Journal Entries", read: "accounting.read", write: "accounting.write" },
  { module: "Accounting", page: "Expense Management", read: "accounting.read", write: "accounting.write" },
  { module: "Accounting", page: "Bank Reconciliation", read: "accounting.reconcile", write: "accounting.write" },
  { module: "Accounting", page: "Trial Balance & Trial Balance", read: "accounting.read" },
  { module: "Accounting", page: "Balance Sheet & P&L", read: "accounting.read" },
  { module: "Accounting", page: "Fiscal Years & Periods", read: "fiscal.read", write: "fiscal.write" },

  // HRM
  { module: "HRM", page: "Employee Management", read: "hrm.read", write: "hrm.write" },
  { module: "HRM", page: "Attendance Tracking", read: "hrm.read", write: "attendance.write" },
  { module: "HRM", page: "Leave Management", read: "hrm.read", write: "leave.write" },
  { module: "HRM", page: "Payroll Processing", read: "hrm.read", write: "payroll.write" },
  { module: "HRM", page: "HR Document Management", read: "hrm.read", write: "hrm.write" },
  { module: "HRM", page: "Staff Groups & Schemes", read: "hrm.read", write: "hrm.write" },

  // Production
  { module: "Production", page: "Bill of Materials (BOM)", read: "production.read", write: "production.write" },
  { module: "Production", page: "Production Orders Workflow", read: "production.read", write: "production.write" },

  // Marketing
  { module: "Marketing", page: "SMS & Email Marketing", read: "promotions.read", write: "promotions.write" },
  { module: "Marketing", page: "Audience Segments", read: "promotions.read", write: "promotions.write" },
  { module: "Marketing", page: "Promotions & Campaigns", read: "promotions.read", write: "promotions.write" },

  // Front Office
  { module: "Front Office", page: "Room Rack & Occupancy", read: "orders.read", write: "orders.write" },
  { module: "Front Office", page: "Reservations Management", read: "orders.read", write: "orders.write" },
  { module: "Front Office", page: "Room Rates & Types", read: "parts.read", write: "parts.write" },

  // Master Data
  { module: "Master Data", page: "Brands Master", read: "brands.read", write: "brands.write" },
  { module: "Master Data", page: "Vehicle Makes", read: "makes.read", write: "makes.write" },
  { module: "Master Data", page: "Vehicle Models", read: "models.read", write: "models.write" },
  { module: "Master Data", page: "Units of Measure", read: "units.read", write: "units.write" },
  { module: "Master Data", page: "Tax Configurations", read: "taxes.read", write: "taxes.write" },
  { module: "Master Data", page: "Department Master", read: "departments.read", write: "departments.write" },
  { module: "Master Data", page: "Bank Master Data", read: "banks.read", write: "banks.write" },
  { module: "Master Data", page: "Product Collections", read: "parts.read", write: "parts.write" },
  { module: "Master Data", page: "Restaurant Tables", read: "bays.read", write: "bays.write" },

  // Admin & Settings
  { module: "Admin & Settings", page: "Locations Management", read: "locations.read", write: "locations.write" },
  { module: "Admin & Settings", page: "Company & System Config", read: "company.write", write: "settings.write" },
  { module: "Admin & Settings", page: "Shipping & Logistics", read: "locations.read", write: "locations.write" },
  { module: "Admin & Settings", page: "User Management", read: "users.read", write: "users.write" },
  { module: "Admin & Settings", page: "RBAC Roles & Permissions", read: "rbac.read", write: "rbac.write" },
  { module: "Admin & Settings", page: "Reports & Analytics", read: "reports.read" },
];

export default function RbacPage() {
  const { toast } = useToast();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [perms, setPerms] = useState<PermRow[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [roleKeys, setRoleKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingRolePerms, setLoadingRolePerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [filter, setFilter] = useState("");

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) ?? null,
    [roles, selectedRoleId]
  );

  const matrixKeys = useMemo(() => {
    const s = new Set<string>();
    for (const row of basePagePermissionMatrix) {
      s.add(row.read);
      if (row.write) s.add(row.write);
    }
    return s;
  }, []);

  const pagePermissionMatrix = useMemo<PermMatrixRow[]>(() => {
    // Bring any "advanced" permission keys into the same table automatically.
    const extras = perms
      .filter((p) => !matrixKeys.has(p.perm_key))
      .map((p) => {
        // Simple heuristic: if key contains .write/create/update, it's a write permission
        const isWriteKey = p.perm_key.includes('.write') || p.perm_key.includes('.create') || p.perm_key.includes('.update');
        return { 
          module: "Other / Advanced", 
          page: p.perm_key, 
          read: isWriteKey ? (p.perm_key.split('.')[0] + '.read') : p.perm_key, 
          write: isWriteKey ? p.perm_key : undefined 
        };
      });
    return [...basePagePermissionMatrix, ...extras];
  }, [perms, matrixKeys]);

  const filteredMatrix = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return pagePermissionMatrix;
    return pagePermissionMatrix.filter((row) => {
      const hay = `${row.module} ${row.page} ${row.read} ${row.write ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [pagePermissionMatrix, filter]);

  const groupedMatrix = useMemo(() => {
    const groups: Record<string, PermMatrixRow[]> = {};
    filteredMatrix.forEach(row => {
      if (!groups[row.module]) groups[row.module] = [];
      groups[row.module].push(row);
    });
    return groups;
  }, [filteredMatrix]);

  const toggleModule = (moduleName: string, checked: boolean) => {
    const rows = groupedMatrix[moduleName];
    if (!rows) return;
    
    setRoleKeys(prev => {
      const next = new Set(prev);
      rows.forEach(row => {
        if (checked) {
          next.add(row.read);
          if (row.write) next.add(row.write);
        } else {
          next.delete(row.read);
          if (row.write) next.delete(row.write);
        }
      });
      return next;
    });
  };

  const isModuleSelected = (moduleName: string) => {
    const rows = groupedMatrix[moduleName];
    if (!rows || rows.length === 0) return false;
    return rows.every(row => roleKeys.has(row.read) && (!row.write || roleKeys.has(row.write)));
  };

  const load = async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([rbacFetchRoles(), rbacFetchPermissions()]);
      setRoles(r);
      setPerms(p);
      const firstNonAdmin = r.find((x: RoleRow) => x.name !== "Admin") ?? r[0] ?? null;
      setSelectedRoleId(firstNonAdmin ? firstNonAdmin.id : null);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadRolePerms = async (roleId: number) => {
    setLoadingRolePerms(true);
    try {
      const keys: string[] = await rbacFetchRolePermissions(String(roleId));
      setRoleKeys(new Set(keys));
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
      setRoleKeys(new Set());
    } finally {
      setLoadingRolePerms(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (selectedRoleId) void loadRolePerms(selectedRoleId);
  }, [selectedRoleId]);

  const setReadWrite = (readKey: string, writeKey: string | undefined, mode: "read" | "write", checked: boolean) => {
    setRoleKeys((prev) => {
      const next = new Set(prev);

      if (mode === "write") {
        if (!writeKey) return next;
        if (checked) {
          next.add(readKey);
          next.add(writeKey);
        } else {
          next.delete(writeKey);
        }
        return next;
      }

      // mode === "read"
      if (checked) {
        next.add(readKey);
      } else {
        // If read is removed, write must also be removed.
        next.delete(readKey);
        if (writeKey) next.delete(writeKey);
      }
      return next;
    });
  };

  const save = async () => {
    if (!selectedRoleId) return;
    setSaving(true);
    try {
      const res = await rbacSetRolePermissions(String(selectedRoleId), Array.from(roleKeys).sort());
      if (res.status !== 'success') {
        throw new Error(res.message || 'Failed to save');
      }
      await loadRolePerms(selectedRoleId);
      window.dispatchEvent(new Event('rbac:updated'));
      toast({ title: "Saved", description: "Role permissions updated" });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const createRole = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newRoleName.trim();
    if (!name) return;
    try {
      await rbacCreateRole({ name });
      toast({ title: "Created", description: "Role created" });
      setIsCreateOpen(false);
      setNewRoleName("");
      await load();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  const delRole = async (r: RoleRow) => {
    if (!confirm(`Delete role "${r.name}"?`)) return;
    try {
      await rbacDeleteRole(String(r.id));
      toast({ title: "Deleted", description: "Role deleted", variant: "destructive" });
      await load();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <DashboardLayout fullWidth>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Roles & Permissions
          </h1>
          <p className="text-muted-foreground mt-1">Admin-only RBAC configuration</p>
        </div>
        <Button className="gap-2 bg-primary" onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4" />
          New Role
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading RBAC data...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="border-none shadow-md lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Roles</CardTitle>
              <CardDescription>Select a role to edit permissions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {roles.map((r) => (
                <div
                  key={r.id}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                    selectedRoleId === r.id ? "bg-muted/40 border-primary/30" : "hover:bg-muted/20"
                  }`}
                  onClick={() => setSelectedRoleId(r.id)}
                >
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{r.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">ROLE ID: #{r.id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.name === "Admin" && <Badge variant="outline">Superuser</Badge>}
                    {r.name !== "Admin" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          void delRole(r);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-none shadow-md lg:col-span-2">
            <CardHeader>
              <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">
                    Permissions {selectedRole ? <span className="text-muted-foreground font-normal">for {selectedRole.name}</span> : null}
                  </CardTitle>
                  <CardDescription>
                    Admin role is implicit and cannot be edited.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Search permissions..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-full sm:w-[200px]"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (confirm("Clear all permissions for this role?")) setRoleKeys(new Set());
                    }}
                    disabled={!selectedRoleId || selectedRole?.name === "Admin" || saving || loadingRolePerms || roleKeys.size === 0}
                  >
                    Clear All
                  </Button>
                  <Button
                    onClick={() => void save()}
                    disabled={!selectedRoleId || selectedRole?.name === "Admin" || saving || loadingRolePerms}
                  >
                    {(saving || loadingRolePerms) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Accordion type="multiple" defaultValue={Object.keys(groupedMatrix)} className="w-full border rounded-lg overflow-hidden divide-y">
                {Object.entries(groupedMatrix).map(([moduleName, rows]) => {
                  const moduleSelected = isModuleSelected(moduleName);
                  return (
                    <AccordionItem key={moduleName} value={moduleName} className="border-none">
                      <div className="flex items-center pr-4 bg-muted/20 hover:bg-muted/40 transition-colors">
                        <AccordionTrigger className="px-4 py-3 hover:no-underline flex-1">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-sm uppercase tracking-wider">{moduleName}</span>
                            <Badge variant="secondary" className="font-mono text-[10px]">
                              {rows.length} {rows.length === 1 ? 'perm' : 'perms'}
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <div 
                          className="flex items-center gap-2 px-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox 
                            id={`select-all-${moduleName}`}
                            checked={moduleSelected}
                            disabled={selectedRole?.name === "Admin" || !selectedRoleId || loadingRolePerms || saving}
                            onCheckedChange={(v) => toggleModule(moduleName, Boolean(v))}
                          />
                          <Label 
                            htmlFor={`select-all-${moduleName}`}
                            className="text-[10px] font-bold uppercase tracking-tighter cursor-pointer text-muted-foreground whitespace-nowrap"
                          >
                            {moduleSelected ? "Unselect All" : "Select All"}
                          </Label>
                        </div>
                      </div>
                    <AccordionContent className="p-0">
                      <div className="divide-y bg-background">
                        <div className="grid grid-cols-1 sm:grid-cols-3 bg-muted/5 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b">
                          <div>Page / Resource</div>
                          <div>Read Access</div>
                          <div>Write Access</div>
                        </div>
                        {rows.map((row) => {
                          const readChecked = roleKeys.has(row.read);
                          const writeChecked = row.write ? roleKeys.has(row.write) : false;
                          const disabled = selectedRole?.name === "Admin" || !selectedRoleId || loadingRolePerms || saving;
                          return (
                            <div key={`${row.module}-${row.page}`} className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-4 py-3 items-center hover:bg-muted/5 transition-colors">
                              <div className="text-sm font-medium">{row.page}</div>
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`read-${row.read}`}
                                  checked={readChecked}
                                  disabled={disabled || writeChecked}
                                  onCheckedChange={(v) => setReadWrite(row.read, row.write, "read", Boolean(v))}
                                />
                                <Label htmlFor={`read-${row.read}`} className="text-xs cursor-pointer text-muted-foreground">Allow View</Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`write-${row.write}`}
                                  checked={writeChecked}
                                  disabled={disabled || !row.write}
                                  onCheckedChange={(v) => setReadWrite(row.read, row.write, "write", Boolean(v))}
                                />
                                <Label htmlFor={`write-${row.write}`} className="text-xs cursor-pointer text-muted-foreground">
                                  {row.write ? "Allow Edit" : "N/A"}
                                </Label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
              </Accordion>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <form onSubmit={createRole}>
            <DialogHeader>
              <DialogTitle>Create Role</DialogTitle>
              <DialogDescription>Roles are assigned by setting the user’s role at registration.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="rolename" className="text-right">Name</Label>
                <Input
                  id="rolename"
                  className="col-span-3"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g., Manager"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
