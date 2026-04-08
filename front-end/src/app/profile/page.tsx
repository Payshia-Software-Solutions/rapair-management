"use client"

import React, { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { LogOut, Mail, Shield, UserCircle, Briefcase } from "lucide-react";

type Me = {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
};

export default function ProfilePage() {
  const { toast } = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [perms, setPerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [meRes, pRes] = await Promise.all([
          api("/api/auth/me"),
          api("/api/auth/permissions"),
        ]);
        const meJson = await meRes.json();
        const pJson = await pRes.json();
        if (meJson.status !== "success") throw new Error(meJson?.message || "Failed to load profile");
        if (pJson.status !== "success") throw new Error(pJson?.message || "Failed to load permissions");
        setMe(meJson.data);
        setPerms(pJson.data || []);

        // Keep legacy prototype checks in sync with real user role.
        window.localStorage.setItem("userRole", meJson.data.role);
      } catch (err) {
        toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const initials = useMemo(() => {
    const name = me?.name || "";
    const parts = name.split(" ").filter(Boolean);
    const a = parts[0]?.[0] || "U";
    const b = parts[1]?.[0] || "";
    return (a + b).toUpperCase();
  }, [me?.name]);

  const logout = () => {
    window.localStorage.removeItem("auth_token");
    window.location.href = "/login";
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex flex-col items-center text-center space-y-3 py-6">
          <div className="relative">
            <Avatar className="h-24 w-24 border-4 border-white shadow-xl">
              <AvatarImage src="https://picsum.photos/seed/user/96/96" />
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="absolute bottom-1 right-1 p-1.5 bg-accent rounded-full border-2 border-white shadow-sm">
              <Shield className="w-4 h-4 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{me?.name || (loading ? "Loading..." : "Unknown User")}</h1>
            <div className="mt-1 flex items-center justify-center gap-2">
              {me?.role ? (
                <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary">
                  {me.role}
                </Badge>
              ) : null}
              <p className="text-muted-foreground text-sm font-medium">{me?.email || ""}</p>
            </div>
          </div>
        </div>

        <Card className="border-none shadow-md overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-primary" />
              Account
            </CardTitle>
            <CardDescription>Live user data from JWT session</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg text-primary">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Email</p>
                  <p className="text-sm font-semibold">{me?.email || "-"}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 rounded-lg text-amber-700">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Role</p>
                  <p className="text-sm font-semibold">{me?.role || "-"}</p>
                </div>
              </div>
            </div>

            <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-muted/20">
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Permissions</p>
                <p className="text-xs text-muted-foreground">Role-based access is enforced on the API. Register/login with a different role to simulate access.</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                {(perms.length ? perms : ["(none)"]).slice(0, 12).map((p) => (
                  <Badge key={p} variant="outline" className="text-[10px]">
                    {p}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex items-center justify-end">
            <Button variant="destructive" className="gap-2" onClick={logout}>
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </CardFooter>
        </Card>
      </div>
    </DashboardLayout>
  );
}
