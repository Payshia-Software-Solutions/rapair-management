import { api } from "./client";

export type SubscriberStatus = "Subscribed" | "Unsubscribed";

export interface Subscriber {
  id: number;
  email: string;
  name: string | null;
  source: string;
  status: SubscriberStatus;
  customer_id: number | null;
  customer_name: string | null;
  subscribed_at: string | null;
  unsubscribed_at: string | null;
  created_at: string;
}

export interface SubscriberStats {
  total: number;
  subscribed: number;
  unsubscribed: number;
  last_30_days: number;
}

async function parse<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.status !== "success") {
    throw new Error(json?.message || `Request failed (${res.status})`);
  }
  return json.data as T;
}

export async function fetchSubscribers(params: { status?: SubscriberStatus | ""; q?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.q) qs.set("q", params.q);
  const res = await api(`/api/subscribers/index${qs.toString() ? `?${qs}` : ""}`);
  return parse<{ subscribers: Subscriber[]; stats: SubscriberStats }>(res);
}

export async function addSubscriber(data: { email: string; name?: string }) {
  const res = await api("/api/subscribers/store", { method: "POST", body: JSON.stringify(data) });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.status !== "success") throw new Error(json?.message || "Could not add subscriber");
  return json.message as string;
}

export async function setSubscriberStatus(id: number, status: SubscriberStatus) {
  const res = await api(`/api/subscribers/status/${id}`, { method: "POST", body: JSON.stringify({ status }) });
  await parse(res);
}

export async function deleteSubscriber(id: number) {
  const res = await api(`/api/subscribers/delete/${id}`, { method: "POST" });
  await parse(res);
}

export async function downloadSubscribersCsv() {
  const res = await api("/api/subscribers/export");
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
