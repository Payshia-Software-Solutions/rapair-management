"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { fetchQuotationDetails, updateQuotationStatus, convertQuotationToInvoice } from "@/lib/api/finance";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  ChevronLeft, 
  Printer, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2, 
  FileText, 
  User, 
  Building2, 
  Calendar,
  MoreVertical,
  ExternalLink,
  ArrowRight,
  Globe,
  Truck,
  Calculator,
  Info
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { format } from "date-fns";

export default function QuotationDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { toast } = useToast();
  const { id } = use(params);

  const [quotation, setQuotation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [converting, setConverting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchQuotationDetails(id);
      setQuotation(data);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleStatusChange = async (status: string) => {
    try {
      await updateQuotationStatus(id, status);
      toast({ title: "Updated", description: `Quotation marked as ${status}` });
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleConvert = async () => {
    setConverting(true);
    try {
      const res = await convertQuotationToInvoice(id);
      toast({ title: "Success", description: "Quotation converted to Invoice successfully!" });
      router.push(`/cms/invoices/${res.data.invoice_id}`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setConverting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium">Loading details...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!quotation) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <XCircle className="w-10 h-10 text-destructive" />
          <p className="font-bold">Quotation not found</p>
          <Link href="/sales/quotations">
            <Button variant="outline">Back to List</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout fullWidth={true}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/sales/quotations">
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted">
                <ChevronLeft className="w-6 h-6" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black tracking-tight">#{quotation.quotation_no}</h1>
                <Badge className={`px-4 py-1 text-sm font-bold ${
                  quotation.status === 'Accepted' ? 'bg-green-500 hover:bg-green-600' :
                  quotation.status === 'Rejected' ? 'bg-red-500 hover:bg-red-600' :
                  quotation.status === 'Sent' ? 'bg-blue-500 hover:bg-blue-600' :
                  quotation.status === 'Converted' ? 'bg-purple-500 hover:bg-purple-600' :
                  'bg-slate-500 hover:bg-slate-600'
                }`}>
                  {quotation.status}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm mt-1 uppercase font-black tracking-widest opacity-70">Sales Quotation Details</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="h-11 shadow-sm border-2 font-bold"
              onClick={() => window.open(`/sales/quotations/print/${id}`, '_blank')}
            >
              <Printer className="w-4 h-4 mr-2" /> Print
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="h-11 px-6 shadow-lg shadow-primary/20">
                  Manage Status <MoreVertical className="ml-2 w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-2">
                <DropdownMenuLabel>Quotation Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => handleStatusChange('Sent')}>
                  <FileText className="w-4 h-4 text-blue-500" /> Mark as Sent
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => handleStatusChange('Accepted')}>
                  <CheckCircle2 className="w-4 h-4 text-green-500" /> Mark as Accepted
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => handleStatusChange('Rejected')}>
                  <XCircle className="w-4 h-4 text-red-500" /> Mark as Rejected
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {quotation.status === 'Accepted' && (
                   <DropdownMenuItem className="gap-2 cursor-pointer font-bold text-primary" onClick={handleConvert} disabled={converting}>
                    {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    Convert to Invoice
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="border-none shadow-xl overflow-hidden">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-lg">Items Summary</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-muted/20 border-b">
                        <th className="p-4 text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-70">Description</th>
                        <th className="p-4 text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-70 text-center">Qty</th>
                        <th className="p-4 text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-70 text-right">Unit Price</th>
                        <th className="p-4 text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-70 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {quotation.items?.map((item: any) => (
                        <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                          <td className="p-4">
                            <div className="font-bold">{item.description}</div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">{item.item_type}</div>
                          </td>
                          <td className="p-4 text-center font-mono">{Number(item.quantity).toLocaleString()}</td>
                          <td className="p-4 text-right font-mono">LKR {Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="p-4 text-right font-black">LKR {Number(item.line_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-none shadow-lg bg-muted/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-black uppercase tracking-widest opacity-50 flex items-center gap-2">
                    <Info className="w-4 h-4" /> Notes & Conditions
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-relaxed whitespace-pre-wrap italic">
                  {quotation.notes || "No additional notes provided."}
                </CardContent>
              </Card>
              
              <Card className="border-none shadow-lg bg-primary text-white overflow-hidden relative">
                 <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <Calculator className="w-32 h-32" />
                  </div>
                <CardContent className="p-6 space-y-4">
                  <div className="flex justify-between items-center text-sm border-b border-white/10 pb-3">
                    <span className="text-white/70 font-medium tracking-wide uppercase text-[10px]">Subtotal</span>
                    <span className="font-bold">LKR {Number(quotation.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  {quotation.is_international === 1 && (
                    <div className="flex justify-between items-center text-sm border-b border-white/10 pb-3">
                      <span className="text-white/70 font-medium tracking-wide uppercase text-[10px]">Shipping ({quotation.provider_name || 'Standard'})</span>
                      <span className="font-bold text-blue-200">+ LKR {Number(quotation.shipping_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {quotation.taxes?.map((tax: any) => (
                    <div key={tax.id} className="flex justify-between items-center text-sm border-b border-white/10 pb-3">
                      <span className="text-white/70 font-medium tracking-wide uppercase text-[10px]">{tax.tax_name} ({tax.rate_percent}%)</span>
                      <span className="font-bold text-green-300">+ LKR {Number(tax.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-xl font-black tracking-tight">Grand Total</span>
                    <div className="text-right">
                       <span className="text-3xl font-black text-white tracking-tighter">
                          LKR {Number(quotation.grand_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right Column: Customer Info */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-none shadow-xl border-t-4 border-t-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-500" /> Customer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                <div>
                  <h3 className="text-xl font-black tracking-tight">{quotation.customer_name}</h3>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5 leading-relaxed">
                    {quotation.customer_address}
                  </p>
                </div>
                {quotation.customer_phone && (
                   <Badge variant="secondary" className="px-3 py-1 font-mono">{quotation.customer_phone}</Badge>
                )}
                {quotation.customer_tax_no && (
                  <div className="pt-3 border-t">
                    <p className="text-[10px] uppercase font-black text-muted-foreground opacity-50 tracking-widest">Tax Registration</p>
                    <p className="font-bold text-sm">{quotation.customer_tax_no}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-orange-500" /> Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-2">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-black text-muted-foreground opacity-50 tracking-widest">Issued On</p>
                    <p className="font-bold">{format(new Date(quotation.issue_date), 'MMMM dd, yyyy')}</p>
                  </div>
                </div>
                 <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    quotation.expiry_date && new Date(quotation.expiry_date) < new Date() ? 'bg-red-100' : 'bg-green-100'
                  }`}>
                    <Calendar className={`w-5 h-5 ${
                      quotation.expiry_date && new Date(quotation.expiry_date) < new Date() ? 'text-red-600' : 'text-green-600'
                    }`} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-black text-muted-foreground opacity-50 tracking-widest">Expires On</p>
                    <p className="font-bold">{quotation.expiry_date ? format(new Date(quotation.expiry_date), 'MMMM dd, yyyy') : 'No Expiry'}</p>
                    {quotation.expiry_date && new Date(quotation.expiry_date) < new Date() && (
                      <span className="text-[10px] text-red-500 font-bold uppercase tracking-widest">Expired</span>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t space-y-4">
                   <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-black">
                      SL
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-black text-muted-foreground opacity-50 tracking-widest">Issuing Location</p>
                      <p className="font-bold text-sm">{quotation.location_name || "Main Office"}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {quotation.is_international === 1 && (
              <Card className="border-none shadow-xl border-t-4 border-t-blue-600 bg-blue-50/30 dark:bg-blue-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2 text-blue-700 dark:text-blue-400">
                    <Globe className="w-5 h-5" /> International Shipping
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-black text-muted-foreground opacity-50 tracking-widest">Provider</p>
                      <p className="font-bold text-sm">{quotation.shipping_provider_name || "Standard Carrier"}</p>
                    </div>
                  </div>

                  {quotation.shipping_costing_template_id && (
                    <div className="pt-3 border-t border-blue-100 dark:border-blue-900/30 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <Calculator className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-black text-muted-foreground opacity-50 tracking-widest">Costing Template</p>
                        <p className="font-bold text-sm">{quotation.costing_template_name || "Applied Template"}</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="pt-3 border-t border-blue-100 dark:border-blue-900/30">
                    <p className="text-[10px] uppercase font-black text-muted-foreground opacity-50 tracking-widest">Destination Country</p>
                    <p className="font-bold text-sm flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-[10px]">{quotation.shipping_country || "International"}</span>
                    </p>
                  </div>

                  <div className="pt-3 border-t border-blue-100 dark:border-blue-900/30">
                    <p className="text-[10px] uppercase font-black text-muted-foreground opacity-50 tracking-widest">Shipping Address</p>
                    <p className="text-sm font-medium leading-relaxed mt-1 text-slate-600 dark:text-slate-400 italic">
                      {quotation.shipping_address || "No address provided"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

