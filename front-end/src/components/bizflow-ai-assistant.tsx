"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Bot, TrendingUp, Package, Loader2, Maximize2, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AiChart } from "@/components/dashboard/ai-chart";
import { fetchBusinessSnapshot, type BusinessSnapshot } from "@/lib/api";
import { askBizFlowStream, type AiStep } from "@/lib/api/intelligence";
import { AiProgress } from "@/components/dashboard/ai-progress";
import { cn } from "@/lib/utils";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
    error?: boolean;
}

const QUICK_ACTIONS = [
    { label: "Top sellers", query: "What are our top selling items this month?" },
    { label: "Top customers", query: "Who are our top 5 customers by sales?" },
    { label: "Unpaid invoices", query: "Which invoices are still unpaid?" },
    { label: "Low stock", query: "Which items are at or below their reorder level?" },
    { label: "Expenses", query: "What did we spend on expenses this month, by category?" },
];

const WELCOME: Message = {
    id: "welcome",
    role: "assistant",
    content: "Hi! Ask me about sales, customers, stock or expenses. I'll look it up in your live data (read-only).",
    timestamp: new Date(),
};

// Hidden where a floating button would get in the way or end up on paper.
const HIDDEN_ON = ["/cms/pos", "/print", "/receipt", "/invoices", "/ai/insights", "/login"];

export function BizFlowAiAssistant() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([WELCOME]);
    const [isLoading, setIsLoading] = useState(false);
    const [steps, setSteps] = useState<AiStep[]>([]);
    const [snapshot, setSnapshot] = useState<BusinessSnapshot | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        inputRef.current?.focus();
        if (!snapshot) void fetchBusinessSnapshot().then(setSnapshot).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages, isLoading]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isOpen]);

    if (HIDDEN_ON.some((p) => pathname?.includes(p))) return null;

    const send = async (text: string) => {
        const q = text.trim();
        if (!q || isLoading) return;
        setMessages((m) => [...m, { id: `${Date.now()}`, role: "user", content: q, timestamp: new Date() }]);
        setInput("");
        setIsLoading(true);
        setSteps([]);
        const res = await askBizFlowStream(q, (s) => setSteps((prev) => [...prev, s])).catch(() => ({ success: false as const, error: "Stopped." }));
        setMessages((m) => [...m, {
            id: `${Date.now()}-a`,
            role: "assistant",
            content: res.success ? res.answer : res.error,
            timestamp: new Date(),
            error: !res.success,
        }]);
        setIsLoading(false);
    };

    const money = (n?: number) => (n == null ? "—" : `${snapshot?.currency || "LKR"} ${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`);

    return (
        <div className="z-50 print:hidden">
            <AnimatePresence>
                {isOpen && (
                    <motion.section
                        role="dialog"
                        aria-label="BizFlow Assistant"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 16 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-[60] flex flex-col overflow-hidden border bg-background shadow-2xl sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[620px] sm:max-h-[calc(100vh-8rem)] sm:w-[400px] sm:rounded-lg"
                    >
                        <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
                            <div className="flex min-w-0 items-center gap-2.5">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                    <Bot className="h-4 w-4" aria-hidden="true" />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-sm font-semibold leading-tight">BizFlow Assistant</h2>
                                    <p className="text-xs text-muted-foreground">Answers from your live data</p>
                                </div>
                            </div>
                            <div className="flex items-center">
                                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                    <Link href="/ai/insights" onClick={() => setIsOpen(false)} aria-label="Open full Business Intelligence view" title="Open full view">
                                        <Maximize2 className="h-4 w-4" />
                                    </Link>
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)} aria-label="Close assistant">
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </header>

                        <div className="grid grid-cols-2 gap-2 border-b bg-muted/30 px-4 py-2.5 text-xs">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>This month</span>
                                <span className="ml-auto font-medium text-foreground tabular-nums">{money(snapshot?.month_revenue)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Package className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Low stock</span>
                                <span className="ml-auto font-medium text-foreground tabular-nums">{snapshot?.low_stock_alerts ?? "—"}</span>
                            </div>
                        </div>

                        <ScrollArea className="min-h-0 flex-1">
                            <div className="space-y-4 p-4" aria-live="polite">
                                {messages.map((msg) => {
                                    const mine = msg.role === "user";
                                    return (
                                        <div key={msg.id} className={cn("flex gap-2", mine && "flex-row-reverse")}>
                                            <div className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                                                mine ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground")}>
                                                {mine ? <User className="h-3.5 w-3.5" aria-hidden="true" /> : <Bot className="h-3.5 w-3.5" aria-hidden="true" />}
                                            </div>
                                            <div className={cn("min-w-0 max-w-[85%] overflow-hidden rounded-lg px-3 py-2 text-sm leading-relaxed",
                                                mine ? "bg-primary text-primary-foreground"
                                                    : msg.error ? "border border-destructive/30 bg-destructive/5"
                                                    : "border bg-muted/30")}>
                                                {mine ? <p className="whitespace-pre-wrap break-words">{msg.content}</p> : (
                                                    <div className="prose prose-sm max-w-none break-words dark:prose-invert
                                                        prose-p:my-1.5 prose-ul:my-1.5 prose-table:my-2 prose-table:block prose-table:overflow-x-auto prose-table:text-xs
                                                        prose-th:border-b prose-th:px-2 prose-th:py-1 prose-th:text-left prose-th:font-medium prose-th:text-muted-foreground
                                                        prose-td:border-b prose-td:px-2 prose-td:py-1 prose-td:tabular-nums">
                                                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                                                            code({ className, children, ...props }: any) {
                                                                if (className === "language-chart") {
                                                                    try { return <AiChart compactHeight config={JSON.parse(String(children).replace(/\s+/g, " ").trim())} />; }
                                                                    catch { return <pre className="overflow-x-auto rounded bg-muted p-2 text-xs" {...props}>{children}</pre>; }
                                                                }
                                                                return <code className="rounded bg-muted px-1 text-xs" {...props}>{children}</code>;
                                                            },
                                                        }}>
                                                            {msg.content.replace(/\|\|/g, "|")}
                                                        </ReactMarkdown>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {isLoading && (
                                    <div className="flex gap-2">
                                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                            <Bot className="h-3.5 w-3.5" aria-hidden="true" />
                                        </div>
                                        <div className="min-w-0 max-w-[85%] rounded-lg border bg-muted/30 px-3 py-2">
                                            <AiProgress steps={steps} compact />
                                        </div>
                                    </div>
                                )}
                                <div ref={scrollRef} />
                            </div>
                        </ScrollArea>

                        <div className="space-y-2 border-t p-3 pb-6 sm:pb-3">
                            {messages.length <= 1 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {QUICK_ACTIONS.map((a) => (
                                        <Button key={a.label} type="button" variant="outline" size="sm" className="h-7 rounded-full px-2.5 text-xs font-normal"
                                            onClick={() => void send(a.query)} disabled={isLoading}>
                                            {a.label}
                                        </Button>
                                    ))}
                                </div>
                            )}
                            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
                                <Input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} disabled={isLoading}
                                    placeholder="Ask about your business…" aria-label="Question" className="h-10" />
                                <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={isLoading || !input.trim()} aria-label="Send">
                                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                </Button>
                            </form>
                        </div>
                    </motion.section>
                )}
            </AnimatePresence>

            <button
                type="button"
                onClick={() => setIsOpen((o) => !o)}
                aria-label={isOpen ? "Close assistant" : "Open BizFlow Assistant"}
                aria-expanded={isOpen}
                className={cn(
                    "fixed bottom-6 right-6 z-50 h-12 w-12 items-center justify-center rounded-full shadow-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isOpen ? "hidden bg-secondary text-secondary-foreground hover:bg-secondary/80 sm:flex" : "flex bg-primary text-primary-foreground hover:bg-primary/90"
                )}
            >
                {isOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Bot className="h-5 w-5" aria-hidden="true" />}
            </button>
        </div>
    );
}
