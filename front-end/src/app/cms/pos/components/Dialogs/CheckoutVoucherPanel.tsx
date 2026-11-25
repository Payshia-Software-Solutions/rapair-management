"use client";

import React from "react";
import { Ticket, Loader2, X, CreditCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { giftVoucherApi } from "@/lib/api/gift-vouchers";
import { usePOS } from "../../context/POSContext";

export type AppliedVoucher = { code: string; amount: number; balance: number };

const money = (n: number) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Pay part (or all) of the bill with gift vouchers. Each voucher pays up to its balance or what
 * is still due; the rest is paid below by cash, card, etc. The server re-checks every voucher.
 */
export const CheckoutVoucherPanel: React.FC<{
  vouchers: AppliedVoucher[];
  setVouchers: (v: AppliedVoucher[]) => void;
  grandTotal: number;
}> = ({ vouchers, setVouchers, grandTotal }) => {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const used = vouchers.reduce((s, v) => s + v.amount, 0);
  const due = Math.max(0, Math.round((grandTotal - used) * 100) / 100);

  const add = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    if (vouchers.some(v => v.code === c)) { toast({ title: "Voucher already added" }); return; }
    if (due <= 0) { toast({ title: "Nothing left to pay" }); return; }
    setBusy(true);
    try {
      const v = await giftVoucherApi.lookup(c);
      if (!v.usable) throw new Error(v.message || "This voucher can't be used.");
      const amount = Math.min(Number(v.balance), due);
      setVouchers([...vouchers, { code: v.code, amount, balance: Number(v.balance) }]);
      setCode("");
      setOpen(false);
      toast({ title: "Gift voucher added", description: `${v.code}: LKR ${money(amount)} of LKR ${money(v.balance)}` });
    } catch (e: any) {
      toast({ title: "Gift voucher not accepted", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5">
      {vouchers.map(v => (
        <div key={v.code} className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/20">
          <div className="min-w-0">
            <p className="text-xs font-medium text-violet-700 dark:text-violet-300 flex items-center gap-1"><Ticket className="w-3 h-3" aria-hidden="true" /> Gift voucher {v.code}</p>
            <p className="text-[11px] text-muted-foreground">Balance after: LKR {money(v.balance - v.amount)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-semibold tabular-nums text-violet-700 dark:text-violet-300">-LKR {money(v.amount)}</span>
            <button onClick={() => setVouchers(vouchers.filter(x => x.code !== v.code))} aria-label={`Remove voucher ${v.code}`} className="p-1 rounded hover:bg-violet-200 dark:hover:bg-violet-800 text-violet-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}

      {open ? (
        <div className="flex gap-1.5">
          <Input
            autoFocus
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void add(); } if (e.key === "Escape") setOpen(false); }}
            placeholder="GV-XXXX-XXXX"
            aria-label="Gift voucher code"
            className="h-9 font-mono uppercase"
          />
          <Button size="sm" className="h-9" onClick={add} disabled={busy || !code.trim()}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Use"}
          </Button>
          <Button size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={() => setOpen(false)} aria-label="Close">
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : due > 0 && (
        <button onClick={() => setOpen(true)} className="w-full flex items-center justify-center gap-1.5 h-8 rounded-md border border-dashed border-violet-300 text-violet-700 dark:border-violet-700 dark:text-violet-300 text-xs font-medium hover:bg-violet-50 dark:hover:bg-violet-950/20">
          <Ticket className="w-3.5 h-3.5" aria-hidden="true" /> Pay with gift voucher
        </button>
      )}
    </div>
  );
};

/** "Pay with a Sampath card to save LKR 500": bank-card offers this bill would get. */
export const CheckoutBankOffers: React.FC<{ onPickCard: () => void }> = ({ onPickCard }) => {
  const { bankOffers, banks, appliedPromotion, setSelectedBankId, setSelectedCardCategory } = usePOS();
  const better = bankOffers.filter((o: any) => Number(o.discount_value) > Number(appliedPromotion?.discount_value || 0) + 0.009);
  if (!better.length) return null;
  return (
    <div className="space-y-1">
      {better.slice(0, 2).map((o: any) => {
        const bank = banks.find((b: any) => String(b.id) === String(o.bank_id));
        return (
          <button
            key={o.promotion_id}
            onClick={() => {
              if (o.bank_id) setSelectedBankId(String(o.bank_id));
              if (o.card_category && o.card_category !== "Any") setSelectedCardCategory(o.card_category);
              onPickCard();
            }}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-blue-200 bg-blue-50 text-left dark:border-blue-800 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/40"
          >
            <span className="text-xs text-blue-800 dark:text-blue-300 flex items-center gap-1.5 min-w-0">
              <CreditCard className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">Pay with {bank?.name || "the offer bank's"} {o.card_category && o.card_category !== "Any" ? o.card_category.toLowerCase() + " " : ""}card · {o.name}</span>
            </span>
            <span className="text-xs font-bold text-blue-700 dark:text-blue-300 shrink-0">Save LKR {Number(o.discount_value).toLocaleString()}</span>
          </button>
        );
      })}
    </div>
  );
};
