"use client";

import React from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, FileText, CheckCircle2 } from "lucide-react";
import { usePOS } from "../../context/POSContext";

export const PrintSelectionDialog: React.FC = () => {
  const { 
    printSelectionOpen, 
    setPrintSelectionOpen, 
    lastInvoiceId,
    reloadData 
  } = usePOS();

  const handlePrint = (type: 'standard' | 'inclusive') => {
    if (!lastInvoiceId) return;
    
    const baseUrl = `/cms/invoices/${lastInvoiceId}/receipt?autoprint=1`;
    const url = type === 'inclusive' ? `${baseUrl}&tax_inclusive=1` : baseUrl;
    
    window.open(url, '_blank');
    setPrintSelectionOpen(false);
  };

  const handleClose = () => {
    setPrintSelectionOpen(false);
    // Optional: reloadData() if we want to reset the POS completely after selection
  };

  return (
    <Dialog open={printSelectionOpen} onOpenChange={setPrintSelectionOpen}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6 border-none shadow-2xl overflow-hidden">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Checkout Successful!</DialogTitle>
            <DialogDescription className="text-sm font-medium">
              Invoice #{lastInvoiceId} has been processed. Select your preferred receipt format to print.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 w-full pt-4">
            <Button 
              variant="outline" 
              className="h-20 justify-start px-6 gap-4 border-2 hover:border-primary hover:bg-primary/5 transition-all group rounded-2xl"
              onClick={() => handlePrint('standard')}
            >
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl group-hover:bg-primary/10 transition-colors">
                <Printer className="w-6 h-6 text-slate-600 group-hover:text-primary" />
              </div>
              <div className="text-left">
                <p className="font-black text-sm uppercase">Standard Receipt</p>
                <p className="text-[10px] text-muted-foreground font-bold">Item prices shown without tax. Taxes listed separately at bottom.</p>
              </div>
            </Button>

            <Button 
              variant="outline" 
              className="h-20 justify-start px-6 gap-4 border-2 hover:border-indigo-500 hover:bg-indigo-500/5 transition-all group rounded-2xl"
              onClick={() => handlePrint('inclusive')}
            >
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl group-hover:bg-indigo-500/10 transition-colors">
                <FileText className="w-6 h-6 text-slate-600 group-hover:text-indigo-500" />
              </div>
              <div className="text-left">
                <p className="font-black text-sm uppercase">Tax Inclusive Receipt</p>
                <p className="text-[10px] text-muted-foreground font-bold">Each item price includes applicable taxes for clarity.</p>
              </div>
            </Button>
          </div>

          <div className="w-full pt-4">
             <Button 
                variant="ghost" 
                className="w-full font-bold text-muted-foreground hover:text-foreground"
                onClick={handleClose}
             >
                Skip Printing
             </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
