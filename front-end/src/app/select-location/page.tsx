"use client"

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin, ArrowRight } from "lucide-react";
import { fetchLocations, type ServiceLocationRow } from "@/lib/api";

type AllowedLocation = { id: number; name: string };

function decodeJwtPayload(token: string): any | null {
  try {
    const part = token.split(".")[1];
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return json;
  } catch {
    return null;
  }
}

export default function SelectLocationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<AllowedLocation[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    const token = window.localStorage.getItem("auth_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    const payload = decodeJwtPayload(token);
    const role = String(payload?.role ?? "").toLowerCase();
    const allowed: AllowedLocation[] = Array.isArray(payload?.allowed_locations)
      ? payload.allowed_locations
          .map((x: any) => ({ id: Number(x?.id), name: String(x?.name ?? "") }))
          .filter((x: AllowedLocation) => x.id > 0 && x.name)
      : [];

    const fallbackId = payload?.location_id ? Number(payload.location_id) : 1;
    const fallbackName = payload?.location_name ? String(payload.location_name) : "-";

    const setFromList = (list: AllowedLocation[]) => {
      if (list.length === 0 && !fallbackId) {
          setLocations([]);
          setLoading(false);
          return;
      }
      const finalAllowed = list.length > 0 ? list : [{ id: fallbackId, name: fallbackName }];
      setLocations(finalAllowed);
      const pre = finalAllowed.find((l) => l.id === fallbackId)?.id ?? finalAllowed[0].id;
      setSelectedId(String(pre));
      setLoading(false);
    };

    if (role === "admin") {
      // Admin can switch to any location (service + warehouse).
      void (async () => {
        try {
          const locRows = await fetchLocations();
          const cleaned = Array.isArray(locRows)
            ? (locRows as ServiceLocationRow[])
                .map((l) => ({ id: Number(l.id), name: String(l.name ?? "") }))
                .filter((x) => x.id > 0 && x.name)
            : [];
          setFromList(cleaned);
        } catch {
          setFromList([{ id: fallbackId, name: fallbackName }]);
        }
      })();
      return;
    }

    setFromList(allowed);
  }, []);

  useEffect(() => {
    // If only one allowed location, auto-select and continue.
    if (!loading && locations.length === 1 && selectedId) {
      window.localStorage.setItem("location_id", String(locations[0].id));
      window.localStorage.setItem("location_name", String(locations[0].name));
      const ret = searchParams?.get("return") ?? "/dashboard/overall";
      // Full reload so all modules re-initialize with X-Location-Id context.
      window.location.href = ret;
    }
  }, [loading, locations, selectedId, router]);

  const selected = useMemo(() => {
    const id = Number(selectedId);
    return locations.find((l) => l.id === id) ?? null;
  }, [locations, selectedId]);

  const continueToApp = () => {
    if (!selectedId) return;
    const id = Number(selectedId);
    const loc = locations.find((l) => l.id === id);
    window.localStorage.setItem("location_id", String(selectedId));
    if (loc?.name) window.localStorage.setItem("location_name", String(loc.name));
    const ret = searchParams?.get("return") ?? "/dashboard/overall";
    window.location.href = ret;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-lg border-none shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 mx-auto mb-3">
            <img 
              src="/icon-bizzflow-logo-optimized.webp" 
              alt="BizzFlow Icon" 
              className="w-full h-full object-contain"
            />
          </div>
          <CardTitle className="text-2xl">Choose Location</CardTitle>
          <CardDescription>Select the location you want to work in</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
              Loading locations...
            </div>
          ) : (
            <>
              <RadioGroup value={selectedId} onValueChange={setSelectedId} className="gap-3">
                {locations.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between rounded-xl border p-4 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value={String(l.id)} id={`loc-${l.id}`} />
                      <Label htmlFor={`loc-${l.id}`} className="cursor-pointer">
                        <div className="font-semibold">{l.name}</div>
                        <div className="text-xs text-muted-foreground">Location ID: {l.id}</div>
                      </Label>
                    </div>
                  </div>
                ))}
              </RadioGroup>

              <Button
                className="w-full bg-primary hover:bg-primary/90 py-6 text-lg rounded-xl font-bold"
                onClick={continueToApp}
                disabled={!selectedId}
              >
                Continue
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>

              {selected ? (
                <div className="text-xs text-muted-foreground text-center">
                  Current selection: <span className="font-semibold text-foreground">{selected.name}</span>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
