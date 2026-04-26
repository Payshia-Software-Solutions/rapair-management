"use client"

import React, { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Loader2, 
  ChevronLeft, 
  Play, 
  CheckCircle, 
  MapPin, 
  Calendar, 
  Package, 
  Factory, 
  AlertCircle,
  FileText,
  Clock,
  User,
  Boxes,
  Printer
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ProductionOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
  const router = useRouter()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<any>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Completion Dialog State
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [yields, setYields] = useState<any[]>([])
  const [wasteReason, setWasteReason] = useState('') // General waste reason

  const load = async () => {
    setLoading(true)
    try {
      const res = await api(`/api/productionorder/get/${id}`)
      const data = await res.json()
      if (data.status === 'success') {
        const o = data.data
        setOrder(o)
        // Initialize yields from outputs
        if (o.outputs) {
          setYields(o.outputs.map((out: any) => ({
            id: out.id,
            part_name: out.part_name,
            planned_qty: out.planned_qty,
            actual_yield: String(out.planned_qty),
            batch_number: out.batch_number || '',
            expiry_date: out.expiry_date || '',
            is_expiry: out.is_expiry == 1,
            waste_reason: ''
          })))
        }
      } else {
        throw new Error(data.message)
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to load order", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) void load()
  }, [id])

  const handleStart = async () => {
    setActionLoading(true)
    try {
      const res = await api(`/api/productionorder/start/${id}`, { method: 'POST' })
      const data = await res.json()
      if (data.status === 'success') {
        toast({ title: "Production Started", description: "Batch moved to In Progress." })
        await load()
      } else {
        throw new Error(data.message)
      }
    } catch (e: any) {
      toast({ title: "Execution Failed", description: e.message, variant: "destructive" })
    } finally {
      setActionLoading(false)
    }
  }

  const handleComplete = async () => {
    // Validate yields
    const invalid = yields.find(y => Number(y.actual_yield) < 0)
    if (invalid) {
      toast({ title: "Validation Error", description: "Yield cannot be negative.", variant: "destructive" })
      return
    }

    setActionLoading(true)
    try {
      const payload = {
        outputs: yields.map(y => ({
          id: y.id,
          actual_yield: Number(y.actual_yield),
          batch_number: y.batch_number,
          expiry_date: y.expiry_date,
          waste_reason: y.waste_reason
        })),
        waste_reason: wasteReason // Global note
      }

      const res = await api(`/api/productionorder/complete/${id}`, { 
        method: 'POST',
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (data.status === 'success') {
        toast({ title: "Production Completed", description: "All finished goods received into stock." })
        setShowCompleteDialog(false)
        await load()
      } else {
        throw new Error(data.message)
      }
    } catch (e: any) {
      toast({ title: "Completion Failed", description: e.message, variant: "destructive" })
    } finally {
      setActionLoading(false)
    }
  }

  const updateYield = (outId: any, field: string, value: string) => {
    setYields(prev => prev.map(y => y.id === outId ? { ...y, [field]: value } : y))
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Planned': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 px-4 py-1 text-sm font-bold">Planned</Badge>
      case 'InProgress': return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 px-4 py-1 text-sm font-bold">In Progress</Badge>
      case 'Completed': return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 px-4 py-1 text-sm font-bold">Completed</Badge>
      case 'Cancelled': return <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 px-4 py-1 text-sm font-bold">Cancelled</Badge>
      default: return <Badge variant="outline" className="px-4 py-1 text-sm">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading order details...
        </div>
      </DashboardLayout>
    )
  }

  if (!order) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <AlertCircle className="w-12 h-12 text-muted-foreground" />
          <div>
            <h2 className="text-2xl font-bold">Batch Not Found</h2>
            <p className="text-muted-foreground">The production order ID {id} does not exist or has been removed.</p>
          </div>
          <Button onClick={() => router.push('/production/orders')}>Back to Queue</Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className="gap-2 -ml-2 text-muted-foreground hover:text-foreground" onClick={() => router.push('/production/orders')}>
            <ChevronLeft className="w-4 h-4" />
            Back to Queue
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push(`/production/orders/print/${id}`)} className="gap-2">
              <Printer className="w-4 h-4" />
              Print Summary
            </Button>
            {order.status === 'Planned' && (
              <Button onClick={handleStart} disabled={actionLoading} className="gap-2 bg-primary shadow-lg shadow-primary/20">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Play className="w-4 h-4" />}
                Start Production
              </Button>
            )}
            {order.status === 'InProgress' && (
              <Button onClick={() => setShowCompleteDialog(true)} disabled={actionLoading} className="gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle className="w-4 h-4" />}
                Complete Batch
              </Button>
            )}
          </div>
        </div>

        <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Complete Production Batch</DialogTitle>
              <DialogDescription>
                Confirm the actual finished quantity for each product in this batch.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4 max-h-[60vh] overflow-y-auto pr-2">
              {yields.map((y) => (
                <div key={y.id} className="p-4 rounded-xl border bg-muted/30 space-y-4">
                  <div className="flex items-center justify-between">
                     <Label className="text-base font-bold text-primary">{y.part_name}</Label>
                     <Badge variant="outline" className="font-mono text-[10px]">Planned: {y.planned_qty}</Badge>
                  </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-1.5">
                        <Label htmlFor={`yield-${y.id}`} className="text-[10px] uppercase font-bold text-muted-foreground">Actual Yield</Label>
                        <Input
                          id={`yield-${y.id}`}
                          type="number"
                          step="0.001"
                          value={y.actual_yield}
                          onChange={(e) => updateYield(y.id, 'actual_yield', e.target.value)}
                          className="font-bold h-9"
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor={`waste-${y.id}`} className="text-[10px] uppercase font-bold text-muted-foreground">Item Waste Reason</Label>
                        <Input
                          id={`waste-${y.id}`}
                          placeholder="e.g. Reject"
                          value={y.waste_reason}
                          onChange={(e) => updateYield(y.id, 'waste_reason', e.target.value)}
                          className="h-9"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-1.5">
                        <Label htmlFor={`batch-${y.id}`} className="text-[10px] uppercase font-bold text-muted-foreground">Batch Number</Label>
                        <Input
                          id={`batch-${y.id}`}
                          placeholder="Batch #"
                          value={y.batch_number}
                          onChange={(e) => updateYield(y.id, 'batch_number', e.target.value)}
                          className="h-9 font-mono"
                        />
                      </div>
                      {y.is_expiry && (
                        <div className="grid gap-1.5">
                          <Label htmlFor={`expiry-${y.id}`} className="text-[10px] uppercase font-bold text-muted-foreground">Expiry Date</Label>
                          <Input
                            id={`expiry-${y.id}`}
                            type="date"
                            value={y.expiry_date}
                            onChange={(e) => updateYield(y.id, 'expiry_date', e.target.value)}
                            className="h-9"
                          />
                        </div>
                      )}
                    </div>
                  </div>
              ))}
              
              <div className="pt-2 border-t mt-2">
                <Label htmlFor="global-notes" className="text-xs uppercase font-bold text-muted-foreground mb-1.5 block">Batch Notes / Final Summary</Label>
                <Input
                  id="global-notes"
                  placeholder="Enter any general observations for this batch..."
                  value={wasteReason}
                  onChange={(e) => setWasteReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>Cancel</Button>
              <Button onClick={handleComplete} disabled={actionLoading} className="bg-emerald-600 hover:bg-emerald-700">
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Finalize Batch Receipt
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <Card className="border-none shadow-md overflow-hidden">
               <div className="p-6 bg-gradient-to-br from-primary/10 via-background to-background border-b">
                 <div className="flex flex-col gap-6">
                   <div className="flex items-start justify-between">
                     <div className="flex items-center gap-4">
                        <div className="p-4 bg-card border border-border/60 rounded-2xl shadow-sm shrink-0">
                           <Factory className="w-10 h-10 text-primary" />
                        </div>
                        <div>
                           <div className="flex items-center gap-3">
                              <h1 className="text-3xl font-bold tracking-tight">{order.order_number}</h1>
                              {getStatusBadge(order.status)}
                           </div>
                           <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1.5 font-medium text-foreground">
                                <Package className="w-4 h-4" /> {order.outputs?.length || 1} Products in Batch
                              </span>
                              <Separator orientation="vertical" className="h-4" />
                              <span className="flex items-center gap-1.5">
                                <FileText className="w-4 h-4" /> Consolidated Material Flow
                              </span>
                           </div>
                        </div>
                     </div>
                   </div>

                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest flex items-center gap-1.5 mb-1">
                          <Boxes className="w-3.5 h-3.5" /> Total Target
                        </div>
                        <div className="text-lg font-bold">{Number(order.qty).toLocaleString()} Units</div>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest flex items-center gap-1.5 mb-1">
                          <MapPin className="w-3.5 h-3.5" /> Site
                        </div>
                        <div className="text-lg font-bold truncate">{order.location_name}</div>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest flex items-center gap-1.5 mb-1">
                          <Calendar className="w-3.5 h-3.5" /> Created
                        </div>
                        <div className="text-sm font-bold">{format(new Date(order.created_at), 'MMM d, HH:mm')}</div>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest flex items-center gap-1.5 mb-1">
                          <Clock className="w-3.5 h-3.5" /> Last Update
                        </div>
                        <div className="text-sm font-bold">{format(new Date(order.updated_at), 'MMM d, HH:mm')}</div>
                      </div>
                   </div>
                 </div>
               </div>

               <CardContent className="p-0">
                  <div className="p-6 space-y-8">
                    {/* Master Output List */}
                    <div>
                      <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                        <Package className="w-5 h-5 text-primary" />
                        Master Output List
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(order.outputs || []).map((out: any) => (
                           <div key={out.id} className="relative group p-4 rounded-xl border bg-card hover:border-primary/50 transition-all shadow-sm">
                              <div className="flex items-start justify-between mb-2">
                                 <div>
                                    <div className="font-bold text-sm">{out.part_name}</div>
                                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">SKU: {out.sku}</div>
                                 </div>
                                 <Badge className="font-mono bg-primary/5 text-primary border-primary/20">
                                    {Number(out.planned_qty).toLocaleString()} {out.unit}
                                 </Badge>
                              </div>
                              {order.status === 'Completed' && (
                                <div className="mt-3 pt-3 border-t border-dashed space-y-2">
                                   <div className="flex items-center justify-between text-xs">
                                     <span className="text-muted-foreground">Actual Yield:</span>
                                     <span className={cn("font-bold", Number(out.actual_qty) < Number(out.planned_qty) ? "text-amber-600" : "text-emerald-600")}>
                                       {Number(out.actual_qty).toLocaleString()} {out.unit}
                                     </span>
                                   </div>
                                   <div className="flex items-center justify-between text-[10px]">
                                     <span className="text-muted-foreground">Batch/Expiry:</span>
                                     <span className="font-mono text-muted-foreground">
                                       {out.batch_number || 'N/A'} {out.expiry_date && out.expiry_date !== '0000-00-00' ? `| ${out.expiry_date}` : ''}
                                     </span>
                                   </div>
                                </div>
                              )}
                           </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <Boxes className="w-5 h-5 text-muted-foreground" />
                        Material Requirements
                      </h3>
                      <Badge variant="secondary" className="font-mono">
                        {order.items?.length || 0} Components
                      </Badge>
                    </div>

                    <div className="rounded-xl border overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead>Component Part</TableHead>
                            <TableHead className="text-right">Planned Qty</TableHead>
                            <TableHead className="text-right">Consumed Qty</TableHead>
                            <TableHead className="text-right">Unit Cost</TableHead>
                            <TableHead className="text-right">Total Cost</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(order.items || []).map((item: any) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div className="font-semibold">{item.part_name}</div>
                                <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">SKU: {item.sku || 'N/A'}</div>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {Number(item.planned_qty).toLocaleString()} <span className="text-[10px] text-muted-foreground ml-1">{item.unit}</span>
                              </TableCell>
                              <TableCell className="text-right font-bold">
                                {item.actual_qty ? Number(item.actual_qty).toLocaleString() : order.status === 'Completed' ? Number(item.planned_qty).toLocaleString() : '—'} 
                                <span className="text-[10px] text-muted-foreground ml-1">{item.unit}</span>
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {item.unit_cost ? Number(item.unit_cost).toFixed(2) : '—'}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {item.total_cost ? Number(item.total_cost).toFixed(2) : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
               </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-4 space-y-6">
             <Card className="border-none shadow-md bg-slate-900 text-white">
                <CardHeader>
                  <CardTitle className="text-white">Batch Intelligence</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4 font-medium">
                     <div className="flex items-center justify-between text-sm py-2 border-b border-white/10">
                        <span className="text-white/60">Execution Start</span>
                        <span>{order.started_at ? format(new Date(order.started_at), 'MMM d, HH:mm') : 'Not Started'}</span>
                     </div>
                     <div className="flex items-center justify-between text-sm py-2 border-b border-white/10">
                        <span className="text-white/60 text-xs">Production Result</span>
                        <div className="text-right">
                           <div className={cn("font-bold text-lg", Number(order.actual_yield) < Number(order.qty) ? "text-amber-400" : "text-emerald-400")}>
                             {order.actual_yield ? `+${Number(order.actual_yield).toLocaleString()}` : `Target: ${Number(order.qty).toLocaleString()}`}
                           </div>
                           {order.actual_yield && Number(order.actual_yield) < Number(order.qty) && (
                             <div className="text-[10px] text-rose-400 font-bold uppercase tracking-tighter">
                               Loss: {(Number(order.qty) - Number(order.actual_yield)).toLocaleString()} units
                             </div>
                           )}
                        </div>
                     </div>
                     {order.waste_reason && (
                        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px]">
                           <span className="text-rose-300 font-bold uppercase tracking-widest block mb-1">Waste Reason</span>
                           <span className="text-white/80">{order.waste_reason}</span>
                        </div>
                     )}
                     <div className="flex items-center justify-between text-sm py-2 border-t border-white/10">
                        <span className="text-white/60">Execution End</span>
                        <span>{order.completed_at ? format(new Date(order.completed_at), 'MMM d, HH:mm') : 'In Flow'}</span>
                     </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                     <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/50">
                        <AlertCircle className="w-3.5 h-3.5" /> System Mapping
                     </div>
                     <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                           <span className="text-white/60">WIP Ledger</span>
                           <span className="text-emerald-400 font-mono">1410 - Active</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                           <span className="text-white/60">Inventory Sync</span>
                           <Badge variant="outline" className="text-[9px] h-4 border-emerald-500/50 text-emerald-400">Real-time</Badge>
                        </div>
                     </div>
                  </div>
                </CardContent>
             </Card>

             <Card className="border-none shadow-md">
                <CardHeader>
                   <CardTitle className="text-lg">Production Notes</CardTitle>
                </CardHeader>
                <CardContent>
                   <div className={cn("p-4 rounded-xl border bg-muted/20 text-sm whitespace-pre-wrap min-h-[120px]", !order.notes && "italic text-muted-foreground")}>
                      {order.notes || "No notes provided for this batch."}
                   </div>
                   <div className="mt-6 space-y-4">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                         <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <User className="w-4 h-4" />
                         </div>
                         <div>
                            <p className="font-bold text-foreground">Audit Log</p>
                            <p>Transaction ID: PO-{order.id}-{order.order_number}</p>
                         </div>
                      </div>
                   </div>
                </CardContent>
             </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
