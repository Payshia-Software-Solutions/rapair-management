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
import { Printer, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { usePOS } from "../../context/POSContext";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

export const PrintGuestSelectionDialog: React.FC = () => {
  const { 
    guestPrintSelectionOpen, 
    setGuestPrintSelectionOpen, 
    guestPrintOrderId,
    theme,
    locations,
    selectedLocation,
    isMenuPricing
  } = usePOS();

  const { toast } = useToast();
  const [isPrinting, setIsPrinting] = React.useState<string | null>(null);
  const [targetPrinter, setTargetPrinter] = React.useState<string>("");
  
  const handlePrint = async (type: 'standard' | 'inclusive') => {
    if (!guestPrintOrderId) return;
    setIsPrinting(type);
    const baseReceiptUrl = `/cms/pos/guest-receipt/${guestPrintOrderId}`;
    const url = type === 'inclusive' ? `${baseReceiptUrl}?tax_inclusive=1` : baseReceiptUrl;
    try {
      const { printPage } = await import("@/lib/api/silent-print");
      const result = await printPage(url, 'Receipt', `Guest bill #${guestPrintOrderId}`);
      if (result.printer) setTargetPrinter(result.printer);
      if (result.error) {
        toast({ title: "Printed in browser instead", description: result.error, variant: "destructive" });
      }
    } catch (error) {
      console.error("Print failed:", error);
    } finally {
      setIsPrinting(null);
      setGuestPrintSelectionOpen(false);
    }
  };



  // Location setting decides the receipt: ask (show this dialog), always one format, or no print.
  // Menu-pricing locations always print menu prices + SC, so there is nothing to ask.
  const locRow = locations.find((l: any) => String(l.id) === String(selectedLocation));
  const receiptFormat: string = isMenuPricing
    ? (locRow?.receipt_format === 'none' ? 'none' : 'standard')
    : (locRow?.receipt_format || 'ask');
  const autoHandled = React.useRef(false);
  React.useEffect(() => {
    if (!guestPrintSelectionOpen) { autoHandled.current = false; return; }
    if (receiptFormat === 'ask' || autoHandled.current) return;
    autoHandled.current = true;
    if (receiptFormat === 'none') { setGuestPrintSelectionOpen(false); return; }
    void handlePrint(receiptFormat === 'inclusive' ? 'inclusive' : 'standard');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestPrintSelectionOpen, receiptFormat]);

  const isDark = theme === 'dark' || (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  return (
    <Dialog open={guestPrintSelectionOpen && receiptFormat === 'ask'} onOpenChange={setGuestPrintSelectionOpen}>
      <DialogContent size="sm" className={`p-0 overflow-y-auto border rounded-lg ${ isDark ?'bg-slate-900 border-slate-800 text-white':'bg-white border-slate-200 text-slate-900'
}`}>
        <div className="p-8 space-y-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isDark ? 'bg-blue-500/20' : 'bg-blue-500/10'}`}>
              <FileSpreadsheet className="w-10 h-10 text-blue-500" />
            </div>
            <div className="space-y-1">
              <DialogTitle className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                PRINT GUEST RECEIPT
              </DialogTitle>
              <DialogDescription className={`font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Select your preferred receipt format to print for Bill #{guestPrintOrderId}.
              </DialogDescription>
            </div>
          </div>

          <div className="grid gap-4">
            <Button
              type="button"
              variant="outline"
              className={`h-24 justify-start p-6 space-x-6 border-2 transition-all relative overflow-hidden group ${
                isDark 
                  ? 'bg-slate-800/90 border-slate-700 text-white hover:bg-slate-800 hover:border-primary' 
                  : 'bg-slate-50 border-slate-200 text-slate-900 hover:bg-slate-100 hover:border-primary'
              } ${isPrinting === 'standard' ? 'border-primary ring-2 ring-primary/20' : ''}`}
              onClick={() => handlePrint('standard')}
              disabled={isPrinting !== null}
            >
              <div className={`p-3 rounded-md transition-colors ${
                isDark ? 'bg-slate-700 text-slate-200' : 'bg-white text-slate-700'
              }`}>
                {isPrinting === 'standard' ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : <Printer className="w-6 h-6 text-primary" />}
              </div>
              <div className="flex flex-col items-start text-left">
                <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'} group-hover:text-primary transition-colors`}>
                  {isPrinting === 'standard' ? `PRINTING TO ${targetPrinter.toUpperCase()}...` : 'STANDARD RECEIPT'}
                </span>
                <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} font-medium`}>
                  Item prices shown without tax. Taxes listed separately at bottom.
                </span>
              </div>
            </Button>

            <Button
              type="button"
              variant="outline"
              className={`h-24 justify-start p-6 space-x-6 border-2 transition-all relative overflow-hidden group ${
                isDark 
                  ? 'bg-slate-800/90 border-slate-700 text-white hover:bg-slate-800 hover:border-primary' 
                  : 'bg-slate-50 border-slate-200 text-slate-900 hover:bg-slate-100 hover:border-primary'
              } ${isPrinting === 'inclusive' ? 'border-primary ring-2 ring-primary/20' : ''}`}
              onClick={() => handlePrint('inclusive')}
              disabled={isPrinting !== null}
            >
              <div className={`p-3 rounded-md transition-colors ${
                isDark ? 'bg-slate-700 text-slate-200' : 'bg-white text-slate-700'
              }`}>
                {isPrinting === 'inclusive' ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : <FileText className="w-6 h-6 text-primary" />}
              </div>
              <div className="flex flex-col items-start text-left">
                <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'} group-hover:text-primary transition-colors`}>
                  {isPrinting === 'inclusive' ? `PRINTING TO ${targetPrinter.toUpperCase()}...` : 'TAX INCLUSIVE RECEIPT'}
                </span>
                <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} font-medium`}>
                  Each item price includes applicable taxes for clarity.
                </span>
              </div>
            </Button>
          </div>

          <div className="flex justify-center pt-2">
            <Button 
              type="button"
              variant="ghost" 
              className={`font-bold ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
              onClick={() => setGuestPrintSelectionOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
