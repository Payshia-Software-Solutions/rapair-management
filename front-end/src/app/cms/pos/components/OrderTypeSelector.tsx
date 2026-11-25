"use client";

import React, { useState, useEffect } from "react";
import { Utensils, ShoppingBag, Store, ArrowRight, ChevronLeft, User, LayoutGrid, Clock, FilePlus, History, FileText, Undo2, Banknote, MoreHorizontal, LayoutDashboard, Home, Printer } from "lucide-react";
import { usePOS } from "../context/POSContext";
import { fetchPosDayLedger } from "@/lib/api";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { currentUserId } from "@/lib/session";
import { posProfileOf } from "@/lib/pos-profiles";
import { PosFloorView } from "./PosFloorView";

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
        setRefundDialogOpen,
        setPendingInvoicesDialogOpen,
        setReservationDialogOpen,
        setGuestPrintSelectionOpen,
        setGuestPrintOrderId,
        setDayLedger,
        setLoadingLedger,
      printKOT,
      canCheckout
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
    // Restaurant profile with a saved floor plan: Dine-in tables are picked on the plan
    // (plan or cards view; cards when no plan is drawn)
    const useFloorPlan = posProfileOf(currentLocation).floorPlan;
    const floorStep = step === 'table' && useFloorPlan;

    const types = [
        {
            id: 'dine_in',
            label: 'Dine In',
            icon: <Utensils className="w-6 h-6" />,
            description: 'Table service',
            color: 'indigo',
            visible: !currentLocation || Boolean(currentLocation.allow_dine_in)
        },
        {
            id: 'take_away',
            label: 'Take Away',
            icon: <ShoppingBag className="w-6 h-6" />,
            description: 'Collection',
            color: 'emerald',
            visible: !currentLocation || Boolean(currentLocation.allow_take_away)
        },
        {
            id: 'retail',
            label: 'Retail',
            icon: <Store className="w-6 h-6" />,
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
        // Stewards always serve their own tables: assign them and skip the steward list
        if (!canCheckout) {
            const me = currentUserId();
            finalizeDineIn(table, me || 'none');
            return;
        }
        setStep('steward');
    };

    const handleFinalizeDineIn = (stewardId: any) => finalizeDineIn(localTable, stewardId);

    function finalizeDineIn(table: any, stewardId: any) {
        setOrderType('dine_in');
        setSelectedTable(table ? String(table.id) : null);
        setSelectedSteward(stewardId === 'none' ? null : stewardId);
        setOrderTypeDialogOpen(false);
        setStep('choice'); 
        setLocalTable(null);
        setLocalSteward("none");
    }

    return (
        <Dialog 
            open={orderTypeDialogOpen} 
            onOpenChange={(val) => {
                if (!val && !orderType) return;
                setOrderTypeDialogOpen(val);
                if (!val) setStep('choice');
            }}
        >
            <DialogContent size="lg" 
                onInteractOutside={(e) => { if (!orderType) e.preventDefault(); }}
                onEscapeKeyDown={(e) => { if (!orderType) e.preventDefault(); }}
                className={`p-0 gap-0 flex flex-col overflow-hidden sm:rounded-lg ${floorStep ? "max-w-[min(1200px,96vw)] w-[96vw] h-[90vh]" : ""}`}
            >
                <div className="pl-5 pr-14 pt-5 pb-3 border-b border-border shrink-0">
                    <DialogHeader>
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                {step !== 'choice' && (
                                    <button 
                                        onClick={() => setStep(step === 'table' ? 'mode' : (step === 'held' || step === 'mode' ? 'choice' : 'table'))}
                                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                                    >
                                        <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                                    </button>
                                )}
                                <div>
                                    <DialogTitle>
                                        {step === 'choice' ? "Get Started" : 
                                         step === 'held' ? "Recent Bills" :
                                         step === 'mode' ? "New Order" : 
                                         step === 'table' ? "Select Table" : "Assign Steward"}
                                    </DialogTitle>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-0.5">
                                        {step === 'choice' ? "Choose your transaction type" :
                                         step === 'held' ? "Select a bill to resume" :
                                         step === 'mode' ? "Select service mode" : 
                                         step === 'table' ? "Choose available table" : `Steward for ${localTable?.name}`}
                                    </p>
                                </div>
                            </div>
                            
                            {step === 'choice' && (
                                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-900 rounded-full">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 tracking-wider">SYSTEM ACTIVE</span>
                                </div>
                            )}
                        </div>
                    </DialogHeader>
                </div>

                <div className="p-5 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    {step === 'choice' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <button
                                    onClick={() => setStep('mode')}
                                    className="group relative flex flex-col p-4 bg-indigo-50/30 dark:bg-indigo-500/5 rounded-lg border-2 border-transparent hover:border-indigo-500 hover:bg-white dark:hover:bg-slate-900 transition-all text-left shadow-sm hover:shadow-xl hover:shadow-indigo-500/10"
                                >
                                    <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-indigo-600 text-white mb-3 group-hover:scale-110 transition-transform">
                                        <FilePlus className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-base font-semibold text-foreground">New Transaction</h3>
                                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mt-1">Start a fresh bill</p>
                                    </div>
                                    <ArrowRight className="absolute bottom-4 right-4 w-5 h-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                                </button>

                                <button
                                    onClick={() => {
                                        setStep('held');
                                        refreshHeldOrders();
                                    }}
                                    className="group relative flex flex-col p-4 bg-orange-50/30 dark:bg-orange-500/5 rounded-lg border-2 border-transparent hover:border-orange-500 hover:bg-white dark:hover:bg-slate-900 transition-all text-left shadow-sm hover:shadow-xl hover:shadow-orange-500/10"
                                >
                                    <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-orange-500 text-white mb-3 group-hover:scale-110 transition-transform">
                                        <History className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-base font-semibold text-foreground">Resume Bill</h3>
                                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mt-1">Continue held order</p>
                                    </div>
                                    <ArrowRight className="absolute bottom-4 right-4 w-5 h-5 text-slate-300 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                                    {heldOrders.length > 0 && (
                                        <span className="absolute top-4 right-4 px-2 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded-full">
                                            {heldOrders.length}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {canCheckout && (
<div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="h-[1px] flex-1 bg-slate-100 dark:bg-slate-800" />
                                    <span className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">Management Hub</span>
                                    <div className="h-[1px] flex-1 bg-slate-100 dark:bg-slate-800" />
                                </div>

                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                                    {[
                                        { label: 'ERP Hub', icon: <LayoutDashboard className="w-5 h-5" />, color: 'indigo', action: () => { window.location.href = '../../dashboard'; } },
                                        { label: 'Summary', icon: <FileText className="w-5 h-5" />, color: 'blue', action: async () => { 
                                            setOrderTypeDialogOpen(false); 
                                            setLedgerDialogOpen(true); 
                                            setLoadingLedger(true);
                                            try {
                                                const data = await fetchPosDayLedger(selectedLocation);
                                                setDayLedger(data);
                                            } finally {
                                                setLoadingLedger(false);
                                            }
                                        } },
                                        { label: 'Pending', icon: <FileText className="w-5 h-5" />, color: 'amber', action: () => { setOrderTypeDialogOpen(false); setPendingInvoicesDialogOpen(true); } },
                                        { label: 'Return', icon: <Undo2 className="w-5 h-5" />, color: 'purple', action: () => { setOrderTypeDialogOpen(false); setReturnDialogOpen(true); } },
                                        { label: 'Refund', icon: <Banknote className="w-5 h-5" />, color: 'rose', action: () => { setOrderTypeDialogOpen(false); setRefundDialogOpen(true); } },
                                        { label: 'Reservation', icon: <Home className="w-5 h-5" />, color: 'sky', action: () => { setOrderTypeDialogOpen(false); setReservationDialogOpen(true); } }
                                    ].map((item, idx) => (
                                        <button
                                            key={idx}
                                            onClick={item.action}
                                            className="flex flex-col items-center justify-center p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all group"
                                        >
                                            <div className={`p-3 bg-${item.color}-50 dark:bg-${item.color}-500/10 text-${item.color}-600 dark:text-${item.color}-400 rounded-md mb-1.5 group-hover:scale-110 transition-transform`}>
                                                {item.icon}
                                            </div>
                                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
)}
                        </div>
                    )}

                    {step === 'held' && (
                        <div className="grid grid-cols-1 gap-3">
                            {heldOrders.length === 0 ? (
                                <div className="py-8 text-center">
                                    <div className="relative inline-block mb-4">
                                        <Clock className="w-12 h-12 text-slate-200 dark:text-slate-800" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-2 h-2 bg-orange-500 rounded-full animate-ping" />
                                        </div>
                                    </div>
                                    <p className="text-lg font-bold text-slate-500 dark:text-slate-400">No held bills found</p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">Bills you put on hold will appear here.</p>
                                    <div className="flex flex-col gap-2 max-w-[200px] mx-auto">
                                        <Button 
                                            variant="outline" 
                                            className="rounded-md border-slate-200 dark:border-slate-800 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-600 hover:border-orange-200 transition-all"
                                            onClick={() => refreshHeldOrders()}
                                        >
                                            Retry Sync
                                        </Button>
                                        <Button variant="ghost" className="text-slate-400 hover:text-slate-600" onClick={() => setStep('choice')}>
                                            Go Back
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                heldOrders.map((order) => (
                                    <div 
                                      key={order.id}
                                      onClick={() => {
                                          loadPOSBill(order.id);
                                          setOrderTypeDialogOpen(false);
                                          setStep('choice');
                                      }}
                                      className="group p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-orange-500 hover:shadow-lg transition-all flex items-center justify-between cursor-pointer"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 flex items-center justify-center rounded-md bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-black text-xs shrink-0">
                                                #{order.id}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-900 dark:text-white text-sm">{order.customer_name}</h4>
                                                <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                                                    {order.order_type?.replace('_', ' ')} {order.table_name && `• ${order.table_name}`}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 text-right">
                                            <div className="flex flex-col items-end">
                                                <div className="text-sm font-black text-slate-900 dark:text-white tabular-nums">LKR {Number(order.grand_total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                <div className="flex items-center gap-1.5 mt-1.5">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            void printKOT(order.id, true);
                                                        }}
                                                        className="h-7 px-2 text-[10px] font-black uppercase tracking-tight gap-1 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/30 dark:border-amber-700/40 dark:text-amber-400 z-10"
                                                        title="Reprint Full KOT"
                                                    >
                                                        <Utensils className="w-3 h-3" />
                                                        <span>KOT</span>
                                                    </Button>
                                                    <Button 
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            setGuestPrintOrderId(order.id);
                                                            setGuestPrintSelectionOpen(true);
                                                        }}
                                                        className="h-7 px-2 text-[10px] font-black uppercase tracking-tight gap-1 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/30 dark:border-blue-700/40 dark:text-blue-400 z-10"
                                                        title="Print Guest Bill"
                                                    >
                                                        <Printer className="w-3 h-3" />
                                                        <span>Bill</span>
                                                    </Button>
                                                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-orange-500 group-hover:translate-x-1 transition-all ml-1" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {step === 'mode' && (
                        <div className="grid grid-cols-1 gap-3">
                            {types.map((type) => (
                                <button
                                    key={type.id}
                                    onClick={() => handleSelectMode(type.id)}
                                    className="group flex items-center p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-indigo-500 hover:shadow-lg transition-all text-left"
                                >
                                    <div className={`p-3 rounded-md bg-${type.color}-100/50 dark:bg-${type.color}-500/10 text-${type.color}-600 dark:text-${type.color}-400 group-hover:scale-110 transition-transform mr-4`}>
                                        {type.icon}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{type.label}</h3>
                                        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{type.description}</p>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-slate-200 group-hover:text-indigo-500 transition-colors" />
                                </button>
                            ))}
                        </div>
                    )}

                    {floorStep && (
                        <div className="h-[calc(90vh-120px)]">
                            <PosFloorView
                                locationId={selectedLocation}
                                heldOrders={heldOrders}
                                onRefresh={() => refreshHeldOrders()}
                                onPickFree={(t) => handleSelectTable(t)}
                                onPickBusy={(orderId) => { loadPOSBill(orderId); setOrderTypeDialogOpen(false); setStep('choice'); }}
                                onSkip={() => handleSelectTable({ id: 'none', name: 'No Table' })}
                            />
                        </div>
                    )}

                    {step === 'table' && !useFloorPlan && (
                        <div className="space-y-4">
                            <button
                                onClick={() => handleSelectTable({ id: 'none', name: 'No Table' })}
                                className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-md border border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:bg-white transition-all text-left flex items-center gap-3 group"
                            >
                                <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-lg">
                                    <LayoutGrid className="w-4 h-4" />
                                </div>
                                <span className="text-sm font-bold text-slate-500">None / Skip Table</span>
                            </button>

                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {tables
                                    .filter(t => !selectedLocation || !t.location_id || String(t.location_id) === String(selectedLocation))
                                    .map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => handleSelectTable(t)}
                                        className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-indigo-500 hover:shadow-lg transition-all group"
                                    >
                                        <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">
                                            <LayoutGrid className="w-4 h-4" />
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200 truncate w-full text-center">{t.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 'steward' && (
                        <div className="space-y-3">
                            <button
                                onClick={() => handleFinalizeDineIn('none')}
                                className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-md border border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:bg-white transition-all text-left flex items-center gap-3 group"
                            >
                                <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-lg">
                                    <User className="w-4 h-4" />
                                </div>
                                <span className="text-sm font-bold text-slate-500">Skip Steward</span>
                            </button>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {stewards.map((s) => (
                                    <button
                                        key={s.id}
                                        onClick={() => handleFinalizeDineIn(String(s.id))}
                                        className="flex items-center p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-indigo-500 transition-all group"
                                    >
                                        <div className="w-10 h-10 flex items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 font-bold text-xs mr-3">
                                            {s.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{s.name}</span>
                                        <ArrowRight className="w-4 h-4 ml-auto text-slate-200 group-hover:text-indigo-500" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="py-2.5 border-t border-border flex justify-center shrink-0">
                    <div className="flex gap-1.5">
                        {['choice', 'mode', 'held', 'table', 'steward'].map((s) => (
                            <div 
                                key={s}
                                className={`h-1 rounded-full transition-all duration-300 ${
                                    step === s ? 'w-6 bg-indigo-500' : 'w-1.5 bg-slate-300 dark:bg-slate-700'
                                }`} 
                            />
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
