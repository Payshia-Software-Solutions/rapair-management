"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Bot, Send, Trash2, Database, ChevronRight, Square, User, Loader2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PageHeader, SectionCard } from "@/components/page-shell";
import { AiChart } from "@/components/dashboard/ai-chart";
import { AI_PROVIDERS } from "@/components/admin/ai-model-settings";
import { askBizFlowStream, type AiStep } from "@/lib/api/intelligence";
import { AiProgress } from "@/components/dashboard/ai-progress";
import { fetchSystemSettings } from "@/lib/api";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
    type?: "insight" | "data" | "welcome";
    method?: string[];
    retryCount?: number;
    model?: string;
}

const SUGGESTED_PROMPTS = [
    "What was our revenue last month?",
    "Show me the top 5 customers by sales.",
    "Which items are low in stock and moving fast?",
    "Predict the revenue for next month.",
    "Are there any unpaid invoices from last week?"
];

// Matches the tables the server lets the assistant read (IntelligenceController::AI_TABLES).
const DATA_SOURCES = ["Invoices & invoice lines", "Customer payments", "Customers", "Items & stock movements", "Stock batches", "Expenses", "Repair orders"];

export default function AiInsightsPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [steps, setSteps] = useState<AiStep[]>([]);
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [modelLabel, setModelLabel] = useState("");

    useEffect(() => {
        void fetchSystemSettings().then((s) => {
            const p = AI_PROVIDERS.find((x) => x.id === s.ai_provider) || AI_PROVIDERS[0];
            setModelLabel(`${p.name} · ${s[`ai_${p.id}_model`] || p.defaultModel}${s[`ai_${p.id}_key`] ? "" : " (no API key: add one in AI settings)"}`);
        }).catch(() => {});
    }, []);

    useEffect(() => {
        setMessages([
            {
                id: "welcome",
                role: "assistant",
                content: "Ask me about sales, customers, stock, expenses or repair orders. I look up the answer in your live data (read-only) and explain it, with a chart when it helps.",
                timestamp: new Date(),
                type: "welcome"
            }
        ]);
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isLoading]);

    const handleSend = async (text: string) => {
        if (!text.trim()) return;

        const controller = new AbortController();
        setAbortController(controller);

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);
        setSteps([]);

        try {
            // Stop really cancels the request (and the stream), not just the spinner.
            const res = await askBizFlowStream(text, (s) => setSteps((prev) => [...prev, s]), controller.signal) as any;

            const assistantMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: res.success ? res.answer : (res.error || "I encountered an error processing your request."),
                timestamp: new Date(),
                type: "insight",
                method: res.success ? res.method : undefined,
                retryCount: res.success ? res.retryCount : undefined,
                model: res.success ? res.model : undefined
            };
            setMessages(prev => [...prev, assistantMsg]);
        } catch (err: any) {
            if (err?.name === 'AbortError') {
                const interruptMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: 'Stopped.',
                    timestamp: new Date(),
                    type: "insight"
                };
                setMessages(prev => [...prev, interruptMsg]);
            } else {
                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    role: "assistant",
                    content: "Couldn't reach the server. Check your connection and that an AI model and API key are set in System Settings → AI.",
                    timestamp: new Date()
                }]);
            }
        } finally {
            setIsLoading(false);
            setAbortController(null);
        }
    };

    const handleStop = () => {
        if (abortController) {
            abortController.abort();
        }
    };

    const clearChat = () => {
        if (confirm("Clear conversation history?")) {
            setMessages([messages[0]]);
        }
    };

    return (
        <DashboardLayout title="Business Intelligence">
            <div className="flex h-[calc(100vh-140px)] w-full flex-col gap-5">
                <PageHeader
                    title="Business Intelligence"
                    description={<>Ask questions about your data in plain language. Read-only · {modelLabel ? <span className="text-foreground">{modelLabel}</span> : "loading model…"}</>}
                    actions={<>
                        <Button variant="outline" asChild><Link href="/admin/settings/system?tab=ai"><Settings2 className="h-4 w-4 mr-2" aria-hidden="true" /> AI settings</Link></Button>
                        <Button variant="outline" onClick={clearChat} disabled={messages.length <= 1}><Trash2 className="h-4 w-4 mr-2" aria-hidden="true" /> Clear</Button>
                    </>}
                />

                <div className="flex min-h-0 flex-1 gap-5">
                    <aside className="hidden w-72 shrink-0 flex-col gap-5 lg:flex">
                        <SectionCard title="Try asking" bodyClassName="grid gap-1.5 p-2">
                            {SUGGESTED_PROMPTS.map((prompt) => (
                                <button key={prompt} onClick={() => handleSend(prompt)} disabled={isLoading}
                                    className="group flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50">
                                    <span className="line-clamp-2">{prompt}</span>
                                    <ChevronRight className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                                </button>
                            ))}
                        </SectionCard>
                        <SectionCard title="Data it can read" description="Read-only; nothing can be changed" bodyClassName="p-3">
                            <ul className="grid gap-1.5 text-sm text-muted-foreground">
                                {DATA_SOURCES.map((s) => (
                                    <li key={s} className="flex items-center gap-2"><Database className="h-3.5 w-3.5" aria-hidden="true" /> {s}</li>
                                ))}
                            </ul>
                        </SectionCard>
                    </aside>

                    <Card className="flex min-w-0 flex-1 flex-col overflow-hidden">
                        <ScrollArea className="flex-1">
                            <div className="space-y-5 p-4 sm:p-5">
                                {messages.map((msg) => {
                                    const mine = msg.role === "user";
                                    return (
                                        <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                                            className={cn("flex gap-3", mine && "flex-row-reverse")}>
                                            <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                                                mine ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground")}>
                                                {mine ? <User className="h-4 w-4" aria-hidden="true" /> : <Bot className="h-4 w-4" aria-hidden="true" />}
                                            </div>
                                            <div className={cn("flex min-w-0 max-w-[85%] flex-col gap-1", mine ? "items-end" : "items-start")}>
                                                <div className={cn("min-w-0 overflow-hidden rounded-lg px-4 py-3 text-sm leading-relaxed",
                                                    mine ? "bg-primary text-primary-foreground" : "border bg-muted/30")}>
                                                    {mine ? <p className="whitespace-pre-wrap">{msg.content}</p> : (
                                                        <div className="prose prose-sm max-w-none dark:prose-invert
                                                            prose-p:my-2 prose-table:my-3 prose-table:text-sm
                                                            prose-th:border-b prose-th:px-3 prose-th:py-1.5 prose-th:text-left prose-th:text-xs prose-th:font-medium prose-th:text-muted-foreground
                                                            prose-td:border-b prose-td:px-3 prose-td:py-1.5 prose-td:tabular-nums">
                                                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                                                                code({ className, children, ...props }: any) {
                                                                    if (className === "language-chart") {
                                                                        try { return <AiChart config={JSON.parse(String(children).replace(/\s+/g, " ").trim())} />; }
                                                                        catch { return <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs" {...props}>{children}</pre>; }
                                                                    }
                                                                    return <code className={className} {...props}>{children}</code>;
                                                                },
                                                            }}>
                                                                {msg.content.replace(/\|\|/g, "|")}
                                                            </ReactMarkdown>
                                                        </div>
                                                    )}

                                                    {!!msg.method?.length && (
                                                        <details className="group mt-3 border-t pt-3">
                                                            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                                                                <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" aria-hidden="true" />
                                                                How this was worked out
                                                            </summary>
                                                            <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
                                                                {msg.method.map((step, i) => <li key={i}>{step}</li>)}
                                                                {!!msg.retryCount && msg.retryCount > 0 && <li>Retried after a lookup error ({msg.retryCount}×).</li>}
                                                            </ol>
                                                        </details>
                                                    )}
                                                </div>
                                                <span className="text-xs text-muted-foreground tabular-nums">
                                                    {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{msg.model ? ` · ${msg.model}` : ""}
                                                </span>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                                {isLoading && (
                                    <div className="flex gap-3">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Bot className="h-4 w-4" aria-hidden="true" /></div>
                                        <div className="min-w-[240px] max-w-[85%] rounded-lg border bg-muted/30 px-4 py-3">
                                            <AiProgress steps={steps} />
                                        </div>
                                    </div>
                                )}
                                <div ref={scrollRef} />
                            </div>
                        </ScrollArea>

                        <form className="border-t p-3" onSubmit={(e) => { e.preventDefault(); if (!isLoading) void handleSend(input); }}>
                            <div className="flex items-center gap-2">
                                <Input value={input} onChange={(e) => setInput(e.target.value)} disabled={isLoading} className="h-11"
                                    placeholder={isLoading ? "Working on it…" : "Ask a question about your business data…"} aria-label="Question" />
                                {isLoading ? (
                                    <Button type="button" variant="outline" className="h-11" onClick={handleStop}><Square className="h-4 w-4 mr-2 fill-current" aria-hidden="true" /> Stop</Button>
                                ) : (
                                    <Button type="submit" className="h-11" disabled={!input.trim()}><Send className="h-4 w-4 mr-2" aria-hidden="true" /> Ask</Button>
                                )}
                            </div>
                        </form>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
