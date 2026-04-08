"use client"

import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { adminFetchUsers, adminSetUserRole, rbacFetchRoles } from "@/lib/api";
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
  created_at: string;
};

type RoleRow = { id: number; name: string; created_at: string };

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([adminFetchUsers(), rbacFetchRoles()]);
      setUsers(u);
      setRoles(r);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  }, [users, query]);

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
          <div className="pt-3">
            <Input
              placeholder="Search by name, email, or role..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
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
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.id} className="hover:bg-muted/10">
                    <TableCell className="font-mono text-xs font-bold">#{u.id}</TableCell>
                    <TableCell className="font-semibold">{u.name}</TableCell>
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
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

