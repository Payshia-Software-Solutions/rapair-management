"use client"

import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { adminFetchUserLocations, adminFetchUsers, adminSetUserActive, adminSetUserLocations, adminSetUserLocation, adminSetUserRole, fetchLocations, rbacFetchRoles } from "@/lib/api";
import { Loader2, Users } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type UserRow = {
  id: number;
  name: string;
  email: string;
  role_id: number;
  role: string;
  location_id: number;
  location_name: string;
  allowed_locations?: string | null;
  allowed_location_ids?: string | null;
  is_active?: number | null;
  created_at: string;
};

type RoleRow = { id: number; name: string; created_at: string };
type LocationRow = { id: number; name: string };

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [isLocDialogOpen, setIsLocDialogOpen] = useState(false);
  const [locDialogUser, setLocDialogUser] = useState<UserRow | null>(null);
  const [locDialogIds, setLocDialogIds] = useState<number[]>([]);
  const [locDialogLoading, setLocDialogLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [u, r, l] = await Promise.all([adminFetchUsers(), rbacFetchRoles(), fetchLocations()]);
      setUsers(u);
      setRoles(r);
      setLocations(l);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const filtered = useMemo(() => {
    let list = users;
    
    // Status Filter
    if (statusFilter === "active") list = list.filter(u => (u.is_active ?? 1) === 1);
    if (statusFilter === "inactive") list = list.filter(u => (u.is_active ?? 1) === 0);

    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((u) =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      (u.allowed_locations ?? "").toLowerCase().includes(q)
    );
  }, [users, query, statusFilter]);

  const setRole = async (userId: number, roleId: number) => {
    setSavingUserId(userId);
    try {
      await adminSetUserRole(String(userId), roleId);
      const roleName = roles.find((r) => r.id === roleId)?.name ?? "";
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role_id: roleId, role: roleName } : u))
      );
      toast({ title: "Updated", description: "User role updated" });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSavingUserId(null);
    }
  };

  const setLocation = async (userId: number, locationId: number) => {
    setSavingUserId(userId);
    try {
      await adminSetUserLocation(String(userId), locationId);
      const locationName = locations.find((l) => l.id === locationId)?.name ?? "";
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, location_id: locationId, location_name: locationName } : u))
      );
      toast({ title: "Updated", description: "User location updated" });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSavingUserId(null);
    }
  };

  const setActive = async (userId: number, active: boolean) => {
    setSavingUserId(userId);
    try {
      await adminSetUserActive(String(userId), active);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_active: active ? 1 : 0 } : u)));
      toast({ title: "Updated", description: active ? "User activated" : "User deactivated" });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSavingUserId(null);
    }
  };

  const openLocationsDialog = async (user: UserRow) => {
    setLocDialogUser(user);
    setIsLocDialogOpen(true);
    setLocDialogLoading(true);
    try {
      const ids = await adminFetchUserLocations(String(user.id));
      setLocDialogIds(Array.isArray(ids) ? ids : []);
    } catch (err) {
      setLocDialogIds([]);
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLocDialogLoading(false);
    }
  };

  const toggleDialogLocation = (locationId: number, checked: boolean) => {
    setLocDialogIds((prev) => {
      const set = new Set(prev);
      if (checked) set.add(locationId);
      else set.delete(locationId);
      return Array.from(set.values()).sort((a, b) => a - b);
    });
  };

  const saveDialogLocations = async () => {
    if (!locDialogUser) return;
    setLocDialogLoading(true);
    try {
      await adminSetUserLocations(String(locDialogUser.id), locDialogIds);
      toast({ title: "Updated", description: "Allowed locations updated" });
      setIsLocDialogOpen(false);
      setLocDialogUser(null);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLocDialogLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Users
          </h1>
          <p className="text-muted-foreground mt-1">Admin-only user role assignment</p>
        </div>
        <Badge variant="outline" className="px-3 py-1 bg-primary/5 border-primary/20 text-primary">
          {users.length} Users
        </Badge>
      </div>

      <Card className="border-none shadow-md overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-lg">Directory</CardTitle>
          <CardDescription>Search users and assign roles</CardDescription>
          <div className="pt-3 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Input
                placeholder="Search by name, email, or role..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading users...</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[80px]">ID</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Allowed Locations</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => {
                  const isActive = (u.is_active ?? 1) === 1;
                  return (
                    <TableRow key={u.id} className={`hover:bg-muted/10 transition-opacity ${!isActive ? 'opacity-60 bg-muted/5' : ''}`}>
                      <TableCell className="font-mono text-xs font-bold">#{u.id}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold">{u.name}</span>
                          {!isActive && <span className="text-[10px] text-destructive font-bold uppercase tracking-wider">Deactivated</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          <Select
                            value={String(u.role_id)}
                            onValueChange={(v) => void setRole(u.id, Number(v))}
                            disabled={savingUserId === u.id}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {roles.map((r) => (
                                <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          <Select
                            value={String(u.location_id)}
                            onValueChange={(v) => void setLocation(u.id, Number(v))}
                            disabled={savingUserId === u.id || locations.length === 0}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {locations.map((l) => (
                                <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-between gap-3">
                          <div
                            className="text-xs text-muted-foreground max-w-[240px] truncate"
                            title={u.allowed_locations ?? ""}
                          >
                            {u.allowed_locations ? u.allowed_locations : "-"}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void openLocationsDialog(u)}
                            disabled={savingUserId === u.id || locations.length === 0}
                          >
                            Assign
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center">
                          <Switch
                            checked={(u.is_active ?? 1) === 1}
                            onCheckedChange={(v) => void setActive(u.id, Boolean(v))}
                            disabled={savingUserId === u.id || u.email === "admin@local"}
                            aria-label="Active"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={savingUserId === u.id}
                          onClick={() => void load()}
                        >
                          {savingUserId === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isLocDialogOpen} onOpenChange={(v) => {
        setIsLocDialogOpen(v);
        if (!v) {
          setLocDialogUser(null);
          setLocDialogIds([]);
        }
      }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Assign Locations</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {locDialogUser ? (
                <>
                  Select which service locations <span className="font-semibold text-foreground">{locDialogUser.name}</span> can view.
                </>
              ) : null}
            </div>

            {locDialogLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="rounded-lg border p-3 max-h-[280px] overflow-auto space-y-2">
                {locations.map((l) => {
                  const checked = locDialogIds.includes(l.id);
                  return (
                    <div key={l.id} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/20">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => toggleDialogLocation(l.id, Boolean(v))}
                          id={`loc-${l.id}`}
                        />
                        <Label htmlFor={`loc-${l.id}`} className="cursor-pointer">
                          {l.name}
                        </Label>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">#{l.id}</span>
                    </div>
                  );
                })}
                {locations.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-2">No locations available.</div>
                ) : null}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsLocDialogOpen(false)} disabled={locDialogLoading}>
              Cancel
            </Button>
            <Button onClick={() => void saveDialogLocations()} disabled={locDialogLoading || locDialogIds.length === 0}>
              {locDialogLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
