
"use client";

import React from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePOS } from "../../context/POSContext";
import { Calculator, Percent, Banknote, X, Check, Trash2 } from "lucide-react";

export const BillDiscountDialog: React.FC = () => {
  const {
    billDiscountDialogOpen,
    setBillDiscountDialogOpen,
    billDiscountValue,
    setBillDiscountValue,
    billDiscountType,
    setBillDiscountType,
    vKeyboardEnabled,
    setVKeyboardActiveInput,
    totals
  } = usePOS();

  const handleApply = () => {
    setBillDiscountDialogOpen(false);
  };

  const handleClear = () => {
    setBillDiscountValue(0);
    setBillDiscountDialogOpen(false);
  };

  const presets = billDiscountType === 'percentage' 
    ? [5, 10, 15, 20, 25] 
    : [100, 250, 500, 1000, 5000];

  return (
    <Dialog open={billDiscountDialogOpen} onOpenChange={setBillDiscountDialogOpen}>
      <DialogContent size="sm" className="p-0 gap-0">
        {/* Standard modal layout: header / body / footer */}
        <DialogHeader className="px-5 pt-5 pb-3 text-left border-b border-border">
          <DialogTitle>Bill discount</DialogTitle>
          <p className="text-sm text-muted-foreground">Applies to the whole bill, after line discounts.</p>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4">
          {/* Type */}
          <div role="radiogroup" aria-label="Discount type" className="grid grid-cols-2 gap-1 p-1 rounded-md bg-muted">
            {([['percentage', 'Percentage', Percent], ['flat', 'Fixed amount', Banknote]] as const).map(([val, label, Icon]) => (
              <button
                key={val}
                type="button"
                role="radio"
                aria-checked={billDiscountType === val}
                onClick={() => setBillDiscountType(val)}
                className={`h-10 rounded-sm flex items-center justify-center gap-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${billDiscountType === val ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" /> {label}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="bill-discount-value" className="text-sm font-medium">
              {billDiscountType === 'percentage' ? 'Discount (%)' : 'Discount (LKR)'}
            </label>
            <div className="relative mt-1.5">
              <span className="absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground pointer-events-none">
                {billDiscountType === 'percentage' ? '%' : 'LKR'}
              </span>
              <Input
                id="bill-discount-value"
                type="number"
                inputMode="decimal"
                value={billDiscountValue || ''}
                onChange={e => setBillDiscountValue(Number(e.target.value))}
                onFocus={() => {
                  if (vKeyboardEnabled) {
                    setVKeyboardActiveInput({
                      key: "Discount Value",
                      value: String(billDiscountValue || ''),
                      type: 'numeric',
                      setter: (val: string) => setBillDiscountValue(Number(val))
                    });
                  }
                }}
                className="h-12 pl-12 pr-4 text-right text-2xl font-semibold tabular-nums"
                placeholder="0"
              />
            </div>
          </div>

          {/* Quick values */}
          <div className="flex flex-wrap gap-2">
            {presets.map(val => (
              <Button
                key={val}
                type="button"
                size="sm"
                variant={billDiscountValue === val ? 'default' : 'outline'}
                onClick={() => setBillDiscountValue(val)}
                className="h-9 tabular-nums"
              >
                {val}{billDiscountType === 'percentage' ? '%' : ''}
              </Button>
            ))}
          </div>

          {/* Summary */}
          <dl className="rounded-lg border border-border divide-y divide-border text-sm">
            <div className="flex justify-between px-3 py-2.5">
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="font-medium tabular-nums">- LKR {Number(totals.billDiscountAmt || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
            </div>
            <div className="flex justify-between px-3 py-2.5">
              <dt className="text-muted-foreground">New bill total</dt>
              <dd className="font-semibold tabular-nums">LKR {totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
            </div>
          </dl>
        </div>

        <DialogFooter className="px-5 py-3 border-t border-border gap-2 sm:gap-2">
          <Button type="button" variant="outline" className="h-11" onClick={() => { setBillDiscountValue(0); setBillDiscountDialogOpen(false); }}>
            Remove discount
          </Button>
          <Button type="button" className="h-11 px-5" onClick={handleApply}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
