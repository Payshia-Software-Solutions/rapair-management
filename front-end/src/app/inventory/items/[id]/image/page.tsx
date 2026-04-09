"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { contentUrl, fetchPart, setPartImage, uploadPartImage } from "@/lib/api";
import { ArrowLeft, Image as ImageIcon, Loader2, Upload } from "lucide-react";

export default function ItemImagePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [part, setPart] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const currentUrl = useMemo(() => {
    const fn = part?.image_filename ? String(part.image_filename) : "";
    if (!fn) return "";
    return contentUrl("items", fn);
  }, [part]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const p = await fetchPart(String(id));
        setPart(p);
      } catch (e: any) {
        toast({ title: "Error", description: e?.message || "Failed to load item", variant: "destructive" });
        setPart(null);
      } finally {
        setLoading(false);
      }
    };
    if (id) void run();
  }, [id]);

  const upload = async () => {
    if (!file) return;
    setSaving(true);
    try {
      const up = await uploadPartImage(file);
      if (up.status !== "success") throw new Error(up.message || "Upload failed");
      await setPartImage(String(id), up.data.filename);
      toast({ title: "Uploaded", description: "Item image updated" });
      const refreshed = await fetchPart(String(id));
      setPart(refreshed);
      setFile(null);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Upload failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                <ImageIcon className="w-6 h-6 text-primary" />
                Item Image
              </h1>
              <p className="text-muted-foreground mt-1">
                {part?.part_name ? `Item: ${part.part_name}` : `Item #${id}`}
              </p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href="/inventory/items">Back to Items</Link>
          </Button>
        </div>

        <Card className="border-none shadow-md overflow-hidden">
          <CardHeader>
            <CardTitle>Current Image</CardTitle>
            <CardDescription>Stored on the content provider (FTP)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading...
              </div>
            ) : currentUrl ? (
              <div className="flex flex-col gap-4">
                <div className="rounded-xl border bg-muted/10 p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentUrl}
                    alt="Item"
                    className="max-h-[360px] w-auto rounded-lg object-contain mx-auto"
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  Filename: <span className="font-mono">{String(part?.image_filename)}</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No image uploaded yet.</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-md overflow-hidden">
          <CardHeader>
            <CardTitle>Upload New Image</CardTitle>
            <CardDescription>JPG/PNG/WebP/GIF supported</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button className="gap-2" onClick={() => void upload()} disabled={!file || saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

