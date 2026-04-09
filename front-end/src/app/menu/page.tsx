"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ChevronRight, LogOut, MapPin, User } from "lucide-react";
import { api } from "@/lib/api";
import { adminNavItems, inventoryItems, mainNavItems, masterDataItems, type NavItem } from "@/lib/nav-items";

function decodeJwtPayload(token: string): any | null {
  try {
    const part = token.split(".")[1];
    return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

export default function MenuPage() {
  const router = useRouter();
  const [permissionKeys, setPermissionKeys] = useState<string[] | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");
  const [locationName, setLocationName] = useState<string>("");

  useEffect(() => {
    const token = window.localStorage.getItem("auth_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    const payload = decodeJwtPayload(token);
    setUserName(String(payload?.name ?? ""));
    setUserRole(String(payload?.role ?? ""));
    setLocationName(String(window.localStorage.getItem("location_name") ?? payload?.location_name ?? ""));

    void (async () => {
      try {
        const res = await api("/api/auth/permissions");
        const data = await res.json();
        if (data.status === "success" && Array.isArray(data.data)) setPermissionKeys(data.data);
        else setPermissionKeys([]);
      } catch {
        setPermissionKeys([]);
      }
    })();
  }, [router]);

  const initials = useMemo(() => {
    const parts = (userName || "").trim().split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? "U";
    const b = parts[1]?.[0] ?? "";
    return (a + b).toUpperCase();
  }, [userName]);

  const hasPerm = (perm?: string) => {
    if (!perm) return true;
    if (!permissionKeys) return true; // fast paint, then filter
    if (permissionKeys.includes("*")) return true;
    return permissionKeys.includes(perm);
  };

  const sections = useMemo(() => {
    const core = mainNavItems.filter((it) => hasPerm(it.perm));
    const inv = inventoryItems.filter((it) => hasPerm(it.perm));
    const master = masterDataItems.filter((it) => hasPerm(it.perm));
    const admin = userRole === "Admin" ? adminNavItems.filter((it) => hasPerm(it.perm)) : [];

    return [
      { title: "Core", tone: "bg-blue-600", items: core },
      { title: "Inventory", tone: "bg-emerald-600", items: inv },
      { title: "Master Data", tone: "bg-indigo-600", items: master },
      { title: "Administration", tone: "bg-slate-700", items: admin },
    ].filter((s) => s.items.length > 0);
  }, [permissionKeys, userRole]);

  const handleLogout = () => {
    window.localStorage.removeItem("auth_token");
    window.localStorage.removeItem("location_id");
    window.localStorage.removeItem("location_name");
    window.location.href = "/login";
  };

  const openLocationSwitcher = () => {
    window.location.href = "/select-location?return=%2Fdashboard";
  };

  const subtitle = `${userRole || "-"}${locationName ? ` - ${locationName}` : ""}`;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6 pb-8">
        <Link href="/profile">
          <Card className="border-none shadow-sm hover:shadow-md transition-shadow overflow-hidden bg-primary text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border-2 border-white/20">
                    <AvatarImage src="https://picsum.photos/seed/user/64/64" />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-xl font-bold">{userName || "User"}</h2>
                    <p className="text-white/70 text-sm">{subtitle}</p>
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 text-white/50" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="h-12 rounded-xl justify-start gap-2" onClick={openLocationSwitcher}>
            <MapPin className="w-4 h-4" />
            Switch Location
          </Button>
          <Button variant="outline" className="h-12 rounded-xl justify-start gap-2" asChild>
            <Link href="/profile">
              <User className="w-4 h-4" />
              Profile
            </Link>
          </Button>
        </div>

        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.title} className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">{section.title}</h3>
              <div className="grid grid-cols-2 gap-3">
                {section.items.map((item: NavItem) => (
                  <Link key={item.href} href={item.href}>
                    <Card className="border-none shadow-sm hover:bg-muted/50 transition-colors h-full">
                      <CardContent className="p-4 flex flex-col items-start gap-3">
                        <div className={`p-2 rounded-lg text-white ${section.tone}`}>
                          <item.icon className="w-5 h-5" />
                        </div>
                        <span className="font-semibold text-sm">{item.label}</span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3 pt-2">
          <Button variant="destructive" className="w-full h-12 rounded-xl font-bold gap-2 shadow-lg shadow-destructive/10" onClick={handleLogout}>
            <LogOut className="w-5 h-5" />
            Sign Out
          </Button>
          <p className="text-center text-[10px] text-muted-foreground uppercase tracking-widest font-bold">ServiceBay</p>
        </div>
      </div>
    </DashboardLayout>
  );
}

