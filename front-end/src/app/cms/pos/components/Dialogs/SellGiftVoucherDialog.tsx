"use client";

import React from "react";
import { Banknote, CreditCard, Loader2, Printer, Store, Ticket, Check } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { giftVoucherApi, type GiftVoucher } from "@/lib/api/gift-vouchers";
import { usePOS } from "../../context/POSContext";
import { printGiftVoucher } from "@/lib/gift-voucher-print";

const QUICK = [1000, 2500, 5000, 10000];
const METHODS = [
  { key: "Cash", icon: Banknote },
  { key: "Card", icon: CreditCard },
  { key: "Bank Transfer", icon: Store },
] as const;

function inOneYear() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split("T")[0];
}

/** Sell a gift voucher at the till: customer pays now, the voucher pays bills later. */
export const SellGiftVoucherDialog: React.FC<{ open: boolean; onOpenChange: (v: boolean) => void }> = ({ open, onOpenChange }) => {
  const { toast } = useToast();
  const { selectedLocation, selectedCustomer, customers, locations } = usePOS();
  const [value, setValue] = React.useState<number>(0);
  const [method, setMethod] = React.useState<"Cash" | "Card" | "Bank Transfer">("Cash");
  const [expires, setExpires] = React.useState(inOneYear());
  const [recipient, setRecipient] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [sold, setSold] = React.useState<GiftVoucher | null>(null);

  React.useEffect(() => {
    if (open) {
      setValue(0); setMethod("Cash"); setExpires(inOneYear());
      setRecipient(""); setPhone(""); setMessage(""); setSold(null);
    }
  }, [open]);

  const buyer = customers.find((c: any) => String(c.id) === String(selectedCustomer));
  const shopName = locations.find((l: any) => String(l.id) === String(selectedLocation))?.name || "";

  const sell = async () => {
    if (!(value > 0)) { toast({ title: "Enter the voucher value", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const v = await giftVoucherApi.sell({
        value, payment_method: method, expires_at: expires || undefined,
        recipient_name: recipient, recipient_phone: phone, message,
        customer_id: selectedCustomer || null, location_id: selectedLocation || null,
      });
      setSold(v);
      toast({ title: "Gift voucher sold", description: `${v.code} · LKR ${Number(v.initial_value).toLocaleString()}` });
    } catch (e: any) {
      toast({ title: "Could not sell the voucher", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" className="p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Ticket className="w-5 h-5 text-primary" aria-hidden="true" /> Sell gift voucher</DialogTitle>
          <DialogDescription>The customer pays now. The voucher pays for bills later, in full or in parts.</DialogDescription>
        </DialogHeader>

        {sold ? (
          <div className="space-y-4 py-2 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
              <Check className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Voucher code</p>
              <p className="text-2xl font-black font-mono tracking-wider select-all">{sold.code}</p>
              <p className="text-sm font-semibold mt-1">LKR {Number(sold.initial_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              {sold.expires_at && <p className="text-xs text-muted-foreground">Valid until {sold.expires_at}</p>}
            </div>
            <DialogFooter className="gap-2 sm:justify-center">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
              <Button onClick={() => printGiftVoucher(sold, shopName)}><Printer className="w-4 h-4 mr-2" aria-hidden="true" /> Print voucher</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gv-value">Value (LKR)</Label>
              <Input id="gv-value" type="number" min={0} value={value || ""} onChange={e => setValue(Number(e.target.value))} className="text-right text-xl font-semibold h-11 tabular-nums" />
              <div className="grid grid-cols-4 gap-2">
                {QUICK.map(q => (
                  <Button key={q} type="button" size="sm" variant={value === q ? "default" : "secondary"} onClick={() => setValue(q)} className="tabular-nums">{q.toLocaleString()}</Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Paid by</Label>
              <div className="grid grid-cols-3 gap-2">
                {METHODS.map(({ key, icon: Icon }) => (
                  <Button key={key} type="button" size="sm" variant={method === key ? "default" : "outline"} onClick={() => setMethod(key)}>
                    <Icon className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" /> {key === "Bank Transfer" ? "Transfer" : key}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="gv-to">For (optional)</Label>
                <Input id="gv-to" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="Recipient name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gv-phone">Phone (optional)</Label>
                <Input id="gv-phone" value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="gv-msg">Message (optional)</Label>
                <Input id="gv-msg" value={message} onChange={e => setMessage(e.target.value)} maxLength={255} placeholder="Happy birthday!" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="gv-exp">Valid until</Label>
                <Input id="gv-exp" type="date" value={expires} onChange={e => setExpires(e.target.value)} />
              </div>
            </div>
            {buyer && <p className="text-xs text-muted-foreground">Bought by {buyer.name}</p>}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={sell} disabled={saving || !(value > 0)} className="flex-1">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Take LKR {Number(value || 0).toLocaleString()} and issue
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
