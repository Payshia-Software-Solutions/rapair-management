"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, User, Home, Search, ChevronLeft, Plus, Minus, ShoppingCart, Trash2 } from "lucide-react";
import { api as apiHelper } from "@/lib/api";
import { usePOS } from "../../context/POSContext";
import { Input } from "@/components/ui/input";

export const ReservationSelectionDialog: React.FC = () => {
    const { 
        reservationDialogOpen, 
        setReservationDialogOpen, 
        handleAddToReservation,
        submitting,
        inventory
    } = usePOS();
    
    const [reservations, setReservations] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [step, setStep] = useState<'guest' | 'items'>('guest');
    const [selectedRes, setSelectedRes] = useState<any>(null);
    const [localCart, setLocalCart] = useState<any[]>([]);
    const [itemSearchQuery, setItemSearchQuery] = useState("");

    useEffect(() => {
        if (reservationDialogOpen) {
            fetchReservations();
            setStep('guest');
            setSelectedRes(null);
            setLocalCart([]);
        }
    }, [reservationDialogOpen]);

    const fetchReservations = async () => {
        setLoading(true);
        try {
            const res = await apiHelper("/api/hotel/reservations?status=CheckedIn");
            const data = await res.json();
            setReservations(data.data || []);
        } catch (err) {
            console.error("Failed to fetch reservations", err);
        } finally {
            setLoading(false);
        }
    };

    const filteredReservations = reservations.filter(r => 
        r.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.room_number?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredItems = inventory.filter(item => 
        item.part_name?.toLowerCase().includes(itemSearchQuery.toLowerCase()) ||
        item.sku?.toLowerCase().includes(itemSearchQuery.toLowerCase())
    );

    const addToLocalCart = (item: any) => {
        setLocalCart(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) {
                return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { 
                id: item.id, 
                description: item.part_name, 
                quantity: 1, 
                unit_price: Number(item.price),
                item_type: item.item_type || 'Part',
                discount: 0
            }];
        });
    };

    const updateLocalQty = (id: number, delta: number) => {
        setLocalCart(prev => prev.map(i => {
            if (i.id === id) {
                const newQty = Math.max(1, i.quantity + delta);
                return { ...i, quantity: newQty };
            }
            return i;
        }));
    };

    const removeFromLocalCart = (id: number) => {
        setLocalCart(prev => prev.filter(i => i.id !== id));
    };

    const cartTotal = localCart.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0);

    return (
        <Dialog open={reservationDialogOpen} onOpenChange={setReservationDialogOpen}>
            <DialogContent className="w-full sm:max-w-4xl h-[100dvh] sm:h-[90vh] rounded-none sm:rounded-3xl p-0 border-none overflow-hidden shadow-2xl bg-background flex flex-col">
                <DialogHeader className="p-6 pb-2 border-b">
                    <div className="flex items-center gap-4">
                        {step === 'items' && (
                            <Button variant="ghost" size="icon" onClick={() => setStep('guest')} className="rounded-full">
                                <ChevronLeft className="w-6 h-6" />
                            </Button>
                        )}
                        <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                            <Home className="w-6 h-6 text-primary" />
                            {step === 'guest' ? "Select Guest Reservation" : `Adding Items for ${selectedRes?.customer_name}`}
                        </DialogTitle>
                    </div>
                </DialogHeader>

                {step === 'guest' ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-6 py-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Search by name or room..." 
                                    className="pl-10 h-12 rounded-xl bg-slate-50 dark:bg-slate-900 border-none"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Loading active guests...</p>
                                </div>
                            ) : filteredReservations.length === 0 ? (
                                <div className="text-center py-20">
                                    <p className="text-muted-foreground font-bold italic">No checked-in guests found.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {filteredReservations.map((res) => (
                                        <button
                                            key={res.id}
                                            onClick={() => {
                                                setSelectedRes(res);
                                                setStep('items');
                                            }}
                                            className="w-full p-4 rounded-2xl border border-border bg-slate-50 dark:bg-slate-900 hover:border-primary hover:bg-primary/5 transition-all flex items-center justify-between group"
                                        >
                                            <div className="flex items-center gap-4 text-left">
                                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                                    <User className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <div className="font-black text-lg group-hover:text-primary transition-colors">{res.customer_name}</div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-xs font-black uppercase bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400">
                                                            Room {res.room_number}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                        {/* Item Picker */}
                        <div className="flex-1 flex flex-col border-r overflow-hidden">
                            <div className="p-4 border-b">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="Search products..." 
                                        className="pl-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border-none"
                                        value={itemSearchQuery}
                                        onChange={e => setItemSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {filteredItems.map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => addToLocalCart(item)}
                                            className="p-3 rounded-xl border border-border bg-white dark:bg-slate-950 hover:border-primary transition-all text-left flex flex-col h-full group"
                                        >
                                            <div className="flex-1">
                                                <p className="font-bold text-xs line-clamp-2 mb-1 group-hover:text-primary transition-colors">{item.part_name}</p>
                                                <p className="text-[10px] text-muted-foreground uppercase font-black">{item.sku}</p>
                                            </div>
                                            <div className="mt-3 flex justify-between items-end">
                                                <p className="font-black text-xs text-primary">LKR {Number(item.price).toLocaleString()}</p>
                                                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                                    <Plus className="w-4 h-4" />
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Dialog Cart */}
                        <div className="w-full md:w-[350px] flex flex-col bg-slate-50 dark:bg-slate-900/30 overflow-hidden">
                            <div className="p-4 border-b bg-white dark:bg-slate-950 flex items-center gap-2">
                                <ShoppingCart className="w-4 h-4 text-primary" />
                                <span className="text-xs font-black uppercase tracking-widest">Pending Bill</span>
                                <Badge variant="secondary" className="ml-auto">{localCart.length} items</Badge>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                {localCart.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center opacity-30 py-20">
                                        <ShoppingCart className="w-12 h-12 mb-4" />
                                        <p className="text-xs font-black uppercase tracking-widest">Cart is empty</p>
                                    </div>
                                ) : (
                                    localCart.map(item => (
                                        <div key={item.id} className="p-3 bg-white dark:bg-slate-950 rounded-xl border border-border shadow-sm">
                                            <div className="flex justify-between items-start mb-2">
                                                <p className="text-xs font-bold flex-1 pr-2 line-clamp-2">{item.description}</p>
                                                <button onClick={() => removeFromLocalCart(item.id)} className="text-muted-foreground hover:text-rose-500">
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                                                    <button onClick={() => updateLocalQty(item.id, -1)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white dark:hover:bg-slate-700 transition-all text-primary">
                                                        <Minus className="w-3 h-3" />
                                                    </button>
                                                    <span className="text-xs font-black min-w-[20px] text-center">{item.quantity}</span>
                                                    <button onClick={() => updateLocalQty(item.id, 1)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white dark:hover:bg-slate-700 transition-all text-primary">
                                                        <Plus className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                <p className="text-xs font-black">LKR {(item.quantity * item.unit_price).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="p-6 bg-white dark:bg-slate-950 border-t space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Subtotal</span>
                                    <span className="text-xl font-black tracking-tighter">LKR {cartTotal.toLocaleString()}</span>
                                </div>
                                <Button 
                                    className="w-full h-14 rounded-xl font-black uppercase tracking-widest text-xs" 
                                    disabled={localCart.length === 0 || submitting}
                                    onClick={() => handleAddToReservation(selectedRes.id, localCart)}
                                >
                                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                                    Charge to Room
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

// Simple Badge component if not available
const Badge: React.FC<{ children: React.ReactNode, variant?: string, className?: string }> = ({ children, variant, className }) => (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${variant === 'secondary' ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' : 'bg-primary/10 text-primary'} ${className}`}>
        {children}
    </span>
);

const ArrowRight: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
);
