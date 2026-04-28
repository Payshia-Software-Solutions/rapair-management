"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Bot, 
    Send, 
    Sparkles, 
    Trash2, 
    MessageSquare, 
    Zap, 
    BarChart3, 
    TrendingUp, 
    Database,
    ChevronRight,
    RefreshCw,
    X,
    Square
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardLayout } from "@/components/dashboard-layout";
import { getBizFlowAiInsight } from "@/app/actions/ai-actions";
import { cn } from "@/lib/utils";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
    BarChart, Bar, LineChart, Line, PieChart, Pie, 
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
    type?: "insight" | "data" | "welcome";
    sql?: string;
    thoughts?: string;
    retryCount?: number;
}

const SUGGESTED_PROMPTS = [
    "What was our revenue last month?",
    "Show me the top 5 customers by sales.",
    "Which items are low in stock and moving fast?",
    "Predict the revenue for next month.",
    "Are there any unpaid invoices from last week?"
];

export default function AiInsightsPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMessages([
            {
                id: "welcome",
                role: "assistant",
                content: "Welcome to BizFlow Intelligence Hub. I am connected to your live database and can answer complex questions about sales, inventory, and financial performance. What would you like to know?",
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

        try {
            const res = await Promise.race([
                getBizFlowAiInsight(text),
                new Promise((_, reject) => 
                    controller.signal.addEventListener('abort', () => reject(new Error('Interrupted by user')))
                )
            ]) as any;

            const assistantMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: res.success ? res.answer : (res.error || "I encountered an error processing your request."),
                timestamp: new Date(),
                type: "insight",
                sql: res.success ? res.sql : undefined,
                thoughts: res.success ? res.thoughts : undefined,
                retryCount: res.success ? res.retryCount : undefined
            };
            setMessages(prev => [...prev, assistantMsg]);
        } catch (err: any) {
            if (err.message === 'Interrupted by user') {
                const interruptMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: 'Generation interrupted.',
                    timestamp: new Date(),
                    type: "insight"
                };
                setMessages(prev => [...prev, interruptMsg]);
            } else {
                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    role: "assistant",
                    content: "Connection error. Please ensure the AI service and your API key are configured correctly.",
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
        <DashboardLayout>
            <div className="flex flex-col h-[calc(100vh-140px)] w-full gap-4">
                {/* Header */}
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-2xl shadow-primary/30">
                            <Bot className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                                BizFlow Intelligence
                                <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[10px] font-black uppercase tracking-widest px-2">Pro</Badge>
                            </h1>
                            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Live Database Insight Engine</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={clearChat} className="rounded-xl hover:bg-rose-500/10 hover:text-rose-600 transition-colors">
                        <Trash2 className="w-5 h-5" />
                    </Button>
                </div>

                <div className="flex flex-1 gap-6 overflow-hidden">
                    {/* Sidebar Suggestions */}
                    <div className="hidden lg:flex flex-col w-72 gap-4">
                        <Card className="border-none bg-slate-50 dark:bg-slate-900/50 shadow-none flex-1">
                            <CardContent className="p-4 space-y-4">
                                <div className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                                    <Sparkles className="w-4 h-4 text-primary" />
                                    Popular Insights
                                </div>
                                <div className="space-y-2">
                                    {SUGGESTED_PROMPTS.map((prompt, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleSend(prompt)}
                                            className="w-full text-left p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:border-primary hover:text-primary transition-all shadow-sm flex items-center justify-between group"
                                        >
                                            <span className="line-clamp-2">{prompt}</span>
                                            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                        </button>
                                    ))}
                                </div>

                                <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-800">
                                    <div className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest mb-4">
                                        <Database className="w-4 h-4" />
                                        Data Sources
                                    </div>
                                    <div className="space-y-2">
                                        {["Invoices & Sales", "Inventory & Parts", "Expenses", "Repair Orders", "Customer CRM"].map((source) => (
                                            <div key={source} className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                                                <div className="w-1 h-1 rounded-full bg-emerald-500" />
                                                {source}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Chat Area */}
                    <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl">
                        <ScrollArea className="flex-1 p-6">
                            <div className="w-full space-y-8 pb-10">
                                {messages.map((msg) => (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={cn(
                                            "flex gap-4",
                                            msg.role === "user" ? "flex-row-reverse" : "flex-row"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-lg",
                                            msg.role === "user" 
                                                ? "bg-slate-100 dark:bg-slate-800 text-slate-600" 
                                                : "bg-primary text-white shadow-primary/20"
                                        )}>
                                            {msg.role === "user" ? <Zap className="w-5 h-5" /> : <Bot className="w-6 h-6" />}
                                        </div>
                                        <div className={cn(
                                            "flex flex-col gap-2 max-w-[80%]",
                                            msg.role === "user" ? "items-end" : "items-start"
                                        )}>
                                            <div className={cn(
                                                "p-4 rounded-3xl text-sm leading-relaxed shadow-md overflow-hidden",
                                                msg.role === "user"
                                                    ? "bg-[#FFF9E5] text-slate-900 rounded-tr-none shadow-md border border-amber-100"
                                                    : "bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm text-slate-900 dark:text-slate-100 rounded-tl-none border border-slate-200/50 dark:border-slate-800/50"
                                            )}>
                                                <div className="prose dark:prose-invert prose-slate max-w-none prose-sm 
                                                    prose-p:mb-2 prose-p:last:mb-0
                                                    prose-table:my-4 prose-table:border-collapse
                                                    prose-th:bg-slate-200/50 dark:prose-th:bg-slate-800/50 prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:font-black prose-th:text-[10px] prose-th:uppercase prose-th:tracking-widest
                                                    prose-td:px-4 prose-td:py-2 prose-td:border-t prose-td:border-slate-200 dark:prose-td:border-slate-800
                                                    prose-strong:text-black dark:prose-strong:text-white prose-strong:font-black">
                                                    <ReactMarkdown 
                                                        remarkPlugins={[remarkGfm]}
                                                        components={{
                                                            code({node, className, children, ...props}: any) {
                                                                const isChart = className === 'language-chart';
                                                                if (isChart) {
                                                                    try {
                                                                        const rawStr = String(children)
                                                                            .replace(/\n/g, ' ')
                                                                            .replace(/\s+/g, ' ')
                                                                            .trim();
                                                                        const chartData = JSON.parse(rawStr);
                                                                        return <AiChartRenderer config={chartData} />;
                                                                    } catch (e) {
                                                                        return <pre className="text-xs opacity-60 bg-slate-950 text-emerald-400 p-3 rounded-xl overflow-x-auto" {...props}>{children}</pre>;
                                                                    }
                                                                }
                                                                return <code className={className} {...props}>{children}</code>;
                                                            }
                                                        }}
                                                    >
                                                        {msg.content.replace(/\|\|/g, '|')} 
                                                    </ReactMarkdown>
                                                </div>
                                                
                                                {msg.sql && (
                                                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                                                        <details className="group">
                                                            <summary className="flex items-center gap-2 text-[10px] font-black text-primary cursor-pointer hover:underline uppercase tracking-widest list-none">
                                                                <Database className="w-3 h-3" />
                                                                Reasoning Steps
                                                                <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
                                                            </summary>
                                                            <div className="mt-3 space-y-3">
                                                                {msg.thoughts && (
                                                                    <div className="p-3 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] leading-relaxed italic border border-slate-300 dark:border-slate-700">
                                                                        <div className="font-bold mb-1 uppercase text-[9px] opacity-60 not-italic">AI Reasoning:</div>
                                                                        {msg.thoughts}
                                                                    </div>
                                                                )}
                                                                {msg.retryCount && msg.retryCount > 0 && (
                                                                    <div className="p-2 px-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[10px] flex items-center gap-2 border border-amber-100 dark:border-amber-900/30">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                                        AI Self-Healed: Fixed {msg.retryCount} database errors to get this answer.
                                                                    </div>
                                                                )}
                                                                <div className="p-3 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto border border-slate-800 shadow-inner">
                                                                    <div className="font-bold mb-1 uppercase text-[9px] text-slate-500 font-sans">Generated SQL:</div>
                                                                    {msg.sql}
                                                                </div>
                                                            </div>
                                                        </details>
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </motion.div>
                                ))}
                                {isLoading && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
                                        <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shrink-0 animate-pulse">
                                            <Bot className="w-6 h-6 text-white" />
                                        </div>
                                        <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-2xl rounded-tl-none flex items-center gap-3">
                                            <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Analyzing Database...</span>
                                        </div>
                                    </motion.div>
                                )}
                                <div ref={scrollRef} />
                            </div>
                        </ScrollArea>

                        {/* Input */}
                        <div className="p-6 bg-slate-50/50 dark:bg-slate-900/20 border-t border-slate-100 dark:border-slate-800">
                            <div className="relative group flex items-center">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSend(input)}
                                    placeholder={isLoading ? "AI is thinking..." : "Ask a question about your business data..."}
                                    className="w-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl py-4 pl-6 pr-24 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-lg placeholder:text-slate-400"
                                    disabled={isLoading}
                                />
                                <div className="absolute right-2 flex gap-2">
                                    {isLoading ? (
                                        <button
                                            onClick={handleStop}
                                            className="bg-rose-500 hover:bg-rose-600 text-white p-3 rounded-xl transition-all shadow-lg flex items-center gap-2 group/stop"
                                        >
                                            <Square className="w-4 h-4 fill-current" />
                                            <span className="text-xs font-bold pr-1">Stop</span>
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleSend(input)}
                                            disabled={!input.trim()}
                                            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white p-3 rounded-xl transition-all shadow-lg group/send"
                                        >
                                            <Send className="w-5 h-5 group-hover/send:translate-x-1 group-hover/send:-translate-y-1 transition-transform" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="mt-3 text-center">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">
                                    Enterprise AI · Read-Only Access · Live Data
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6'];

function AiChartRenderer({ config }: { config: any }) {
    const { type, title, data } = config;

    return (
        <div className="mt-6 mb-4 p-3 sm:p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            {title && <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">{title}</h3>}
            <div className="h-64 w-full overflow-x-auto">
                <ResponsiveContainer width="100%" height="100%">
                    {type === 'bar' ? (
                        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                            <XAxis dataKey="name" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                            <YAxis fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                            <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'bold' }}
                                cursor={{fill: '#f8fafc'}}
                            />
                            <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40}>
                                {data.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    ) : type === 'pie' ? (
                        <PieChart>
                            <Pie
                                data={data}
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={8}
                                dataKey="value"
                                stroke="none"
                            >
                                {data.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'bold' }}
                            />
                        </PieChart>
                    ) : (
                        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                            <XAxis dataKey="name" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                            <YAxis fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                            <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'bold' }}
                            />
                            <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                        </LineChart>
                    )}
                </ResponsiveContainer>
            </div>
        </div>
    );
}
