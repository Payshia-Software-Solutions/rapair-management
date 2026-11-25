"use client";

import React, { useEffect, useRef, useState } from "react";
import { Award, Loader2, UserCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { posLookupCustomer, posRegisterCustomer, DuplicateCustomerError, type PosCustomerMatch } from "@/lib/api/master-data";
import { usePOS } from "../../context/POSContext";
import { ToastAction } from "@/components/ui/toast";
import { printLoyaltyCard } from "@/lib/loyalty-card-print";

const EMPTY = { name: "", phone: "", nic: "", email: "", dob: "", address: "" };
const NIC_RE = /^(\d{9}[VvXx]|\d{12})$/;

/**
 * POS customer registration. The phone number is required and unique; NIC is optional and
 * unique. A number or NIC that is already registered offers to select that customer instead.
 * When the loyalty program is on, the customer can be enrolled in the same step.
 */
export function CustomerRegisterDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { setCustomers, setSelectedCustomer, loyaltyInfo, refreshLoyalty, locations, selectedLocation } = usePOS();
  const shopName = locations.find((l: any) => String(l.id) === String(selectedLocation))?.name || "";
  const { toast } = useToast();
  const [f, setF] = useState(EMPTY);
  const [enroll, setEnroll] = useState(true);
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [match, setMatch] = useState<PosCustomerMatch | null>(null);
  const [checking, setChecking] = useState(false);
  const seq = useRef(0);

  const loyaltyOn = !!loyaltyInfo?.enabled;

  useEffect(() => {
    if (open) { setF(EMPTY); setEnroll(true); setMore(false); setMatch(null); }
  }, [open]);

  const phoneDigits = f.phone.replace(/\D/g, "");
  const nicOk = f.nic.trim() === "" || NIC_RE.test(f.nic.trim());

  // Look up the phone / NIC while typing, so a returning customer is found before saving
  useEffect(() => {
    if (!open) return;
    const nic = NIC_RE.test(f.nic.trim()) ? f.nic.trim() : "";
    if (phoneDigits.length < 9 && !nic) { seq.current++; setMatch(null); setChecking(false); return; }
    const id = ++seq.current;
    setChecking(true);
    const t = setTimeout(async () => {
      const m = await posLookupCustomer(phoneDigits.length >= 9 ? f.phone : "", nic);
      if (id === seq.current) { setMatch(m); setChecking(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [open, f.phone, f.nic, phoneDigits.length]);

  const selectExisting = (m: PosCustomerMatch) => {
    setCustomers(prev => (prev.some(c => String(c.id) === String(m.id)) ? prev : [...prev, m]));
    setSelectedCustomer(String(m.id));
    onOpenChange(false);
    toast({ title: "Customer selected", description: `${m.name}${m.phone ? ` · ${m.phone}` : ""}` });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (match) return;
    setSaving(true);
    try {
      const { customer, loyalty } = await posRegisterCustomer({
        name: f.name.trim(), phone: f.phone, nic: f.nic.trim(), email: f.email.trim(),
        dob: f.dob, address: f.address.trim(), enroll_loyalty: loyaltyOn && enroll,
      });
      setCustomers(prev => [...prev, customer]);
      setSelectedCustomer(String(customer.id));
      onOpenChange(false);
      if (loyalty?.member_no) {
        const card = { member_no: loyalty.member_no, name: customer.name, phone: customer.phone, tier: loyalty.tier, program: loyaltyInfo?.program, shop: shopName };
        toast({
          title: "Customer registered",
          description: `${customer.name} joined the loyalty program · ${loyalty.member_no}${loyalty.tier ? ` (${loyalty.tier})` : ""}`,
          action: <ToastAction altText="Print member card" onClick={() => printLoyaltyCard(card)}>Print card</ToastAction>,
        });
      } else if (loyalty?.error) {
        toast({ title: "Customer registered, not enrolled", description: loyalty.error, variant: "destructive" });
      } else {
        toast({ title: "Customer registered", description: "Selected on this bill." });
      }
      refreshLoyalty();
    } catch (err: any) {
      if (err instanceof DuplicateCustomerError) setMatch(err.existing);
      else toast({ title: "Could not save the customer", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, [k]: e.target.value }));
  const canSave = f.name.trim() !== "" && phoneDigits.length >= 9 && nicOk && !match && !checking && !saving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" className="overflow-y-auto sm:rounded-lg p-6 bg-background">
        <DialogHeader>
          <DialogTitle>Register customer</DialogTitle>
          <DialogDescription>The phone number identifies the customer. One number or NIC belongs to one customer.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="rc-phone">Phone *</Label>
            <Input id="rc-phone" value={f.phone} onChange={set("phone")} inputMode="tel" placeholder="07X XXX XXXX" autoFocus required />
          </div>

          {match && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/10" role="status">
              <p className="font-medium">This {match.matched_on === "nic" ? "NIC" : "phone number"} is already registered</p>
              <p className="text-muted-foreground">{match.name}{match.phone ? ` · ${match.phone}` : ""}{match.nic ? ` · ${match.nic}` : ""}</p>
              <Button type="button" size="sm" className="mt-2" onClick={() => selectExisting(match)}>
                <UserCheck className="mr-2 h-4 w-4" aria-hidden="true" /> Select this customer
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="rc-name">Name *</Label>
            <Input id="rc-name" value={f.name} onChange={set("name")} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rc-nic">NIC</Label>
            <Input id="rc-nic" value={f.nic} onChange={e => setF(p => ({ ...p, nic: e.target.value.toUpperCase() }))} placeholder="991234567V or 199912345678"
              className="uppercase" aria-invalid={!nicOk} />
            {!nicOk && <p className="text-xs text-destructive">9 digits with V or X, or 12 digits.</p>}
          </div>

          {more ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="rc-email">Email</Label>
                <Input id="rc-email" type="email" value={f.email} onChange={set("email")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rc-dob">Date of birth</Label>
                <Input id="rc-dob" type="date" value={f.dob} onChange={set("dob")} max={new Date().toISOString().slice(0, 10)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rc-addr">Address</Label>
                <Input id="rc-addr" value={f.address} onChange={set("address")} />
              </div>
            </div>
          ) : (
            <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setMore(true)}>
              + Email, date of birth, address
            </button>
          )}

          {loyaltyOn && (
            <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
              <Checkbox checked={enroll} onCheckedChange={v => setEnroll(v === true)} className="mt-0.5" />
              <span className="text-sm">
                <span className="flex items-center gap-1.5 font-medium"><Award className="h-4 w-4 text-amber-500" aria-hidden="true" /> Join {loyaltyInfo?.program || "the loyalty program"}</span>
                <span className="text-muted-foreground text-xs">Earns points from this bill. Add the date of birth for birthday points.</span>
              </span>
            </label>
          )}

          <Button type="submit" disabled={!canSave} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (loyaltyOn && enroll ? "Register, enroll & select" : "Register & select")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
