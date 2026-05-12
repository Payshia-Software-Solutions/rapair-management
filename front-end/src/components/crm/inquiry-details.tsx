"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Inquiry, 
  InquiryLog, 
  fetchInquiry, 
  addInquiryLog, 
  convertInquiry 
} from "@/lib/api/crm";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  MessageSquare, 
  History, 
  ArrowRightLeft, 
  FileCheck, 
  Calculator, 
  CalendarCheck, 
  ExternalLink,
  Link2Off,
  Link,
  Database,
  Home 
} from "lucide-react";
import { unlinkInquiry } from "@/lib/api/crm";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface InquiryDetailsProps {
  inquiryId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function InquiryDetails({ inquiryId, open, onOpenChange, onUpdate }: InquiryDetailsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [logAction, setLogAction] = useState("");
  const [logNotes, setLogNotes] = useState("");
  const [submittingLog, setSubmittingLog] = useState(false);
  const [showManualLink, setShowManualLink] = useState(false);
  const [manualType, setManualType] = useState("Quote");
  const [manualId, setManualId] = useState("");

  useEffect(() => {
    if (open && inquiryId) {
      loadInquiry();
    }
  }, [open, inquiryId]);

  const loadInquiry = async () => {
    setLoading(true);
    try {
      const res = await fetchInquiry(inquiryId);
      if (res.status === "success") {
        setInquiry(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logAction) return;

    setSubmittingLog(true);
    try {
      const res = await addInquiryLog(inquiryId, { action: logAction, notes: logNotes });
      if (res.status === "success") {
        toast({ title: "Success", description: "Interaction logged successfully" });
        setLogAction("");
        setLogNotes("");
        loadInquiry();
        onUpdate();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingLog(false);
    }
  };

  const handleConvert = async (targetType: string) => {
    if (!confirm(`Are you sure you want to convert this inquiry to a ${targetType}?`)) return;

    try {
      const res = await convertInquiry(inquiryId, targetType);
      if (res.status === "success") {
        toast({ title: "Converted", description: `Inquiry successfully converted to ${targetType}` });
        loadInquiry();
        onUpdate();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const executeUnlink = async () => {
    if (!confirm("Are you sure you want to remove the link to this document? The inquiry status will be reverted to 'Qualified'.")) return;

    try {
      const res = await unlinkInquiry(inquiryId);
      if (res.status === "success") {
        toast({ title: "Unlinked", description: "Inquiry successfully unlinked" });
        loadInquiry();
        onUpdate();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const executeManualLink = async () => {
    if (!manualId) return;
    try {
      const res = await convertInquiry(inquiryId, manualType, parseInt(manualId));
      if (res.status === "success") {
        toast({ title: "Linked", description: `Inquiry successfully linked to ${manualType} #${manualId}` });
        setShowManualLink(false);
        setManualId("");
        loadInquiry();
        onUpdate();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const getLinkForDocument = (type: string, id: number) => {
    switch (type) {
      case "Export Costing": return `/admin/shipping/costing?id=${id}`;
      case "Quote": return `/sales/quotations/${id}`;
      case "Invoice": return `/cms/invoices`;
      case "Banquet": return `/banquet/bookings`;
      case "Reservation": return `/front-office/reservations`;
      default: return "#";
    }
  };

  const conversionOptions = [];
  const type = inquiry?.inquiry_type || "";

  if (type === "Export") {
    conversionOptions.push({ label: "Create Export Costing", type: "Export Costing", icon: Calculator, color: "bg-orange-600", description: "Calculate freight and logistics" });
    conversionOptions.push({ label: "Create Quotation", type: "Quote", icon: FileCheck, color: "bg-blue-600", description: "Send formal price offer" });
  } else if (["General", "Repair", "Parts"].includes(type)) {
    conversionOptions.push({ label: "Create Quotation", type: "Quote", icon: Calculator, color: "bg-blue-600", description: "Send formal price offer" });
  }
  
  if (["Service", "Parts"].includes(type)) {
    conversionOptions.push({ label: "Create Sales Invoice", type: "Invoice", icon: FileCheck, color: "bg-green-600", description: "Finalize sale and payment" });
  }
  
  if (type === "Banquet Booking") {
    conversionOptions.push({ label: "Create Banquet Booking", type: "Banquet", icon: CalendarCheck, color: "bg-purple-600", description: "Book venue and catering" });
  }

  if (type === "Room Booking") {
    conversionOptions.push({ label: "Create Reservation", type: "Reservation", icon: Home, color: "bg-indigo-600", description: "Reserve rooms and check-in" });
  }

  if (conversionOptions.length === 0 && type !== "") {
     conversionOptions.push({ label: "Create Quotation", type: "Quote", icon: Calculator, color: "bg-blue-600", description: "Default sales offer" });
  }

  // Force-clean body pointer-events on close — Radix sometimes leaves
  // pointer-events: none on <body> when confirm() dialogs interrupt it.
  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      // Give Radix a tick to run its own cleanup, then force-fix the body
      requestAnimationFrame(() => {
        document.body.style.pointerEvents = "";
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-y-auto"
        onCloseAutoFocus={() => {
          document.body.style.pointerEvents = "";
        }}
      >
        {loading && !inquiry ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground animate-pulse">Loading interaction history...</p>
          </div>
        ) : !inquiry ? (
          <div className="py-20 text-center">
            <p className="text-destructive font-semibold">Failed to load inquiry details.</p>
            <Button variant="outline" onClick={loadInquiry} className="mt-4">Retry</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
          <div className="flex justify-between items-start pr-8">
            <div>
              <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                {inquiry?.inquiry_number}
                <Badge variant={inquiry?.status === "Converted" ? "default" : "secondary"}>
                  {inquiry?.status}
                </Badge>
              </DialogTitle>
              <p className="text-muted-foreground mt-1">{inquiry?.customer_name} • {inquiry?.inquiry_type}</p>
            </div>
            {inquiry.converted_to_type && (
              <div 
                className="bg-primary/10 text-primary p-2 rounded-md flex items-center gap-2 text-sm font-medium cursor-pointer hover:bg-primary/20 transition-colors"
                onClick={() => {
                  const link = getLinkForDocument(inquiry.converted_to_type!, inquiry.converted_to_id!);
                  if (link !== "#") {
                    onOpenChange(false);
                    router.push(link);
                  }
                }}
              >
                <ArrowRightLeft className="h-4 w-4" />
                Linked to {inquiry.converted_to_type} #{inquiry.converted_to_id}
                <div className="flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-destructive hover:bg-destructive/10" 
                    onClick={(e) => {
                      e.stopPropagation();
                      executeUnlink();
                    }}
                    title="Unlink from document"
                  >
                    <Link2Off className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          <div className="md:col-span-2 space-y-6">
            {/* Quick Info */}
            <div className="bg-card border rounded-lg p-4 grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Source</Label>
                <p className="font-medium">{inquiry?.source}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Contact</Label>
                <p className="font-medium">{inquiry?.phone || inquiry?.email || "No contact info"}</p>
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Requirements</Label>
                <p className="text-sm bg-muted/30 p-2 rounded mt-1">{inquiry?.requirements || "No details provided"}</p>
              </div>
            </div>

            {/* Interaction Logs */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <History className="h-4 w-4" />
                Interaction History
              </h3>
              
              <form onSubmit={handleAddLog} className="space-y-3 bg-muted/20 p-4 rounded-lg border border-dashed">
                <div className="grid grid-cols-1 gap-3">
                  <Input 
                    placeholder="Action (e.g. Called customer, Site visit...)" 
                    value={logAction}
                    onChange={(e) => setLogAction(e.target.value)}
                    className="bg-background"
                  />
                  <Textarea 
                    placeholder="Details about the interaction..." 
                    value={logNotes}
                    onChange={(e) => setLogNotes(e.target.value)}
                    rows={2}
                    className="bg-background"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={!logAction || submittingLog}>
                    {submittingLog ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageSquare className="h-4 w-4 mr-2" />}
                    Log Interaction
                  </Button>
                </div>
              </form>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {inquiry?.logs?.map((log) => (
                  <div key={log.id} className="border-l-2 border-primary/30 pl-4 py-1 relative">
                    <div className="absolute -left-[5px] top-2 h-2 w-2 rounded-full bg-primary" />
                    <div className="flex justify-between items-start">
                      <p className="font-medium text-sm">{log.action}</p>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(log.created_at), "MMM d, h:mm a")}
                      </span>
                    </div>
                    {log.notes && <p className="text-xs text-muted-foreground mt-1 italic">{log.notes}</p>}
                    <p className="text-[9px] font-bold uppercase text-primary/60 mt-1">{log.user_name}</p>
                  </div>
                ))}
                {(!inquiry?.logs || inquiry.logs.length === 0) && (
                  <p className="text-center text-muted-foreground text-sm py-4">No interaction logs yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center mb-1">
                <h3 className="font-semibold">Conversion Actions</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-[10px] uppercase font-bold"
                  onClick={() => setShowManualLink(!showManualLink)}
                >
                  {showManualLink ? "Cancel" : "Link Existing"}
                </Button>
              </div>

              {showManualLink && (
                <div className="bg-muted/30 p-3 rounded-lg border space-y-3 mb-4 animate-in slide-in-from-top-2 duration-200">
                  <div>
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Document Type</Label>
                    <select 
                      className="w-full bg-background border rounded h-8 text-sm px-2 mt-1 focus:ring-1 focus:ring-primary outline-none"
                      value={manualType}
                      onChange={(e) => setManualType(e.target.value)}
                    >
                      <option value="Quote">Quotation</option>
                      <option value="Export Costing">Export Costing</option>
                      <option value="Invoice">Sales Invoice</option>
                      <option value="Banquet">Banquet Booking</option>
                      <option value="Reservation">Room Reservation</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Document ID #</Label>
                    <div className="flex gap-2 mt-1">
                      <Input 
                        placeholder="Enter ID..." 
                        value={manualId}
                        onChange={(e) => setManualId(e.target.value)}
                        className="h-8 text-sm"
                        type="number"
                      />
                      <Button size="sm" className="h-8 px-3" onClick={executeManualLink} disabled={!manualId}>
                        <Link className="h-3 w-3 mr-1" /> Link
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {conversionOptions.map((opt) => (
                <Button
                  key={opt.type}
                  variant="outline"
                  className={cn("w-full justify-start h-12 gap-3 border-2 hover:bg-muted", inquiry?.status === "Converted" && "opacity-50 pointer-events-none")}
                  onClick={() => handleConvert(opt.type)}
                >
                  <div className={cn("p-2 rounded-md text-white", opt.color)}>
                    <opt.icon className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold leading-none">{opt.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{opt.description}</p>
                  </div>
                </Button>
              ))}
              {conversionOptions.length === 0 && (
                <p className="text-xs text-muted-foreground italic bg-muted p-3 rounded text-center">
                  No conversion actions for {inquiry?.inquiry_type}
                </p>
              )}
            </div>

            <div className="pt-4 border-t">
              <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3 tracking-widest">Internal Details</h4>
              <div className="space-y-3">
                <div>
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Private Notes</Label>
                  <p className="text-sm bg-amber-50/50 p-2 rounded border border-amber-100 italic">
                    {inquiry?.notes || "No internal notes"}
                  </p>
                </div>
                <div>
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Metadata</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Created: {inquiry?.created_at && format(new Date(inquiry.created_at), "PPP p")}<br />
                    Updated: {inquiry?.updated_at && format(new Date(inquiry.updated_at), "PPP p")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
