"use client";

import React, { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Smartphone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BASE_URL } from "@/lib/api/client";
import { tenantHost } from "@/lib/tenant";

/**
 * QR code the BizzFlow Management app scans to connect to this server/workspace.
 * Payload: bizzflow://connect?api=<API base>&host=<workspace domain, shared mode only>
 * The app reads the same fields (mobile_mgmt/lib/screens/setup_screen.dart).
 */
export function MobileConnectCard() {
  const [payload, setPayload] = useState<string | null>(null);
  const [localOnly, setLocalOnly] = useState(false);

  useEffect(() => {
    const api = BASE_URL.replace(/\/+$/, "");
    const host = tenantHost();
    const q = new URLSearchParams({ api });
    if (host) q.set("host", host);
    setPayload(`bizzflow://connect?${q.toString()}`);
    // A phone can't reach "localhost": open the web app by the PC's LAN IP to get a usable code.
    setLocalOnly(/\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/.test(api));
  }, []);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-primary" aria-hidden="true" />
          Connect mobile app
        </CardTitle>
        <CardDescription>
          Open BizzFlow Management on your phone, tap <strong>Scan QR code</strong>, and point it here.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col sm:flex-row items-center gap-6">
        <div className="rounded-xl bg-white p-3 border">
          {payload ? <QRCodeSVG value={payload} size={168} level="M" /> : <div className="w-[168px] h-[168px]" />}
        </div>
        <div className="text-sm space-y-2 text-muted-foreground">
          <p>The code only holds the server address. You still sign in with your own email and password.</p>
          {localOnly && (
            <p className="text-amber-600">
              This page is open on <code>localhost</code>, so a phone can&apos;t use this code. Open the web app using
              this computer&apos;s network address (for example <code>http://192.168.1.10:9003</code>) and scan again.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
