"use client";

import React, { useState, useEffect } from "react";
import { Utensils, ShoppingBag, Store, ArrowRight, ChevronLeft, User, LayoutGrid, Clock, FilePlus, History, FileText, Undo2, Banknote } from "lucide-react";
import { usePOS } from "../context/POSContext";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export const OrderTypeSelector: React.FC = () => {
    const { 
        orderType,
        setOrderType, 
        orderTypeDialogOpen, 
        setOrderTypeDialogOpen,
        selectedLocation,
        locations,
        tables,
        stewards,
        heldOrders,
        refreshHeldOrders,
        loadPOSBill,
        setSelectedTable,
        setSelectedSteward,
        setLedgerDialogOpen,
        setReturnDialogOpen,
        setRefundDialogOpen
    } = usePOS();

    const [step, setStep] = useState<'choice' | 'mode' | 'table' | 'steward' | 'held'>('choice');
    const [localTable, setLocalTable] = useState<any>(null);
    const [localSteward, setLocalSteward] = useState<any>("none");
    
    useEffect(() => {
        if (orderTypeDialogOpen) {
            setStep('choice');
        }
    }, [orderTypeDialogOpen]);

    const currentLocation = locations.find(l => String(l.id) === String(selectedLocation));

    const types = [
        {
            id: 'dine_in',
            label: 'Dine In',
            icon: <Utensils className="w-8 h-8" />,
            description: 'Serve at table',
            color: 'indigo',
            visible: !currentLocation || Boolean(currentLocation.allow_dine_in)
        },
        {
            id: 'take_away',
            label: 'Take Away',
            icon: <ShoppingBag className="w-8 h-8" />,
            description: 'Packed for home',
            color: 'emerald',
            visible: !currentLocation || Boolean(currentLocation.allow_take_away)
        },
        {
            id: 'retail',
            label: 'Retail',
            icon: <Store className="w-8 h-8" />,
            description: 'Standard sale',
            color: 'amber',
            visible: !currentLocation || Boolean(currentLocation.allow_retail)
        }
    ].filter(t => t.visible);

    const handleSelectMode = (id: any) => {
        if (id === 'dine_in') {
            setStep('table');
        } else {
            setOrderType(id);
            setOrderTypeDialogOpen(false);
            setStep('choice');
        }
    };

    const handleSelectTable = (table: any) => {
        setLocalTable(table);
        setStep('steward');
    };

    const handleFinalizeDineIn = (stewardId: any) => {
        setOrderType('dine_in');
        setSelectedTable(localTable ? String(localTable.id) : null);
        setSelectedSteward(stewardId === 'none' ? null : stewardId);
        setOrderTypeDialogOpen(false);
        setStep('choice'); // Reset for next time
        setLocalTable(null);
        setLocalSteward("none");
    };

    return (
        <Dialog 
            open={orderTypeDialogOpen} 
            onOpenChange={(val) => {
                if (!val && !orderType) return;
                setOrderTypeDialogOpen(val);
                if (!val) setStep('choice');
            }}
        >
            <DialogContent 
                onInteractOutside={(e) => { if (!orderType) e.preventDefault(); }}
                onEscapeKeyDown={(e) => { if (!orderType) e.preventDefault(); }}
                className="w-full sm:max-w-3xl h-[100dvh] sm:h-[85vh] p-0 flex flex-col overflow-hidden border-none shadow-2xl rounded-none sm:rounded-[2.5rem] bg-white dark:bg-slate-950"
            >
                <div className="bg-slate-900 p-8 text-white relative overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
                        {step === 'choice' ? <FilePlus className="w-24 h-24" /> : 
                         step === 'held' ? <Clock className="w-24 h-24" /> :
                         step === 'mode' ? <Store className="w-24 h-24" /> : 
                         step === 'table' ? <LayoutGrid className="w-24 h-24" /> : <User className="w-24 h-24" />}
                    </div>
                    <div className="relative z-10">
                        <DialogHeader>
                            <div className="flex items-center gap-3 mb-2">
                                {step !== 'mode' && step !== 'choice' && (
                                    <button 
                                        onClick={() => setStep(step === 'table' ? 'mode' : (step === 'held' ? 'choice' : 'table'))}
                                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                )}
                                <DialogTitle className="text-2xl font-black uppercase tracking-tight leading-none">
                                    {step === 'choice' ? "Get Started" : 
                                     step === 'held' ? "Recent Bills" :
                                     step === 'mode' ? "New Order" : 
                                     step === 'table' ? "Select Table" : "Assign Steward"}
                                </DialogTitle>
                            </div>
                            <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest pl-1">
                                {step === 'choice' ? "Choose your transaction type" :
                                 step === 'held' ? "Select a bill to resume" :
                                 step === 'mode' ? "Select Service Mode" : 
                                 step === 'table' ? "Choose available table" : `Steward for ${localTable?.name}`}
                            </p>
                        </DialogHeader>
                    </div>
                </div>

                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                    {step === 'choice' && (
                        <>
                        <div className="grid gap-4">
                            <button
                                onClick={() => setStep('mode')}
                                className="group relative w-full p-8 bg-indigo-50/50 dark:bg-indigo-500/5 rounded-[2.5rem] border-2 border-transparent hover:border-indigo-500 hover:bg-white dark:hover:bg-slate-900 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all text-left"
                            >
                                <div className="flex items-center gap-6">
                                    <div className="p-5 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none group-hover:scale-110 transition-transform">
                                        <FilePlus className="w-10 h-10" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">New Transaction</h3>
                                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Start a fresh bill from scratch</p>
                                    </div>
                                    <ArrowRight className="w-6 h-6 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                                </div>
                            </button>

                            <button
                                onClick={() => {
                                    setStep('held');
                                    refreshHeldOrders();
                                }}
                                className="group relative w-full p-8 bg-orange-50/50 dark:bg-orange-500/5 rounded-[2.5rem] border-2 border-transparent hover:border-orange-500 hover:bg-white dark:hover:bg-slate-900 hover:shadow-2xl hover:shadow-orange-500/10 transition-all text-left"
                            >
                                <div className="flex items-center gap-6">
                                    <div className="p-5 rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-200 dark:shadow-none group-hover:scale-110 transition-transform">
                                        <History className="w-10 h-10" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Resume Bill</h3>
                                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Continue a previously held order</p>
                                    </div>
                                    <ArrowRight className="w-6 h-6 text-slate-300 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                                </div>
                                {heldOrders.length > 0 && (
                                    <span className="absolute top-6 right-6 px-3 py-1 bg-orange-500 text-white text-[10px] font-black rounded-full animate-pulse">
                                        {heldOrders.length} ACTIVE
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Management Hub Section */}
                        <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 px-2">Management Hub</h4>
                            <div className="grid grid-cols-3 gap-3">
                                <button
                                    onClick={() => {
                                        setOrderTypeDialogOpen(false);
                                        setLedgerDialogOpen(true);
                                    }}
                                    className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all active:scale-95 group"
                                >
                                    <div className="p-3 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl mb-2 group-hover:scale-110 transition-transform">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <span className="text-[9px] font-black uppercase tracking-tight text-slate-600 dark:text-slate-300">Summary</span>
                                </button>

                                <button
                                    onClick={() => {
                                        setOrderTypeDialogOpen(false);
                                        setReturnDialogOpen(true);
                                    }}
                                    className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all active:scale-95 group"
                                >
                                    <div className="p-3 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-2xl mb-2 group-hover:scale-110 transition-transform">
                                        <Undo2 className="w-5 h-5" />
                                    </div>
                                    <span className="text-[9px] font-black uppercase tracking-tight text-slate-600 dark:text-slate-300">Return</span>
                                </button>

                                <button
                                    onClick={() => {
                                        setOrderTypeDialogOpen(false);
                                        setRefundDialogOpen(true);
                                    }}
                                    className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all active:scale-95 group"
                                >
                                    <div className="p-3 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl mb-2 group-hover:scale-110 transition-transform">
                                        <Banknote className="w-5 h-5" />
                                    </div>
                                    <span className="text-[9px] font-black uppercase tracking-tight text-slate-600 dark:text-slate-300">Refund</span>
                                </button>
                            </div>
                        </div>
                        </>
                    )}

                    {step === 'held' && (
                        <div className="space-y-3">
                            {heldOrders.length === 0 ? (
                                <div className="py-20 text-center flex flex-col items-center gap-6 opacity-40">
                                    <div className="p-8 rounded-full bg-slate-100 dark:bg-slate-800">
                                        <Clock className="w-16 h-16" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xl font-black uppercase tracking-tight text-slate-400">No held bills</p>
                                        <p className="text-xs font-bold text-slate-500 italic">Start a new transaction instead</p>
                                    </div>
                                    <Button variant="outline" className="rounded-full px-8" onClick={() => setStep('choice')}>
                                        Go Back
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                    {heldOrders.map((order) => (
                                        <button 
                                          key={order.id}
                                          onClick={() => {
                                              loadPOSBill(order.id);
                                              setOrderTypeDialogOpen(false);
                                              setStep('choice');
                                          }}
                                          className="group w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border-2 border-transparent hover:border-orange-500 hover:bg-white dark:hover:bg-slate-800 transition-all text-left flex justify-between items-center"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-3 rounded-xl bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform shadow-sm font-black text-xs">
                                                    #{order.id}
                                                </div>
                                                <div className="space-y-0.5 min-w-0">
                                                    <h4 className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter text-sm truncate">{order.customer_name}</h4>
                                                    <div className="flex flex-wrap items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                        <span>{order.order_type?.replace('_', ' ')}</span>
                                                        {order.table_name && (
                                                            <>
                                                                <div className="w-1 h-1 rounded-full bg-slate-300" />
                                                                <span className="text-indigo-500">{order.table_name}</span>
                                                            </>
                                                        )}
                                                        {(() => {
                                                            const steward = stewards.find(s => String(s.id) === String(order.steward_id));
                                                            const name = order.steward_name || steward?.name;
                                                            if (!name) return null;
                                                            return (
                                                                <>
                                                                    <div className="w-1 h-1 rounded-full bg-slate-300" />
                                                                    <span className="text-emerald-500 uppercase">{name}</span>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="text-sm font-black text-slate-800 dark:text-slate-50 tabular-nums">LKR {Number(order.grand_total).toFixed(2)}</div>
                                                <div className="text-[9px] font-black text-orange-500 uppercase tracking-wider opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all">
                                                    Resume
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    {step === 'mode' && (
                        <div className="space-y-3">
                            {types.map((type) => (
                                <button
                                    key={type.id}
                                    onClick={() => handleSelectMode(type.id)}
                                    className="group w-full p-5 bg-slate-50 dark:bg-slate-900 rounded-[1.5rem] border-2 border-transparent transition-all hover:border-indigo-500 hover:bg-white dark:hover:bg-slate-800 hover:shadow-xl hover:shadow-indigo-500/10 active:scale-[0.98] text-left"
                                >
                                    <div className="flex items-center gap-5">
                                        <div className={`p-4 rounded-xl bg-${type.color}-100 dark:bg-${type.color}-500/10 text-${type.color}-600 dark:text-${type.color}-400 group-hover:scale-110 transition-transform shadow-sm`}>
                                            {type.icon}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                                                {type.label}
                                            </h3>
                                            <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mt-1">
                                                {type.description}
                                            </p>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {step === 'table' && (
                        <div className="space-y-3">
                            <button
                                onClick={() => handleSelectTable({ id: 'none', name: 'No Table' })}
                                className="w-full p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border-2 border-transparent hover:border-emerald-500 hover:bg-white dark:hover:bg-slate-800 transition-all text-left flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                                        <LayoutGrid className="w-5 h-5" />
                                    </div>
                                    <span className="font-bold text-slate-600 dark:text-slate-400 italic">None / No Table</span>
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500" />
                            </button>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {tables
                                    .filter(t => !selectedLocation || !t.location_id || String(t.location_id) === String(selectedLocation))
                                    .map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => handleSelectTable(t)}
                                        className="flex flex-col items-center justify-center p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border-2 border-transparent hover:border-indigo-500 hover:bg-white dark:hover:bg-slate-800 hover:shadow-lg transition-all active:scale-95 group"
                                    >
                                        <div className="p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm mb-2 group-hover:text-indigo-500 transition-colors">
                                            <LayoutGrid className="w-5 h-5" />
                                        </div>
                                        <span className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight text-[10px] truncate w-full text-center px-1">{t.name}</span>
                                    </button>
                                ))}
                            </div>
                            {tables.length === 0 && (
                                <div className="py-12 text-center">
                                    <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">No tables available</p>
                                    <p className="text-slate-500 text-[10px] mt-2 italic">Check location settings</p>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'steward' && (
                        <div className="space-y-2">
                            <button
                                onClick={() => handleFinalizeDineIn('none')}
                                className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border-2 border-transparent hover:border-emerald-500 hover:bg-white dark:hover:bg-slate-800 transition-all text-left flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                                        <User className="w-5 h-5" />
                                    </div>
                                    <span className="font-bold text-slate-600 dark:text-slate-400 italic">None / Skip Steward</span>
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500" />
                            </button>

                            {stewards.map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => handleFinalizeDineIn(String(s.id))}
                                    className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border-2 border-transparent hover:border-indigo-500 hover:bg-white dark:hover:bg-slate-800 transition-all text-left flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl font-black text-xs uppercase">
                                            {s.name.substring(0, 2)}
                                        </div>
                                        <span className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{s.name}</span>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500" />
                                </button>
                            ))}

                            {stewards.length === 0 && (
                                <div className="py-8 text-center">
                                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest italic">No stewards found</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 text-center">
                    <div className="flex items-center justify-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${step === 'choice' ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                        <div className={`w-1.5 h-1.5 rounded-full ${step === 'held' ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                        <div className={`w-1.5 h-1.5 rounded-full ${step === 'mode' ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                        <div className={`w-1.5 h-1.5 rounded-full ${step === 'table' ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                        <div className={`w-1.5 h-1.5 rounded-full ${step === 'steward' ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
