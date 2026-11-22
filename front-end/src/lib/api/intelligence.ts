import { api } from './client';

export interface BusinessSnapshot {
    month_revenue: number;
    month_expenses: number;
    net_profit_margin: number;
    active_repairs: number;
    low_stock_alerts: number;
    currency: string;
}

export interface ForecastData {
    historical: { x: number; y: number; month: string }[];
    predicted_next_month: number;
    trend: 'Upward' | 'Downward';
    growth_rate: number;
}

export const fetchBusinessSnapshot = async () => {
    const res = await api('/api/intelligence/snapshot');
    const data = await res.json();
    return data.data as BusinessSnapshot;
};

export const fetchRevenueForecast = async () => {
    const res = await api('/api/intelligence/forecast');
    const data = await res.json();
    return data.data as ForecastData;
};

export const fetchInventoryIntelligence = async () => {
    const res = await api('/api/intelligence/inventory');
    const data = await res.json();
    return data.data as any;
};

export const fetchSalesAnalysis = async () => {
    const res = await api('/api/intelligence/sales_analysis');
    const data = await res.json();
    return data.data as any;
};

export const fetchCustomerInsights = async () => {
    const res = await api('/api/intelligence/customers');
    const data = await res.json();
    return data.data as any;
};

export const fetchFinancialHealth = async () => {
    const res = await api('/api/intelligence/financial_health');
    const data = await res.json();
    return data.data as any;
};

export const askAiAssistant = async (query: string) => {
    // Simulated natural language processing for now
    // In production, this would hit an LLM endpoint
    const res = await api('/api/intelligence/query', {
        method: 'POST',
        body: JSON.stringify({ query })
    });
    return res.json();
};

/**
 * Business Intelligence question. Runs on the ERP server with the company AI model
 * (System Settings → AI); the user needs reports.read. Same result shape the old
 * server action returned, so callers don't change.
 */
export const getBizFlowAiInsight = async (question: string): Promise<
  { success: true; answer: string; method?: string[]; retryCount?: number; model?: string } | { success: false; error: string }
> => {
  try {
    const res = await api('/api/intelligence/ask', { method: 'POST', body: JSON.stringify({ question }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || d.status !== 'success') return { success: false, error: d.message || `Request failed (HTTP ${res.status})` };
    return { success: true, ...d.data };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Could not reach the server' };
  }
};

export type AiStep =
  | { stage: 'thinking' | 'lookup' | 'retry' | 'writing'; text: string }
  | { stage: 'plan'; steps: string[] }
  | { stage: 'found'; rows: number };

/**
 * Same as getBizFlowAiInsight, but reports each step while the server works
 * (POST /api/intelligence/ask_stream, server-sent events). Abort with `signal`.
 */
export const askBizFlowStream = async (
  question: string,
  onStep: (step: AiStep) => void,
  signal?: AbortSignal
): Promise<Awaited<ReturnType<typeof getBizFlowAiInsight>>> => {
  let res: Response;
  try {
    res = await api('/api/intelligence/ask_stream', { method: 'POST', body: JSON.stringify({ question }), signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    return { success: false, error: 'Could not reach the server' };
  }
  // Errors before the stream starts (auth, validation) come back as plain JSON.
  if (!res.ok || !res.body || !(res.headers.get('content-type') || '').includes('text/event-stream')) {
    const d = await res.json().catch(() => ({}));
    return { success: false, error: d.message || `Request failed (HTTP ${res.status})` };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      let event = 'message', data = '';
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      let payload: any;
      try { payload = JSON.parse(data); } catch { continue; }
      if (event === 'done') return { success: true, ...payload };
      if (event === 'error') return { success: false, error: payload.message || 'Something went wrong' };
      onStep({ stage: event, ...payload } as AiStep);
    }
  }
  return { success: false, error: 'The connection closed before an answer arrived.' };
};
