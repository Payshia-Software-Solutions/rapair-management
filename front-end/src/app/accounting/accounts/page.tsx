"use client";

import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Search, 
  RefreshCw, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Scale,
  Landmark,
  Coins,
  ShieldCheck,
  History
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { fetchAccounts, createAccount } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "ASSET",
    category: "",
    opening_balance: "0",
    as_of_date: new Date().toISOString().split('T')[0]
  });

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const data = await fetchAccounts();
      setAccounts(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load chart of accounts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createAccount(formData);
      toast({
        title: "Success",
        description: "Account created successfully with opening balance.",
      });
      setIsModalOpen(false);
      setFormData({
        code: "",
        name: "",
        type: "ASSET",
        category: "",
        opening_balance: "0",
        as_of_date: new Date().toISOString().split('T')[0]
      });
      loadAccounts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create account",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAccounts = accounts.filter(acc => 
    acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    acc.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'ASSET': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'LIABILITY': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'EQUITY': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'INCOME': return 'bg-green-100 text-green-700 border-green-200';
      case 'EXPENSE': return 'bg-rose-100 text-rose-700 border-rose-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <DashboardLayout title="Chart of Accounts">
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tighter uppercase text-slate-900 flex items-center gap-3">
              <Landmark className="w-10 h-10 text-primary" />
              Chart of Accounts
            </h1>
            <p className="text-muted-foreground text-sm font-medium">Manage your financial structure, categories and opening positions.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={loadAccounts} disabled={loading} className="rounded-xl h-11 w-11 shadow-sm border-muted-foreground/20 italic">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 font-black uppercase text-xs tracking-widest px-6 shadow-lg shadow-primary/20 rounded-xl h-11">
              <Plus className="w-4 h-4" /> Add New Account
            </Button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
           {[
             { label: 'Total Assets', icon: Wallet, color: 'blue', type: 'ASSET' },
             { label: 'Total Liabilities', icon: Scale, color: 'orange', type: 'LIABILITY' },
             { label: 'Annual Income', icon: ArrowUpRight, color: 'green', type: 'INCOME' },
             { label: 'Operating Expenses', icon: ArrowDownRight, color: 'rose', type: 'EXPENSE' }
           ].map((stat) => {
             const filtered = accounts.filter(a => a.type === stat.type);
             const rawVal = filtered.reduce((sum, a) => sum + Number(a.balance), 0);
             const isCreditNature = ['LIABILITY', 'EQUITY', 'INCOME'].includes(stat.type);
             const val = isCreditNature ? -rawVal : rawVal;

             return (
               <Card key={stat.label} className={`border shadow-sm border-${stat.color}-500/10 rounded-xl overflow-hidden group hover:border-${stat.color}-500/30 transition-all`}>
                 <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 opacity-60 group-hover:opacity-100 transition-opacity">
                   <CardTitle className="text-[10px] font-black uppercase tracking-widest">{stat.label}</CardTitle>
                   <stat.icon className={`w-4 h-4 text-${stat.color}-500`} />
                 </CardHeader>
                 <CardContent>
                   <div className={`text-2xl font-black tabular-nums tracking-tighter ${val < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                     LKR {val < 0 ? `(${Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2 })})` : val.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                   </div>
                 </CardContent>
               </Card>
             );
           })}
        </div>

        {/* Search Bar */}
        <Card className="border shadow-sm rounded-xl overflow-hidden bg-muted/20">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground opacity-50" />
              <Input 
                placeholder="Search accounts by name or code..." 
                className="pl-11 h-12 rounded-xl border-none shadow-inner font-bold focus-visible:ring-primary text-slate-700"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Accounts Table */}
        <Card className="border shadow-sm rounded-xl overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/30 border-b-2">
              <TableRow className="hover:bg-transparent uppercase tabular-nums">
                <TableHead className="w-[120px] font-black tracking-widest text-[10px] py-6 px-8 text-slate-500">Code</TableHead>
                <TableHead className="font-black tracking-widest text-[10px] text-slate-500">Account Name</TableHead>
                <TableHead className="font-black tracking-widest text-[10px] text-slate-500 text-center">Classification</TableHead>
                <TableHead className="font-black tracking-widest text-[10px] text-slate-500">Category / Group</TableHead>
                <TableHead className="text-right font-black tracking-widest text-[10px] text-slate-500 px-8">Running Balance</TableHead>
                <TableHead className="text-right font-black tracking-widest text-[10px] text-slate-500 px-8">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <RefreshCw className="w-10 h-10 animate-spin mx-auto text-muted-foreground opacity-20" />
                    <p className="text-sm text-muted-foreground mt-4 font-medium italic">Synchronizing ledger...</p>
                  </TableCell>
                </TableRow>
              ) : filteredAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <History className="w-12 h-12 mx-auto text-muted-foreground opacity-10" />
                    <p className="text-muted-foreground font-medium italic mt-4">No accounts match your criteria.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAccounts.map((acc) => {
                  const isCreditNature = ['LIABILITY', 'EQUITY', 'INCOME'].includes(acc.type);
                  const displayBalance = isCreditNature ? -Number(acc.balance || 0) : Number(acc.balance || 0);

                  return (
                    <TableRow key={acc.id} className="hover:bg-muted/30 transition-colors group">
                      <TableCell className="font-mono font-black text-primary py-4 px-8 text-xs">{acc.code}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2 font-bold text-slate-800">
                            {acc.name}
                            {acc.is_system == 1 && (
                              <div title="System Protected" className="p-1 rounded-full bg-slate-100 text-slate-400">
                                <ShieldCheck className="w-3 h-3" />
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground font-medium italic uppercase opacity-40">Financial Entity</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={`${getTypeColor(acc.type)} variant="secondary" font-black text-[9px] uppercase tracking-widest px-3 py-1 border shadow-sm`}>
                          {acc.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-bold text-[11px] uppercase tracking-tighter opacity-70">
                        {acc.category || 'General'}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-black px-8 ${displayBalance < 0 ? 'text-rose-600' : 'text-slate-900 bg-muted/5 group-hover:bg-transparent transition-colors'}`}>
                        {displayBalance < 0 ? `(${Math.abs(displayBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })})` : displayBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right px-8">
                         <Button 
                           variant="ghost" 
                           size="sm"
                           onClick={() => window.location.href = `/accounting/accounts/${acc.id}/ledger`}
                           className="h-8 rounded-lg font-black uppercase text-[10px] tracking-wider hover:bg-primary/10 hover:text-primary transition-all flex items-center gap-2 ml-auto"
                         >
                           <History className="w-3 h-3" /> View Audit
                         </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* New Account Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl rounded-xl border shadow-lg">
          <form onSubmit={handleCreate}>
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                <Plus className="w-6 h-6 text-primary" />
                Initialize New Account
              </DialogTitle>
              <DialogDescription className="font-medium text-slate-500">
                Define a new category in your financial structure and set its opening position.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-6 pb-6 border-b border-dashed mb-6">
              <div className="space-y-2">
                <Label htmlFor="code" className="text-[10px] font-black uppercase tracking-widest opacity-60">Account Code</Label>
                <Input 
                  id="code"
                  placeholder="e.g. 1020" 
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                  required
                  className="rounded-xl font-bold shadow-sm h-11 border-muted-foreground/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type" className="text-[10px] font-black uppercase tracking-widest opacity-60">Classification</Label>
                <Select value={formData.type} onValueChange={(val) => setFormData({...formData, type: val})}>
                  <SelectTrigger className="rounded-xl font-bold shadow-sm h-11 border-muted-foreground/20">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-xl">
                    <SelectItem value="ASSET" className="font-bold">ASSET (Current/Fixed)</SelectItem>
                    <SelectItem value="LIABILITY" className="font-bold">LIABILITY (Debt/Payables)</SelectItem>
                    <SelectItem value="EQUITY" className="font-bold">EQUITY (Capital/Opening)</SelectItem>
                    <SelectItem value="INCOME" className="font-bold">INCOME (Revenue/Sales)</SelectItem>
                    <SelectItem value="EXPENSE" className="font-bold">EXPENSE (COGS/Operating)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest opacity-60">Account Name</Label>
                <Input 
                  id="name"
                  placeholder="e.g. Petty Cash - Branch II" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                  className="rounded-xl font-bold shadow-sm h-11 border-muted-foreground/20"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="category" className="text-[10px] font-black uppercase tracking-widest opacity-60">Category / Sub-Group</Label>
                <Input 
                  id="category"
                  placeholder="e.g. Fixed Assets, Operational Costs..." 
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="rounded-xl font-bold shadow-sm h-11 border-muted-foreground/20 italic"
                />
              </div>
            </div>

            {/* Opening Balance Section */}
            <div className="bg-muted/30 p-6 rounded-xl border border-dashed space-y-4">
              <div className="flex items-center gap-2 mb-2">
                 <Coins className="w-4 h-4 text-orange-500" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">Opening Balance Calibration</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="opening_balance" className="text-[9px] font-black uppercase opacity-60">Starting Balance (LKR)</Label>
                  <Input 
                    id="opening_balance"
                    type="number" 
                    step="0.01"
                    value={formData.opening_balance}
                    onChange={(e) => setFormData({...formData, opening_balance: e.target.value})}
                    className="rounded-xl font-mono font-black shadow-sm h-11 border-muted-foreground/20 text-primary bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="as_of_date" className="text-[9px] font-black uppercase opacity-60">Balance As Of</Label>
                  <Input 
                    id="as_of_date"
                    type="date" 
                    value={formData.as_of_date}
                    onChange={(e) => setFormData({...formData, as_of_date: e.target.value})}
                    className="rounded-xl font-bold shadow-sm h-11 border-muted-foreground/20 bg-background"
                  />
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground italic font-medium leading-relaxed">
                Recording an opening balance will automatically post a balanced entry against the system's initialization equity account.
              </p>
            </div>

            <DialogFooter className="mt-8 gap-3 sm:gap-0">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="rounded-xl font-bold h-11 px-8">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="rounded-xl font-black uppercase text-xs tracking-widest px-8 h-11 bg-primary shadow-lg shadow-primary/20">
                {submitting && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                Initialize Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
