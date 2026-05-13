"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  FileText,
  Plus,
  Search,
  Eye,
  MoreHorizontal,
  Loader2,
  Calendar,
  History,
  Play,
  Pause,
  RefreshCcw,
  CheckCircle,
  AlertCircle,
  AlertCircle,
  Edit,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api, fetchRecurringInvoices, processRecurringInvoices } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { DataTablePagination } from "@/components/data-table-pagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function RecurringInvoicesPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [forceGenId, setForceGenId] = useState<number | null>(null);
  const [isForceGenerating, setIsForceGenerating] = useState(false);
  const pageSize = 10;

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await fetchRecurringInvoices();
      setTemplates(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load recurring templates",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    setIsProcessing(true);
    try {
      const res = await processRecurringInvoices();
      toast({
        title: "Processing Complete",
        description: `Generated ${res.count} invoices from templates.`,
      });
      await loadTemplates();
    } catch (error: any) {
      toast({
        title: "Processing Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleForceGenerate = async () => {
    if (!forceGenId) return;
    
    setIsForceGenerating(true);
    try {
      const res = await api(`/recurring-invoice/force-generate/${forceGenId}`, { 
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        toast({ 
          title: "Invoice Generated!", 
          description: `Successfully created ${data.invoice_no}. Redirecting...`,
          variant: "default"
        });
        setTimeout(() => {
          router.push(`/cms/invoices/${data.id}/view`);
        }, 1500);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to generate invoice", variant: "destructive" });
    } finally {
      setIsForceGenerating(false);
      setForceGenId(null);
    }
  };

  const filteredTemplates = templates.filter((t) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      t.template_name?.toLowerCase().includes(query) ||
      t.customer_name?.toLowerCase().includes(query)
    );
  });

  const totalPages = Math.ceil(filteredTemplates.length / pageSize);
  const paginatedTemplates = filteredTemplates.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800 border-green-200";
      case "Paused":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "Completed":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 2
    }).format(Number(amount) || 0);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Recurring Invoices</h2>
            <p className="text-muted-foreground mt-1">Manage automated invoice templates and schedules.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleProcess} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
              Process Due
            </Button>
            <Button onClick={() => router.push("/cms/invoices/recurring/new")}>
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          </div>
        </div>

        <Card className="border-none shadow-md">
          <CardContent className="p-0">
            <div className="p-4 border-b bg-muted/20">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by template name or customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-background"
                />
              </div>
            </div>

            <div className="rounded-b-xl overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Template Name</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Next Run</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-48 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Loader2 className="w-8 h-8 animate-spin text-primary" />
                          <span>Loading templates...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredTemplates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-48 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                            <History className="w-6 h-6 text-muted-foreground/50" />
                          </div>
                          <p>No recurring templates found.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedTemplates.map((template) => (
                      <TableRow key={template.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="font-medium">{template.template_name}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold">{template.customer_name}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{template.frequency}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Calendar className="w-3 h-3 text-muted-foreground" />
                            <span>{template.next_generation_date}</span>
                          </div>
                          {template.last_generation_date && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Last: {template.last_generation_date}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-bold">{formatCurrency(template.grand_total)}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusColor(template.status)}>
                            {template.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => router.push(`/cms/invoices/recurring/${template.id}/edit`)}>
                                  <Edit className="w-4 h-4 mr-2 text-muted-foreground" />
                                  Edit Template
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setForceGenId(template.id)} className="text-amber-600 focus:text-amber-700">
                                  <Zap className="w-4 h-4 mr-2" />
                                  Force Generate
                                </DropdownMenuItem>
                                {template.status === "Active" ? (
                                  <DropdownMenuItem>
                                    <Pause className="w-4 h-4 mr-2 text-muted-foreground" />
                                    Pause Schedule
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem>
                                    <Play className="w-4 h-4 mr-2 text-muted-foreground" />
                                    Resume Schedule
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <DataTablePagination 
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={filteredTemplates.length}
              onPageChange={setCurrentPage}
            />
          </CardContent>
        </Card>
        <AlertDialog open={forceGenId !== null} onOpenChange={(open) => !open && setForceGenId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Force Generate Invoice?</AlertDialogTitle>
              <AlertDialogDescription>
                This will immediately create an invoice from this template, bypassing the normal schedule. 
                Are you sure you want to proceed?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isForceGenerating}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={(e) => {
                  e.preventDefault();
                  handleForceGenerate();
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white"
                disabled={isForceGenerating}
              >
                {isForceGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                Generate Now
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}

function Loader2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
