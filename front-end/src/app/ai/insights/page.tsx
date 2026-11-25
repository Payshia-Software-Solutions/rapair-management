"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
    ArrowLeft, ArrowUp, Check, ChevronRight, Copy, Loader2, MessageSquare, MoreHorizontal, PanelLeft,
    Pencil, RotateCcw, Search, Settings2, Sparkles, Square, SquarePen, ThumbsDown, ThumbsUp, Trash2, X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AiChart } from "@/components/dashboard/ai-chart";
import { AiProgress } from "@/components/dashboard/ai-progress";
import { AI_PROVIDERS } from "@/components/admin/ai-model-settings";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { askBizFlowStream, type AiStep } from "@/lib/api/intelligence";
import { fetchSystemSettings } from "@/lib/api";
import {
    appendAiMessages, deleteAiConversation, getAiConversation, listAiConversations, rateAiMessage,
    renameAiConversation, type AiConversation,
} from "@/lib/api/ai-chat";
import { erpHomeRoute } from "@/lib/home-route";
import { cn } from "@/lib/utils";

interface Message {
    key: string;
    id?: number;                 // saved message id (for feedback)
    role: "user" | "assistant";
    content: string;
    method?: string[];
    retryCount?: number;
    model?: string;
    feedback?: number;
    failed?: boolean;
}

const SUGGESTIONS = [
    { title: "Last month's revenue", prompt: "What was our revenue last month, compared with the month before?" },
    { title: "Top customers", prompt: "Show me the top 5 customers by sales this year." },
    { title: "Stock to reorder", prompt: "Which items are low in stock and moving fast?" },
    { title: "Unpaid invoices", prompt: "Which invoices are still unpaid, oldest first?" },
];

const newKey = () => Math.random().toString(36).slice(2);

/** Groups the sidebar list like ChatGPT: Today, Yesterday, Previous 7 days, Older. */
function groupLabel(iso: string) {
    const d = new Date(iso.replace(" ", "T"));
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const days = Math.floor((start.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return "Previous 7 days";
    if (days < 30) return "Previous 30 days";
    return "Older";
}

function Markdown({ text }: { text: string }) {
    return (
        <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-p:leading-7 prose-table:my-3 prose-table:text-sm
            prose-th:border-b prose-th:px-3 prose-th:py-1.5 prose-th:text-left prose-th:text-xs prose-th:font-medium prose-th:text-muted-foreground
            prose-td:border-b prose-td:px-3 prose-td:py-1.5 prose-td:tabular-nums prose-pre:bg-muted prose-pre:text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                code({ className, children, ...props }: any) {
                    if (className === "language-chart") {
                        try { return <AiChart config={JSON.parse(String(children).replace(/\s+/g, " ").trim())} />; }
                        catch { return <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs" {...props}>{children}</pre>; }
                    }
                    return <code className={className} {...props}>{children}</code>;
                },
            }}>
                {text.replace(/\|\|/g, "|")}
            </ReactMarkdown>
        </div>
    );
}

export default function AiInsightsPage() {
    const [conversations, setConversations] = useState<AiConversation[]>([]);
    const [search, setSearch] = useState("");
    const [activeId, setActiveId] = useState<number | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loadingChat, setLoadingChat] = useState(false);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [steps, setSteps] = useState<AiStep[]>([]);
    const [modelLabel, setModelLabel] = useState("");
    const [noKey, setNoKey] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [renaming, setRenaming] = useState<{ id: number; title: string } | null>(null);
    const [copied, setCopied] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Full-screen page (no ERP layout): send signed-out users to the login page.
    // Small screens start with the sidebar closed (it opens as a drawer).
    useEffect(() => {
        if (!localStorage.getItem("auth_token")) { window.location.href = "/login"; return; }
        if (window.innerWidth < 1024) setSidebarOpen(false);
    }, []);

    useEffect(() => {
        void fetchSystemSettings().then((s) => {
            const p = AI_PROVIDERS.find((x) => x.id === s.ai_provider) || AI_PROVIDERS[0];
            setModelLabel(`${p.name} · ${s[`ai_${p.id}_model`] || p.defaultModel}`);
            setNoKey(!s[`ai_${p.id}_key`]);
        }).catch(() => {});
    }, []);

    const loadList = useCallback(async (q = "") => {
        try { setConversations(await listAiConversations(q)); } catch { /* list stays as it was */ }
    }, []);
    useEffect(() => {
        const t = setTimeout(() => void loadList(search.trim()), search ? 250 : 0);
        return () => clearTimeout(t);
    }, [search, loadList]);

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy, steps.length]);

    // Composer grows with its text, up to about 8 lines
    useEffect(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, 220) + "px";
    }, [input]);

    const closeOnMobile = () => { if (window.innerWidth < 1024) setSidebarOpen(false); };

    const newChat = () => {
        abortRef.current?.abort();
        abortRef.current = null;
        setBusy(false);
        setActiveId(null);
        setMessages([]);
        setInput("");
        closeOnMobile();
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const openChat = async (id: number) => {
        if (id === activeId) { closeOnMobile(); return; }
        abortRef.current?.abort();
        abortRef.current = null;
        setBusy(false);
        setActiveId(id);
        setLoadingChat(true);
        closeOnMobile();
        try {
            const c = await getAiConversation(id);
            setMessages(c.messages.map((m) => ({
                key: `m${m.id}`, id: m.id, role: m.role, content: m.content, feedback: m.feedback,
                method: m.meta?.method, retryCount: m.meta?.retryCount, model: m.meta?.model,
            })));
        } catch {
            setMessages([{ key: newKey(), role: "assistant", content: "Couldn't open this chat. It may have been deleted.", failed: true }]);
        } finally {
            setLoadingChat(false);
        }
    };

    const send = async (text: string, opts: { regenerate?: boolean } = {}) => {
        const question = text.trim();
        if (!question || busy) return;
        const controller = new AbortController();
        abortRef.current = controller;
        const convAtStart = activeId;

        if (!opts.regenerate) setMessages((prev) => [...prev, { key: newKey(), role: "user", content: question }]);
        setInput("");
        setBusy(true);
        setSteps([]);

        let reply: Message;
        try {
            const res = await askBizFlowStream(question, (s) => setSteps((prev) => [...prev, s]), controller.signal) as any;
            reply = res.success
                ? { key: newKey(), role: "assistant", content: res.answer, method: res.method, retryCount: res.retryCount, model: res.model }
                : { key: newKey(), role: "assistant", content: res.error || "I couldn't answer that.", failed: true };
        } catch (err: any) {
            reply = err?.name === "AbortError"
                ? { key: newKey(), role: "assistant", content: "Stopped.", failed: true }
                : { key: newKey(), role: "assistant", content: "Couldn't reach the server. Check your connection and that an AI model and API key are set in AI settings.", failed: true };
        }
        // The user moved to another chat while this was running: don't mix the answer into it
        if (abortRef.current !== controller) return;
        setMessages((prev) => [...prev, reply]);
        setBusy(false);
        abortRef.current = null;

        // Save the exchange. Failed answers are shown but not kept.
        try {
            const toSave: { role: "user" | "assistant"; content: string; meta?: unknown }[] = [];
            if (!opts.regenerate) toSave.push({ role: "user", content: question });
            if (!reply.failed) toSave.push({ role: "assistant", content: reply.content, meta: { method: reply.method, retryCount: reply.retryCount, model: reply.model } });
            if (!toSave.length) return;
            const saved = await appendAiMessages(convAtStart, toSave);
            if (!reply.failed) {
                const replyId = saved.message_ids[saved.message_ids.length - 1];
                setMessages((prev) => prev.map((m) => (m.key === reply.key ? { ...m, id: replyId } : m)));
            }
            if (!convAtStart) setActiveId(saved.id);
            void loadList(search.trim());
        } catch { /* the chat still works; it just isn't saved */ }
    };

    const stop = () => {
        const c = abortRef.current;
        c?.abort();
    };

    const regenerate = (index: number) => {
        const lastQuestion = [...messages.slice(0, index)].reverse().find((m) => m.role === "user");
        if (!lastQuestion) return;
        setMessages((prev) => prev.filter((_, i) => i !== index));
        void send(lastQuestion.content, { regenerate: true });
    };

    const copy = async (m: Message) => {
        try { await navigator.clipboard.writeText(m.content); setCopied(m.key); setTimeout(() => setCopied(null), 1500); } catch {}
    };

    const rate = async (m: Message, value: 1 | -1) => {
        if (!m.id) return;
        const next = m.feedback === value ? 0 : value;
        setMessages((prev) => prev.map((x) => (x.key === m.key ? { ...x, feedback: next } : x)));
        try { await rateAiMessage(m.id, next as 1 | -1 | 0); } catch {}
    };

    const saveRename = async () => {
        if (!renaming) return;
        const title = renaming.title.trim();
        setRenaming(null);
        if (!title) return;
        setConversations((prev) => prev.map((c) => (c.id === renaming.id ? { ...c, title } : c)));
        try { await renameAiConversation(renaming.id, title); } catch { void loadList(search.trim()); }
    };

    const remove = async (c: AiConversation) => {
        if (!confirm(`Delete "${c.title}"?`)) return;
        setConversations((prev) => prev.filter((x) => x.id !== c.id));
        if (c.id === activeId) newChat();
        try { await deleteAiConversation(c.id); } catch { void loadList(search.trim()); }
    };

    const backToErp = async () => { window.location.href = await erpHomeRoute(); };

    const grouped: [string, AiConversation[]][] = [];
    for (const c of conversations) {
        const g = groupLabel(c.updated_at);
        const last = grouped[grouped.length - 1];
        if (last && last[0] === g) last[1].push(c); else grouped.push([g, [c]]);
    }

    const empty = messages.length === 0 && !loadingChat;

    const composer = (
        <form onSubmit={(e) => { e.preventDefault(); void send(input); }}
            className="w-full rounded-3xl border bg-card shadow-sm focus-within:ring-2 focus-within:ring-primary/20">
            <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(input); }
                }}
                placeholder="Ask about sales, customers, stock or expenses…"
                aria-label="Question"
                className="block max-h-[220px] w-full resize-none bg-transparent px-5 pt-4 pb-2 text-[15px] leading-6 outline-none placeholder:text-muted-foreground"
            />
            <div className="flex items-center justify-between gap-2 px-3 pb-3">
                <Link href="/admin/settings/system?tab=ai" title="AI settings"
                    className="flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                    <Settings2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{modelLabel || "Loading model…"}</span>
                </Link>
                {busy ? (
                    <button type="button" onClick={stop} aria-label="Stop"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background hover:opacity-80">
                        <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                    </button>
                ) : (
                    <button type="submit" disabled={!input.trim()} aria-label="Send"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-30">
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </button>
                )}
            </div>
        </form>
    );

    return (
        <div className="fixed inset-0 z-40 flex bg-background text-foreground">
            {/* Mobile backdrop */}
            {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

            {/* Sidebar */}
            <aside className={cn(
                "z-50 flex w-72 shrink-0 flex-col border-r bg-muted/40 transition-all duration-200",
                "fixed inset-y-0 left-0 lg:static",
                sidebarOpen ? "translate-x-0" : "-translate-x-full lg:-ml-72",
            )}>
                <div className="flex items-center justify-between px-3 pt-3 pb-2">
                    <button onClick={backToErp} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to ERP
                    </button>
                    <button onClick={() => setSidebarOpen(false)} aria-label="Close sidebar" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                        <PanelLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>

                <div className="space-y-1 px-3">
                    <button onClick={newChat} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium hover:bg-muted">
                        <SquarePen className="h-4 w-4" aria-hidden="true" /> New chat
                    </button>
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats"
                            className="w-full rounded-lg bg-transparent py-2 pl-9 pr-8 text-sm outline-none hover:bg-muted focus:bg-muted placeholder:text-muted-foreground" />
                        {search && (
                            <button onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                        )}
                    </div>
                </div>

                <nav className="mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
                    {conversations.length === 0 && (
                        <p className="px-2.5 py-2 text-xs text-muted-foreground">{search ? "No chats match." : "Your chats will show here."}</p>
                    )}
                    {grouped.map(([label, items]) => (
                        <div key={label} className="mb-3">
                            <p className="px-2.5 pb-1 pt-2 text-xs font-medium text-muted-foreground">{label}</p>
                            {items.map((c) => (
                                <div key={c.id} className={cn("group flex items-center rounded-lg", c.id === activeId ? "bg-muted" : "hover:bg-muted/70")}>
                                    {renaming?.id === c.id ? (
                                        <input autoFocus value={renaming.title}
                                            onChange={(e) => setRenaming({ id: c.id, title: e.target.value })}
                                            onBlur={saveRename}
                                            onKeyDown={(e) => { if (e.key === "Enter") void saveRename(); if (e.key === "Escape") setRenaming(null); }}
                                            className="m-1 w-full rounded-md border bg-background px-2 py-1 text-sm outline-none" />
                                    ) : (
                                        <>
                                            <button onClick={() => openChat(c.id)} className="min-w-0 flex-1 truncate px-2.5 py-2 text-left text-sm">{c.title}</button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button aria-label="Chat options" className="mr-1 rounded-md p-1 text-muted-foreground opacity-0 hover:text-foreground focus:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100">
                                                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="start">
                                                    <DropdownMenuItem onClick={() => setRenaming({ id: c.id, title: c.title })}>
                                                        <Pencil className="mr-2 h-4 w-4" aria-hidden="true" /> Rename
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => remove(c)} className="text-destructive focus:text-destructive">
                                                        <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                </nav>

                <div className="border-t px-5 py-3 text-xs text-muted-foreground">
                    Reads your data only. It can't change anything.
                </div>
            </aside>

            {/* Main */}
            <main className="flex min-w-0 flex-1 flex-col">
                <header className="flex h-14 shrink-0 items-center gap-2 px-3">
                    {!sidebarOpen && (
                        <>
                            <button onClick={() => setSidebarOpen(true)} aria-label="Open sidebar" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                                <PanelLeft className="h-5 w-5" aria-hidden="true" />
                            </button>
                            <button onClick={newChat} aria-label="New chat" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                                <SquarePen className="h-5 w-5" aria-hidden="true" />
                            </button>
                        </>
                    )}
                    <span className="flex items-center gap-1.5 px-2 text-lg font-semibold">
                        <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" /> BizzFlow AI
                    </span>
                </header>

                {noKey && (
                    <div className="mx-auto mb-2 w-full max-w-3xl px-4">
                        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm">
                            No API key is set for the AI model. <Link href="/admin/settings/system?tab=ai" className="font-medium underline">Add one in AI settings</Link> to start asking.
                        </div>
                    </div>
                )}

                {empty ? (
                    <div className="flex flex-1 flex-col items-center justify-center px-4 pb-16">
                        <h1 className="mb-8 text-center text-2xl font-semibold sm:text-3xl">What should we look into?</h1>
                        <div className="w-full max-w-3xl">{composer}</div>
                        <div className="mt-6 grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
                            {SUGGESTIONS.map((s) => (
                                <button key={s.title} onClick={() => send(s.prompt)} disabled={busy}
                                    className="group rounded-2xl border bg-card p-4 text-left transition-colors hover:bg-muted/60 disabled:opacity-50">
                                    <p className="flex items-center justify-between text-sm font-medium">
                                        {s.title}
                                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                                    </p>
                                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.prompt}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6">
                                {loadingChat && (
                                    <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /></div>
                                )}
                                {messages.map((m, i) => m.role === "user" ? (
                                    <div key={m.key} className="flex justify-end">
                                        <div className="max-w-[80%] whitespace-pre-wrap rounded-3xl bg-muted px-5 py-2.5 text-[15px] leading-6">{m.content}</div>
                                    </div>
                                ) : (
                                    <div key={m.key} className="group">
                                        <div className={cn("text-[15px]", m.failed && "text-muted-foreground")}>
                                            <Markdown text={m.content} />
                                        </div>
                                        {!!m.method?.length && (
                                            <details className="group/d mt-2">
                                                <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                                                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-open/d:rotate-90" aria-hidden="true" />
                                                    How this was worked out
                                                </summary>
                                                <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
                                                    {m.method.map((s, k) => <li key={k}>{s}</li>)}
                                                    {!!m.retryCount && <li>Retried after a lookup error ({m.retryCount}×).</li>}
                                                </ol>
                                            </details>
                                        )}
                                        <div className="mt-2 flex items-center gap-0.5 text-muted-foreground">
                                            <button onClick={() => copy(m)} aria-label="Copy" title="Copy" className="rounded-md p-1.5 hover:bg-muted hover:text-foreground">
                                                {copied === m.key ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                                            </button>
                                            {m.id && (
                                                <>
                                                    <button onClick={() => rate(m, 1)} aria-label="Good answer" title="Good answer" className={cn("rounded-md p-1.5 hover:bg-muted hover:text-foreground", m.feedback === 1 && "text-foreground")}>
                                                        <ThumbsUp className={cn("h-4 w-4", m.feedback === 1 && "fill-current")} aria-hidden="true" />
                                                    </button>
                                                    <button onClick={() => rate(m, -1)} aria-label="Bad answer" title="Bad answer" className={cn("rounded-md p-1.5 hover:bg-muted hover:text-foreground", m.feedback === -1 && "text-foreground")}>
                                                        <ThumbsDown className={cn("h-4 w-4", m.feedback === -1 && "fill-current")} aria-hidden="true" />
                                                    </button>
                                                </>
                                            )}
                                            {i === messages.length - 1 && !busy && (
                                                <button onClick={() => regenerate(i)} aria-label="Regenerate" title="Regenerate" className="rounded-md p-1.5 hover:bg-muted hover:text-foreground">
                                                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                                                </button>
                                            )}
                                            {m.model && <span className="ml-2 text-xs">{m.model}</span>}
                                        </div>
                                    </div>
                                ))}
                                {busy && (
                                    <div className="max-w-md">
                                        <AiProgress steps={steps} />
                                    </div>
                                )}
                                <div ref={bottomRef} />
                            </div>
                        </div>
                        <div className="mx-auto w-full max-w-3xl px-4 pb-4">
                            {composer}
                            <p className="mt-2 text-center text-xs text-muted-foreground">
                                <MessageSquare className="mr-1 inline h-3 w-3" aria-hidden="true" />
                                Answers come from your live data. Check important numbers before acting on them.
                            </p>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
