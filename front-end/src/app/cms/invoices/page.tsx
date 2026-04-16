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
  DollarSign,
  Printer
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
import { fetchInvoices, fetchCustomers } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";

export default function InvoicesPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const data = await fetchInvoices();
      setInvoices(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load invoices",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      inv.invoice_no?.toLowerCase().includes(query) ||
      inv.customer_name?.toLowerCase().includes(query) ||
      inv.order_customer_name?.toLowerCase().includes(query)
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Paid":
        return "bg-green-100 text-green-800 border-green-200";
      case "Partial":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "Cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      default: // Unpaid
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
            <h2 className="text-3xl font-bold tracking-tight">Invoices</h2>
            <p className="text-muted-foreground mt-1">Manage and track customer invoices.</p>
          </div>
          <Button onClick={() => router.push("/cms/invoices/new")}>
            <Plus className="w-4 h-4 mr-2" />
            Create Invoice
          </Button>
        </div>

        <Card className="border-none shadow-md">
          <CardContent className="p-0">
            <div className="p-4 border-b bg-muted/20">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by invoice # or customer..."
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
                    <TableHead>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-48 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Loader2 className="w-8 h-8 animate-spin text-primary" />
                          <span>Loading invoices...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                            <FileText className="w-6 h-6 text-muted-foreground/50" />
                          </div>
                          <p>No invoices found.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInvoices.map((invoice) => (
                      <TableRow key={invoice.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="font-medium">{invoice.invoice_no}</div>
                          {invoice.order_id && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Order #{invoice.order_id}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold">{invoice.customer_name || invoice.order_customer_name}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 text-sm">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3 h-3 text-muted-foreground" />
                              <span>{invoice.issue_date}</span>
                            </div>
                            {invoice.due_date && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span className="font-medium mr-1">Due:</span>
                                {invoice.due_date}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-bold">{formatCurrency(invoice.grand_total)}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Balance: {formatCurrency(Number(invoice.grand_total) - Number(invoice.paid_amount))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusColor(invoice.status)}>
                            {invoice.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => window.open(`/cms/invoices/${invoice.id}/print?autoprint=1`, '_blank')}
                              title="Print Invoice"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
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
                                <DropdownMenuItem onClick={() => router.push(`/cms/invoices/${invoice.id}/view`)}>
                                  <Eye className="w-4 h-4 mr-2 text-muted-foreground" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => window.open(`/cms/invoices/${invoice.id}/print?autoprint=1`, '_blank')}>
                                  <Printer className="w-4 h-4 mr-2 text-muted-foreground" />
                                  Print Invoice
                                </DropdownMenuItem>
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
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
