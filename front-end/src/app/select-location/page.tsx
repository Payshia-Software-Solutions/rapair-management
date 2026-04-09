"use client"

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin, ArrowRight } from "lucide-react";

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
    const allowed: AllowedLocation[] = Array.isArray(payload?.allowed_locations)
      ? payload.allowed_locations
          .map((x: any) => ({ id: Number(x?.id), name: String(x?.name ?? "") }))
          .filter((x: AllowedLocation) => x.id > 0 && x.name)
      : [];

    const fallbackId = payload?.location_id ? Number(payload.location_id) : 1;
    const fallbackName = payload?.location_name ? String(payload.location_name) : "Main";
    const finalAllowed = allowed.length > 0 ? allowed : [{ id: fallbackId, name: fallbackName }];

    setLocations(finalAllowed);
    const pre = finalAllowed.find((l) => l.id === fallbackId)?.id ?? finalAllowed[0].id;
    setSelectedId(String(pre));
    setLoading(false);
  }, []);

  useEffect(() => {
    // If only one allowed location, auto-select and continue.
    if (!loading && locations.length === 1 && selectedId) {
      window.localStorage.setItem("location_id", String(locations[0].id));
      window.localStorage.setItem("location_name", String(locations[0].name));
      router.replace("/dashboard");
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
    router.replace("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <Card className="w-full max-w-lg border-none shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="text-center pb-4">
          <div className="w-14 h-14 bg-blue-50 text-primary rounded-2xl flex items-center justify-center mx-auto mb-3">
            <MapPin className="w-7 h-7" />
          </div>
          <CardTitle className="text-2xl">Choose Location</CardTitle>
          <CardDescription>Select the service center you want to work in</CardDescription>
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
