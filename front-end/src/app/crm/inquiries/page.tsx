"use client";

import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useRouter } from "next/navigation";
import { 
  fetchInquiries, 
  fetchInquirySources, 
  fetchInquiryTypes,
  deleteInquiry,
  Inquiry
} from "@/lib/api";
import { InquiryDetails } from "@/components/crm/inquiry-details";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  MoreHorizontal, 
  Phone, 
  Mail, 
  MessageSquare, 
  Calendar,
  ExternalLink,
  Eye,
  ArrowRightLeft,
  CalendarCheck,
  Calculator,
  FileCheck
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import Link from "next/link";

export default function InquiriesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [viewingInquiryId, setViewingInquiryId] = useState<number | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    type: "all",
    source: "all"
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [iRes, sRes, tRes] = await Promise.all([
        fetchInquiries(),
        fetchInquirySources(),
        fetchInquiryTypes()
      ]);
      setInquiries(iRes.data || []);
      setSources(Array.isArray(sRes) ? sRes : []);
      setTypes(Array.isArray(tRes) ? tRes : []);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load inquiries", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this inquiry?")) return;
    try {
      const res = await deleteInquiry(id);
      if (res.status === 'success') {
        toast({ title: "Success", description: "Inquiry deleted successfully" });
        loadData();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete inquiry", variant: "destructive" });
    }
  };

  const filteredInquiries = inquiries.filter(i => {
    const matchesSearch = !filters.search || 
      i.customer_name.toLowerCase().includes(filters.search.toLowerCase()) ||
      i.inquiry_number.toLowerCase().includes(filters.search.toLowerCase()) ||
      (i.phone && i.phone.includes(filters.search)) ||
      (i.email && i.email.toLowerCase().includes(filters.search.toLowerCase()));
    
    const matchesStatus = filters.status === 'all' || i.status === filters.status;
    const matchesType = filters.type === 'all' || i.inquiry_type === filters.type;
    const matchesSource = filters.source === 'all' || i.source === filters.source;
    
    return matchesSearch && matchesStatus && matchesType && matchesSource;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'New': return <Badge variant="default" className="bg-blue-500">New</Badge>;
      case 'Contacted': return <Badge variant="secondary" className="bg-amber-500 text-white">Contacted</Badge>;
      case 'Qualified': return <Badge variant="outline" className="border-green-500 text-green-500 font-bold">Qualified</Badge>;
      case 'Converted': return <Badge variant="outline" className="bg-green-600 text-white font-bold">Converted</Badge>;
      case 'Lost': return <Badge variant="destructive">Lost</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const openDetails = (id: number) => {
    setViewingInquiryId(id);
    setIsDetailsOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">CRM Inquiries</h1>
            <p className="text-muted-foreground">Manage leads and sales inquiries</p>
          </div>
          <Button asChild className="w-full md:w-auto">
            <Link href="/crm/inquiries/new">
              <Plus className="mr-2 h-4 w-4" /> New Inquiry
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, #, email..."
                  className="pl-8"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
              </div>
              <Select value={filters.status} onValueChange={(val) => setFilters({ ...filters, status: val })}>
                <SelectTrigger>
                  <Filter className="mr-2 h-4 w-4 opacity-50" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="New">New</SelectItem>
                  <SelectItem value="Contacted">Contacted</SelectItem>
                  <SelectItem value="Qualified">Qualified</SelectItem>
                  <SelectItem value="Converted">Converted</SelectItem>
                  <SelectItem value="Lost">Lost</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.type} onValueChange={(val) => setFilters({ ...filters, type: val })}>
                <SelectTrigger>
                  <Filter className="mr-2 h-4 w-4 opacity-50" />
                  <SelectValue placeholder="Inquiry Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filters.source} onValueChange={(val) => setFilters({ ...filters, source: val })}>
                <SelectTrigger>
                  <Filter className="mr-2 h-4 w-4 opacity-50" />
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {sources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Logs</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">Loading inquiries...</TableCell>
                  </TableRow>
                ) : filteredInquiries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">No inquiries found.</TableCell>
                  </TableRow>
                ) : (
                  filteredInquiries.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.inquiry_number}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold">{i.customer_name}</span>
                          <div className="flex items-center gap-2 mt-1">
                            {i.phone && <a href={`tel:${i.phone}`} className="text-xs text-muted-foreground hover:text-primary"><Phone className="inline h-3 w-3 mr-1" /> {i.phone}</a>}
                            {i.email && <a href={`mailto:${i.email}`} className="text-xs text-muted-foreground hover:text-primary"><Mail className="inline h-3 w-3 mr-1" /> {i.email}</a>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{i.inquiry_type}</Badge>
                      </TableCell>
                      <TableCell>
                        {(i as any).items && (i as any).items.length > 0 ? (
                          <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                            {(i as any).items.length} Items
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MessageSquare className="h-3 w-3" />
                          {(i as any).log_count || 0}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{i.source}</TableCell>
                      <TableCell>{getStatusBadge(i.status)}</TableCell>
                      <TableCell className="text-sm">
                        {i.assigned_to ? <Badge variant="secondary">Staff ID: {i.assigned_to}</Badge> : <span className="text-muted-foreground italic">Unassigned</span>}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-col">
                          <span>{format(new Date(i.created_at), "MMM d, yyyy")}</span>
                          <span className="text-muted-foreground">{format(new Date(i.created_at), "h:mm a")}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Inquiry Management</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openDetails(i.id)}>
                              <Eye className="mr-2 h-4 w-4" /> View Interactions
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/crm/inquiries/${i.id}/edit`}>
                                <Edit className="mr-2 h-4 w-4" /> Edit Lead
                              </Link>
                            </DropdownMenuItem>
                            
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase">Conversion</DropdownMenuLabel>
                            
                            {["General", "Repair", "Parts", "Service"].includes(i.inquiry_type) && (
                              <DropdownMenuItem className="text-blue-600" onClick={() => openDetails(i.id)}>
                                <Calculator className="mr-2 h-4 w-4" /> Convert to Quote
                              </DropdownMenuItem>
                            )}
                            {["Service", "Parts"].includes(i.inquiry_type) && (
                              <DropdownMenuItem className="text-green-600" onClick={() => openDetails(i.id)}>
                                <FileCheck className="mr-2 h-4 w-4" /> Convert to Invoice
                              </DropdownMenuItem>
                            )}
                            {i.inquiry_type === "Banquet Booking" && (
                              <DropdownMenuItem className="text-purple-600" onClick={() => openDetails(i.id)}>
                                <CalendarCheck className="mr-2 h-4 w-4" /> Convert to Booking
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(i.id)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete Inquiry
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <InquiryDetails 
        inquiryId={viewingInquiryId || 0}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        onUpdate={loadData}
      />
    </DashboardLayout>
  );
}
