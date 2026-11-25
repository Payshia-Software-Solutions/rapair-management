import { api } from './client';

/** Saved AI assistant conversations (server: AiChatController). One list per user. */
export interface AiConversation { id: number; title: string; updated_at: string }
export interface AiStoredMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  meta?: { method?: string[]; retryCount?: number; model?: string } | null;
  feedback: number;
  created_at: string;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await api(path, init);
  const j = await res.json().catch(() => null);
  if (!res.ok || j?.status !== 'success') throw new Error(j?.message || 'Request failed');
  return j.data as T;
}
const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export const listAiConversations = (q = '') =>
  call<AiConversation[]>(`/api/ai-chat/list${q ? `?q=${encodeURIComponent(q)}` : ''}`);

export const getAiConversation = (id: number) =>
  call<AiConversation & { messages: AiStoredMessage[] }>(`/api/ai-chat/get?id=${id}`);

export const appendAiMessages = (
  id: number | null,
  messages: { role: 'user' | 'assistant'; content: string; meta?: unknown }[],
) => call<{ id: number; message_ids: number[] }>('/api/ai-chat/append', post({ id, messages }));

export const renameAiConversation = (id: number, title: string) => call<null>('/api/ai-chat/rename', post({ id, title }));
export const deleteAiConversation = (id: number) => call<null>('/api/ai-chat/delete', post({ id }));
export const rateAiMessage = (message_id: number, value: 1 | -1 | 0) => call<null>('/api/ai-chat/feedback', post({ message_id, value }));
