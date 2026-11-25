"use client"

import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Search, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { api, fetchParts, PartRow } from '@/lib/api'
import { SearchableSelect } from '@/components/ui/searchable-select'

interface BOMDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  bom?: any // if editing
}

export function ProductionBOMDialog({ open, onOpenChange, onSuccess, bom }: BOMDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [parts, setParts] = useState<PartRow[]>([])
  const [existingBoms, setExistingBoms] = useState<Array<{ id: number; output_part_id: number }>>([])
  
  // Form State
  const [name, setName] = useState('')
  const [version, setVersion] = useState('1.0')
  const [outputPartId, setOutputPartId] = useState<string>('')
  const [outputQty, setOutputQty] = useState('1')
  const [isActive, setIsActive] = useState(true)
  const [items, setItems] = useState<Array<{ part_id: number; qty: number; part_name?: string }>>([])

  useEffect(() => {
    if (open) {
      void loadPartsAndBOMs()
      if (bom) {
        setName(bom.name || '')
        setVersion(bom.version || '1.0')
        setOutputPartId(String(bom.output_part_id || ''))
        setOutputQty(String(bom.output_qty || '1'))
        setIsActive(bom.is_active === 1)
        if (Array.isArray(bom.items)) {
          setItems(bom.items.map((i: any) => ({ 
            part_id: Number(i.part_id), 
            qty: Number(i.qty),
            part_name: i.part_name 
          })))
        }
      } else {
        setName('')
        setVersion('1.0')
        setOutputPartId('')
        setOutputQty('1')
        setIsActive(true)
        setItems([])
      }
    }
  }, [open, bom])

  const loadPartsAndBOMs = async () => {
    try {
      const [partsData, bomsRes] = await Promise.all([
        fetchParts('', 'all'),
        api('/api/productionbom/list').then(r => r.json()).catch(() => ({ data: [] }))
      ])
      setParts(partsData || [])
      if (bomsRes?.status === 'success' && Array.isArray(bomsRes?.data)) {
        setExistingBoms(bomsRes.data.map((b: any) => ({
          id: Number(b.id),
          output_part_id: Number(b.output_part_id)
        })))
      }
    } catch (e) {}
  }

  const addItem = () => {
    setItems([...items, { part_id: 0, qty: 1 }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const handleSubmit = async () => {
    if (!name.trim() || !outputPartId || items.length === 0) {
      toast({ title: "Validation Error", description: "Please fill in all required fields and add at least one component.", variant: "destructive" })
      return
    }

    if (items.some(i => !i.part_id || Number(i.qty) <= 0)) {
       toast({ title: "Validation Error", description: "All components must have a valid part and quantity > 0.", variant: "destructive" })
       return
    }

    setLoading(true)
    try {
      const payload = {
        name,
        version,
        output_part_id: Number(outputPartId),
        output_qty: Number(outputQty),
        is_active: isActive ? 1 : 0,
        items: items.map(i => ({ part_id: i.part_id, qty: Number(i.qty) }))
      }

      const url = bom ? `/api/productionbom/update/${bom.id}` : `/api/productionbom/create`
      
      const res = await api(url, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      const data = await res.json()

      if (data.status === 'success') {
        toast({ title: "Success", description: bom ? "BOM updated" : "BOM created" })
        onSuccess()
        onOpenChange(false)
      } else {
        throw new Error(data.message || 'Failed to save BOM')
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // Cost Calculations
  const totalBOMCost = items.reduce((sum, item) => {
    const part = parts.find(p => p.id === item.part_id)
    const cost = part?.cost_price ? Number(part.cost_price) : 0
    return sum + (cost * Number(item.qty || 0))
  }, 0)

  const finishedUnitCost = Number(outputQty) > 0 ? totalBOMCost / Number(outputQty) : 0

  // Calculate finished product options (allow current BOM's product or currently selected product, filter out products assigned to other BOMs)
  const currentBomId = bom?.id ? Number(bom.id) : null
  const currentSelectedPartId = outputPartId ? Number(outputPartId) : (bom?.output_part_id ? Number(bom.output_part_id) : null)
  const partIdsInOtherBoms = new Set(
    existingBoms
      .filter(b => currentBomId === null || b.id !== currentBomId)
      .map(b => b.output_part_id)
  )

  const finishedProductOptions = parts
    .filter(p => {
      const pid = Number(p.id)
      if (currentSelectedPartId !== null && pid === currentSelectedPartId) return true
      return !partIdsInOtherBoms.has(pid)
    })
    .map(p => ({
      value: String(p.id),
      label: `${p.part_name} (${p.sku || 'No SKU'})`
    }))


  const outPart = parts.find(p => String(p.id) === outputPartId)
  const outUnit = outPart?.unit || ''
  const outQtyNum = Number(outputQty) || 0
  const partOptions = parts.map(p => ({ value: String(p.id), label: `${p.part_name} (${p.sku || 'No SKU'})` }))
  // Yield: only meaningful when every input uses the same unit as the output (e.g. 5 kg raw -> 4 kg cleaned).
  const inputQtySameUnit = items.reduce((s, i) => s + Number(i.qty || 0), 0)
  const sameUnit = !!outUnit && items.length > 0 && items.every(i => parts.find(p => p.id === i.part_id)?.unit === outUnit)
  const yieldPct = sameUnit && inputQtySameUnit > 0 ? (outQtyNum / inputQtySameUnit) * 100 : null
  const money = (v: number) => v.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-3">
          <DialogTitle className="text-base">{bom ? 'Edit Bill of Materials' : 'New Bill of Materials'}</DialogTitle>
          <p className="text-xs text-muted-foreground">Materials used to make one batch of a product, and how much it gives.</p>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Header fields */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="space-y-1 md:col-span-5">
              <Label className="text-xs">Name <span className="text-destructive">*</span></Label>
              <Input className="h-9 text-sm" placeholder="e.g. Chicken cleaning" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Version</Label>
              <Input className="h-9 text-sm" placeholder="1.0" value={version} onChange={e => setVersion(e.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-5">
              <Label className="text-xs">Status</Label>
              <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <span className={isActive ? 'font-medium text-emerald-600' : 'text-muted-foreground'}>{isActive ? 'Active' : 'Draft'}</span>
                <span className="ml-auto hidden text-[11px] text-muted-foreground sm:inline">Only active BOMs are used for production</span>
              </label>
            </div>
          </div>

          {/* Output */}
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Makes (output)</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="space-y-1 md:col-span-8">
                <Label className="text-xs">Finished product <span className="text-destructive">*</span></Label>
                <SearchableSelect placeholder="Select product..." options={finishedProductOptions} value={outputPartId}
                  onValueChange={setOutputPartId} disablePortal={true} triggerClassName="h-9 text-sm" />
              </div>
              <div className="space-y-1 md:col-span-4">
                <Label className="text-xs">Output quantity (per batch)</Label>
                <div className="relative">
                  <Input type="number" step="0.001" min="0" className={`h-9 text-sm tabular-nums ${outUnit ? 'pr-12' : ''}`}
                    value={outputQty} onChange={e => setOutputQty(e.target.value)} />
                  {outUnit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{outUnit}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Components */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Uses (materials) · {items.length}</div>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-8 gap-1.5 border-dashed">
                <Plus className="h-4 w-4" /> Add material
              </Button>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-8 px-2 py-1.5 text-left font-medium">#</th>
                    <th className="px-2 py-1.5 text-left font-medium">Material</th>
                    <th className="w-28 px-2 py-1.5 text-right font-medium">Unit cost</th>
                    <th className="w-36 px-2 py-1.5 text-left font-medium">Qty</th>
                    <th className="w-28 px-2 py-1.5 text-right font-medium">Cost</th>
                    <th className="w-9" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item, idx) => {
                    const part = parts.find(p => p.id === item.part_id)
                    const costPrice = part?.cost_price ? Number(part.cost_price) : 0
                    const lineTotal = costPrice * Number(item.qty || 0)
                    const unit = part?.unit || ''
                    return (
                      <tr key={idx} className="align-middle">
                        <td className="px-2 py-1.5 text-xs text-muted-foreground">{idx + 1}</td>
                        <td className="px-2 py-1.5">
                          <SearchableSelect placeholder="Search material..." options={partOptions}
                            value={item.part_id ? String(item.part_id) : ''}
                            onValueChange={(val) => handleItemChange(idx, 'part_id', Number(val))}
                            disablePortal={true} triggerClassName="h-8 text-sm" />
                        </td>
                        <td className="px-2 py-1.5 text-right text-xs tabular-nums text-muted-foreground">
                          {part ? `${money(costPrice)}${unit ? ` / ${unit}` : ''}` : '—'}
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="relative">
                            <Input type="number" step="0.001" min="0" value={item.qty}
                              onChange={e => handleItemChange(idx, 'qty', e.target.value)}
                              className={`h-8 text-sm tabular-nums ${unit ? 'pr-11' : ''}`} aria-label={`Quantity for material ${idx + 1}`} />
                            {unit && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">{unit}</span>}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right text-xs font-medium tabular-nums">{part ? money(lineTotal) : '—'}</td>
                        <td className="px-1 py-1.5">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeItem(idx)} aria-label={`Remove material ${idx + 1}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                        No materials yet. <button type="button" onClick={addItem} className="font-medium text-primary hover:underline">Add the first one</button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border p-2.5">
              <div className="text-[11px] text-muted-foreground">Material cost</div>
              <div className="text-sm font-semibold tabular-nums">LKR {money(totalBOMCost)}</div>
            </div>
            <div className="rounded-lg border p-2.5">
              <div className="text-[11px] text-muted-foreground">Output</div>
              <div className="text-sm font-semibold tabular-nums">{outQtyNum.toLocaleString('en-LK', { maximumFractionDigits: 3 })} {outUnit}</div>
            </div>
            <div className="rounded-lg border p-2.5">
              <div className="text-[11px] text-muted-foreground">Yield</div>
              <div className={`text-sm font-semibold tabular-nums ${yieldPct !== null && yieldPct < 100 ? 'text-amber-600' : ''}`}>
                {yieldPct === null ? <span className="font-normal text-muted-foreground">—</span>
                  : `${yieldPct.toFixed(1)}% · loss ${Math.max(0, inputQtySameUnit - outQtyNum).toLocaleString('en-LK', { maximumFractionDigits: 3 })} ${outUnit}`}
              </div>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5">
              <div className="text-[11px] text-primary">Cost per {outUnit || 'unit'}</div>
              <div className="text-base font-bold tabular-nums text-primary">LKR {money(finishedUnitCost)}</div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t px-5 py-3">
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={loading} className="gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {bom ? 'Save changes' : 'Create BOM'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
