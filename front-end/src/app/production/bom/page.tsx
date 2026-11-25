"use client"

import React, { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Search, Loader2, Factory, Edit2, ChevronRight, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import { ProductionBOMDialog } from '@/components/production/bom-dialog'

export default function BOMPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [boms, setBoms] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedBOM, setSelectedBOM] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/productionbom/list')
      const data = await res.json()
      if (data.status === 'success') {
        setBoms(data.data || [])
      }
    } catch (e: any) {
      toast({ title: "Error", description: "Failed to load BOMs", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = boms.filter(b => 
    (b.name || '').toLowerCase().includes(query.toLowerCase()) ||
    (b.output_part_name || '').toLowerCase().includes(query.toLowerCase())
  )

  const handleEdit = (bom: any) => {
    setSelectedBOM(bom)
    setDialogOpen(true)
  }

  const handleNew = () => {
    setSelectedBOM(null)
    setDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this BOM?")) return;
    try {
      const res = await api(`/api/productionbom/delete/${id}`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'success') {
        toast({ title: "Success", description: "BOM deleted successfully" });
        void load();
      } else {
        toast({ title: "Error", description: data.message || "Failed to delete BOM", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete BOM", variant: "destructive" });
    }
  }


  const qtyFmt = (v: any) => Number(v || 0).toLocaleString('en-LK', { maximumFractionDigits: 3 })
  const money = (v: any) => Number(v || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const activeCount = boms.filter(b => Number(b.is_active) === 1).length

  return (
    <DashboardLayout>
      <div className="w-full space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Bill of Materials</h1>
            <p className="text-xs text-muted-foreground">
              What each product is made from · {boms.length} total, {activeCount} active
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search BOM or product..." className="h-9 w-56 pl-8 text-sm sm:w-72" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <Button size="sm" onClick={handleNew} className="h-9 gap-1.5">
              <Plus className="h-4 w-4" /> New BOM
            </Button>
          </div>
        </div>

        <Card className="overflow-hidden shadow-sm">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
                <Factory className="h-8 w-8" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{query ? 'No BOMs match your search' : 'No BOMs yet'}</p>
                  {!query && <p className="text-xs">Create one to say what a product is made from and how much it gives.</p>}
                </div>
                {!query && <Button size="sm" variant="outline" onClick={handleNew}>Create BOM</Button>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">BOM</th>
                      <th className="px-3 py-2 text-left font-medium">Makes</th>
                      <th className="px-3 py-2 text-right font-medium">Output</th>
                      <th className="px-3 py-2 text-left font-medium">Materials</th>
                      <th className="px-3 py-2 text-right font-medium">Cost / unit</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                      <th className="w-20 px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map((bom) => {
                      const mats: any[] = Array.isArray(bom.items) ? bom.items : []
                      const shown = mats.slice(0, 3).map(m => m.part_name).filter(Boolean)
                      const active = Number(bom.is_active) === 1
                      return (
                        <tr key={bom.id} className="cursor-pointer hover:bg-muted/20" onClick={() => handleEdit(bom)}>
                          <td className="px-3 py-2">
                            <div className="font-medium">{bom.name}</div>
                            <div className="text-[11px] text-muted-foreground">v{bom.version || '1.0'}</div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{bom.output_part_name}</div>
                            <div className="text-[11px] text-muted-foreground">{bom.output_sku || 'No SKU'}</div>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{qtyFmt(bom.output_qty)} {bom.output_unit || ''}</td>
                          <td className="px-3 py-2">
                            <div className="max-w-[280px] truncate text-xs text-muted-foreground" title={mats.map(m => m.part_name).join(', ')}>
                              <span className="font-medium text-foreground">{bom.item_count || 0}</span>
                              {shown.length > 0 && ` · ${shown.join(', ')}${mats.length > 3 ? ` +${mats.length - 3}` : ''}`}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{bom.output_cost != null ? `LKR ${money(bom.output_cost)}` : '—'}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${active ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600' : 'text-muted-foreground'}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-muted-foreground/50'}`} />
                              {active ? 'Active' : 'Draft'}
                            </span>
                          </td>
                          <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-end gap-0.5">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(bom)} aria-label={`Edit ${bom.name}`}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(bom.id)} aria-label={`Delete ${bom.name}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ProductionBOMDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={load}
        bom={selectedBOM}
      />
    </DashboardLayout>
  )
}
