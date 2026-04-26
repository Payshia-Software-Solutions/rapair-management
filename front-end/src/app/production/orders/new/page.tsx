"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { api, fetchLocations } from '@/lib/api'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Loader2, ChevronLeft, Boxes, AlertCircle, Info } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export default function NewProductionOrderPage() {
  const router = useRouter()
  const { toast } = useToast()
  
  const [loadingData, setLoadingData] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  
  const [boms, setBoms] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  
  // Form State
  const [locationId, setLocationId] = useState('')
  const [batch, setBatch] = useState<any[]>([])
  const [stockLevels, setStockLevels] = useState<Record<number, number>>({})
  
  // Current Item State
  const [bomId, setBomId] = useState('')
  const [qty, setQty] = useState('1')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    void loadData()
    const lsLocId = window.localStorage.getItem('location_id')
    if (lsLocId) setLocationId(lsLocId)
  }, [])

  const loadData = async () => {
    try {
      const [bomRes, locData] = await Promise.all([
        api('/api/productionbom/list?active=1'),
        fetchLocations()
      ])
      const bomData = await bomRes.json()
      setBoms(bomData.data || [])
      setLocations(locData.filter((l: any) => l.allow_production))
    } catch (e) {
      toast({ title: "Error", description: "Failed to load master data", variant: "destructive" })
    } finally {
      setLoadingData(false)
    }
  }

  const selectedBOM = useMemo(() => boms.find(b => String(b.id) === bomId), [boms, bomId])
  
  const addToBatch = () => {
    if (!bomId || Number(qty) <= 0) {
      toast({ title: "Validation Error", description: "Select a BOM and valid quantity.", variant: "destructive" })
      return
    }
    
    setBatch(prev => [
      ...prev,
      {
        id: Date.now(), // temp id for key
        bom_id: Number(bomId),
        bom_name: selectedBOM.name,
        output_part_name: selectedBOM.output_part_name,
        qty: Number(qty),
        notes,
        location_id: Number(locationId)
      }
    ])
    
    // Reset item fields
    setBomId('')
    setQty('1')
    setNotes('')
    
    toast({ title: "Added", description: `${selectedBOM.name} added to production batch.` })
  }

  const removeFromBatch = (id: number) => {
    setBatch(prev => prev.filter(item => item.id !== id))
  }

  const handleSubmit = async () => {
    if (batch.length === 0) {
      toast({ title: "Validation Error", description: "Your batch is empty. Add at least one production item.", variant: "destructive" })
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        location_id: Number(locationId),
        notes: "Consolidated Batch",
        outputs: batch.map(b => ({
          bom_id: b.bom_id,
          qty: b.qty,
          notes: b.notes
        }))
      }

      const res = await api('/api/productionorder/create', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      const data = await res.json()

      if (data.status === 'success') {
        toast({ title: "Success", description: "Consolidated production batch initialized." })
        router.push('/production/orders')
      } else {
        throw new Error(data.message || 'Failed to create batch')
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const materialBatchPreview = useMemo(() => {
    const map = new Map<number, { part_id: number, name: string, qty: number, unit: string, sku: string }>()
    batch.forEach(order => {
      const bom = boms.find(b => b.id === order.bom_id)
      if (bom && bom.items) {
        bom.items.forEach((item: any) => {
          const current = map.get(item.part_id) || { part_id: item.part_id, name: item.part_name, qty: 0, unit: item.unit, sku: item.sku }
          current.qty += (item.qty * order.qty)
          map.set(item.part_id, current)
        })
      }
    })
    return Array.from(map.values()).map((m: any) => ({
      ...m,
      available: stockLevels[m.part_id] ?? 0
    }))
  }, [batch, boms, stockLevels])

  const hasShortage = useMemo(() => {
    return materialBatchPreview.some((m: any) => m.available < m.qty)
  }, [materialBatchPreview])

  useEffect(() => {
    if (batch.length > 0 && locationId) {
      void fetchBatchStock()
    }
  }, [batch, locationId])

  const fetchBatchStock = async () => {
    const partIds = materialBatchPreview.map((m: any) => m.part_id)
    if (partIds.length === 0) return

    try {
      const res = await api(`/api/inventory/stock-levels`, {
        method: 'POST',
        body: JSON.stringify({ part_ids: partIds, location_id: Number(locationId) })
      })
      const data = await res.json()
      if (data.status === 'success') {
        const levels: Record<number, number> = {}
        data.data.forEach((item: any) => {
          levels[item.part_id] = Number(item.available)
        })
        setStockLevels(levels)
      }
    } catch (e) {
      console.error("Failed to fetch stock levels", e)
    }
  }

  if (loadingData) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading plan...
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className="gap-2 -ml-2 text-muted-foreground hover:text-foreground" onClick={() => router.back()}>
            <ChevronLeft className="w-4 h-4" />
            Back to Queue
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">Plan Production</h1>
          <p className="text-muted-foreground mt-1 text-lg">Initialize a new manufacturing batch and reserve materials.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-6">
            <Card className="border-none shadow-md">
              <CardHeader>
                <CardTitle>Batch Settings</CardTitle>
                <CardDescription>Select the product and production parameters.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>1. Location / Factory</Label>
                  <SearchableSelect
                    placeholder="Select where to produce..."
                    options={locations.map(l => ({ value: String(l.id), label: l.name }))}
                    value={locationId}
                    onValueChange={setLocationId}
                    disabled={batch.length > 0}
                  />
                  {batch.length > 0 && (
                    <p className="text-[10px] text-amber-600 font-bold uppercase">Location locked for this batch</p>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <Label className={!locationId ? "text-muted-foreground" : ""}>2. Add Products to Batch</Label>
                  <SearchableSelect
                    placeholder={!locationId ? "Select a location first..." : "Select product to add..."}
                    options={boms.map(b => ({ value: String(b.id), label: `${b.name} (${b.output_part_name})` }))}
                    value={bomId}
                    onValueChange={setBomId}
                    disabled={!locationId}
                  />
                  
                  <div className="flex gap-4 mt-4">
                    <div className="flex-1 space-y-2">
                      <Label>Target Qty</Label>
                      <Input 
                        type="number" 
                        step="0.001" 
                        value={qty} 
                        onChange={e => setQty(e.target.value)}
                        disabled={!bomId}
                      />
                    </div>
                    <div className="flex-[2] space-y-2">
                      <Label>Notes (Optional)</Label>
                      <Input 
                        placeholder="Lot #, etc."
                        value={notes} 
                        onChange={e => setNotes(e.target.value)}
                        disabled={!bomId}
                      />
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    className="w-full mt-4 border-dashed border-2 hover:border-primary hover:text-primary transition-all gap-2"
                    onClick={addToBatch}
                    disabled={!bomId}
                  >
                    <Boxes className="w-4 h-4" />
                    Add Product to Queue
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Button 
              onClick={handleSubmit} 
              disabled={submitting || batch.length === 0 || hasShortage} 
              className={cn("w-full h-14 text-lg shadow-lg gap-2", hasShortage ? "bg-muted text-muted-foreground shadow-none" : "shadow-primary/20")}
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin"/> : <Boxes className="w-5 h-5" />}
              {hasShortage ? "Insufficient Stock to Plan" : `Initialize Batch (${batch.length} Orders)`}
            </Button>
            {hasShortage && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold border border-rose-100">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Production blocked until materials are replenished.
              </div>
            )}
          </div>

          <div className="lg:col-span-7 space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Batch Queue</CardTitle>
                  <CardDescription>Items ready for planning.</CardDescription>
                </div>
                <Badge variant="secondary" className="font-mono">{batch.length} items</Badge>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batch.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-10 text-muted-foreground italic text-sm">
                            Queue is empty. Add products to start planning.
                          </TableCell>
                        </TableRow>
                      ) : (
                        batch.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="font-medium">{item.bom_name}</div>
                              <div className="text-[10px] text-muted-foreground">{item.notes || 'No notes'}</div>
                            </TableCell>
                            <TableCell className="text-right font-bold">{item.qty}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeFromBatch(item.id)}>
                                ×
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle>Aggregated Material Preview</CardTitle>
                  <CardDescription>Total requirements for the entire batch.</CardDescription>
                </div>
                {batch.length > 0 && (
                   <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                     {materialBatchPreview.length} Total Components
                   </Badge>
                )}
              </CardHeader>
              <CardContent>
                {batch.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground gap-3">
                    <Info className="w-8 h-8 opacity-20"/>
                    <p className="text-sm">Aggregated material needs will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead>Component</TableHead>
                            <TableHead className="text-right">Total Batch Requirement</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {materialBatchPreview.map((item: any, idx: number) => (
                            <TableRow key={idx} className={item.available < item.qty ? "bg-rose-50/50 dark:bg-rose-950/10" : ""}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {item.available < item.qty && <AlertCircle className="w-3.5 h-3.5 text-destructive" />}
                                  <div>
                                    <div className="font-semibold">{item.name}</div>
                                    <div className="text-[10px] text-muted-foreground font-mono">{item.sku || 'NO-SKU'}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-col items-end">
                                  <div className="text-xs text-muted-foreground mb-0.5">Avail: {item.available.toLocaleString()}</div>
                                  <div className={cn("font-bold text-base", item.available < item.qty ? "text-destructive" : "text-primary")}>
                                    {item.qty.toLocaleString()} {item.unit}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    
                    <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 dark:bg-indigo-500/10 dark:border-indigo-500/20">
                       <div className="flex gap-3">
                          <AlertCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                          <div className="text-sm text-indigo-900 dark:text-indigo-200">
                             <p className="font-bold">Batch Planning Mode</p>
                             <p className="mt-0.5 opacity-80">Common materials are aggregated to help you coordinate inventory moves for the whole factory floor at once.</p>
                          </div>
                       </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
