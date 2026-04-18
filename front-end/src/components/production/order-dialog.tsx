"use client"

import React, { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { api, fetchLocations } from '@/lib/api'
import { SearchableSelect } from '@/components/ui/searchable-select'

interface OrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ProductionOrderDialog({ open, onOpenChange, onSuccess }: OrderDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [boms, setBoms] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  
  // Form State
  const [bomId, setBomId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [qty, setQty] = useState('1')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (open) {
      void loadData()
      // Default location from local storage
      const lsLocId = window.localStorage.getItem('location_id')
      if (lsLocId) setLocationId(lsLocId)
    }
  }, [open])

  const loadData = async () => {
    try {
      const bomRes = await api('/api/productionbom/list?active=1')
      const bomData = await bomRes.json()
      setBoms(bomData.data || [])

      const locData = await fetchLocations()
      // Filter locations that allow production
      setLocations(locData.filter((l: any) => l.allow_production))
    } catch (e) {}
  }

  const handleSubmit = async () => {
    if (!bomId || !locationId || Number(qty) <= 0) {
      toast({ title: "Validation Error", description: "Please select BOM, Location and valid Quantity.", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      const payload = {
        bom_id: Number(bomId),
        location_id: Number(locationId),
        qty: Number(qty),
        notes
      }

      const res = await api('/api/productionorder/create', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      const data = await res.json()

      if (data.status === 'success') {
        toast({ title: "Success", description: "Production order created." })
        onSuccess()
        onOpenChange(false)
      } else {
        throw new Error(data.message || 'Failed to create order')
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Production Order</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select Bill of Materials (BOM)</Label>
            <SearchableSelect
              placeholder="Select BOM..."
              options={boms.map(b => ({ value: String(b.id), label: `${b.name} (${b.output_part_name})` }))}
              value={bomId}
              onValueChange={setBomId}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Location</Label>
              <SearchableSelect
                placeholder="Select factory..."
                options={locations.map(l => ({ value: String(l.id), label: l.name }))}
                value={locationId}
                onValueChange={setLocationId}
              />
              <p className="text-[10px] text-muted-foreground">Only locations with 'Allow Production' enabled are shown.</p>
            </div>
            <div className="space-y-2">
              <Label>Target Quantity</Label>
              <Input type="number" step="0.001" value={qty} onChange={e => setQty(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Input placeholder="Batch number, special instructions..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading} className="gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
