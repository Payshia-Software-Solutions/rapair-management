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

type RoleRow = { id: number; name: string; created_at: string };
type PermRow = { id: number; perm_key: string; description: string | null };

const basePagePermissionMatrix: Array<{ page: string; read: string; write?: string }> = [
  // Core workflow
  { page: "Orders (Queue / Active / Completed)", read: "orders.read", write: "orders.write" },
  { page: "Create Order", read: "orders.write" },

  // Master data
  { page: "Vehicles", read: "vehicles.read", write: "vehicles.write" },
  { page: "Vehicle Makes", read: "makes.read", write: "makes.write" },
  { page: "Vehicle Models", read: "models.read", write: "models.write" },
  { page: "Service Bays", read: "bays.read", write: "bays.write" },
  { page: "Bays Board", read: "bays.read" },
  { page: "Technicians", read: "technicians.read", write: "technicians.write" },
  { page: "Repair Categories", read: "categories.read", write: "categories.write" },
  { page: "Checklist Items", read: "checklists.read", write: "checklists.write" },
  { page: "Units", read: "units.read", write: "units.write" },
  { page: "Brands", read: "brands.read", write: "brands.write" },
  { page: "Taxes", read: "taxes.read", write: "taxes.write" },
  { page: "Departments", read: "departments.read", write: "departments.write" },

  // Locations / company
  { page: "Locations", read: "locations.read", write: "locations.write" },
  { page: "Company Details", read: "company.write" }, // view is open to authenticated users; edit is controlled by company.write

  // Inventory
  { page: "Items (Parts)", read: "parts.read", write: "parts.write" },
  { page: "Suppliers", read: "suppliers.read", write: "suppliers.write" },
  { page: "Purchase Orders", read: "purchase.read", write: "purchase.write" },
  { page: "Goods Receive Notes (GRN)", read: "grn.read", write: "grn.write" },
  { page: "Banks & Branches", read: "banks.read", write: "banks.write" },
  { page: "Stock (Balances / Movements)", read: "stock.read", write: "stock.adjust" },
  { page: "Stock Requests / Transfers", read: "transfer.read", write: "transfer.write" },

  // Reports
  { page: "Reports", read: "reports.read" },
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

  const pagePermissionMatrix = useMemo<Array<{ page: string; read: string; write?: string }>>(() => {
    // Bring any "advanced" permission keys into the same table automatically.
    const extras = perms
      .filter((p) => !matrixKeys.has(p.perm_key))
      .map((p) => ({ page: p.perm_key, read: p.perm_key as string, write: undefined }));
    return [...basePagePermissionMatrix, ...extras];
  }, [perms, matrixKeys]);

  const filteredMatrix = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return pagePermissionMatrix;
    return pagePermissionMatrix.filter((row) => {
      const hay = `${row.page} ${row.read} ${row.write ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [pagePermissionMatrix, filter]);

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

  const toggle = (key: string, checked: boolean) => {
    setRoleKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

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
              <CardTitle className="text-lg">
                Permissions {selectedRole ? <span className="text-muted-foreground font-normal">for {selectedRole.name}</span> : null}
              </CardTitle>
              <CardDescription>
                Admin role is implicit and cannot be edited.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  Choose read/write access for each page. Write implies read.
                </div>
                <Button
                  onClick={() => void save()}
                  disabled={!selectedRoleId || selectedRole?.name === "Admin" || saving || loadingRolePerms}
                >
                  {(saving || loadingRolePerms) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>

              <div className="rounded-md border overflow-hidden">
                <div className="grid grid-cols-1 sm:grid-cols-3 bg-muted/30 px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <div>Page</div>
                  <div>Read</div>
                  <div>Write</div>
                </div>
                <div className="divide-y">
                  {filteredMatrix.map((row) => {
                    const readChecked = roleKeys.has(row.read);
                    const writeChecked = row.write ? roleKeys.has(row.write) : false;
                    const disabled = selectedRole?.name === "Admin" || !selectedRoleId || loadingRolePerms || saving;
                    return (
                      <div key={row.page} className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-4 py-3 items-center">
                        <div className="font-semibold">{row.page}</div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={readChecked}
                            disabled={disabled || writeChecked}
                            onCheckedChange={(v) => setReadWrite(row.read, row.write, "read", Boolean(v))}
                          />
                          <span className="text-sm text-muted-foreground">Read</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={writeChecked}
                            disabled={disabled || !row.write}
                            onCheckedChange={(v) => setReadWrite(row.read, row.write, "write", Boolean(v))}
                          />
                          <span className="text-sm text-muted-foreground">{row.write ? "Write" : "Read only"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="text-xs text-muted-foreground">
                  Tip: use search to find a permission key quickly (e.g., <span className="font-mono">transfer</span>, <span className="font-mono">stock</span>).
                </div>
                <Input
                  placeholder="Search pages / permission keys..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="sm:max-w-sm"
                />
              </div>
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
