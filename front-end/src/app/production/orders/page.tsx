"use client"

import React, { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Search, Loader2, ClipboardList, Play, CheckCircle, MapPin, Calendar, MoreVertical, Eye } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function ProductionOrdersPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/productionorder/list')
      const data = await res.json()
      if (data.status === 'success') {
        setOrders(data.data || [])
      }
    } catch (e: any) {
      toast({ title: "Error", description: "Failed to load orders", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = orders.filter(o => 
    (o.order_number || '').toLowerCase().includes(query.toLowerCase()) ||
    (o.output_part_name || '').toLowerCase().includes(query.toLowerCase())
  )

  const handleStart = async (id: number) => {
    setActionLoading(id)
    try {
      const res = await api(`/api/productionorder/start/${id}`, { method: 'POST' })
      const data = await res.json()
      if (data.status === 'success') {
        toast({ title: "Started", description: "Material consumed and production started." })
        await load()
      } else {
        throw new Error(data.message)
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setActionLoading(null)
    }
  }

  const handleComplete = async (id: number) => {
    setActionLoading(id)
    try {
      const res = await api(`/api/productionorder/complete/${id}`, { method: 'POST' })
      const data = await res.json()
      if (data.status === 'success') {
        toast({ title: "Completed", description: "Finished goods received into stock." })
        await load()
      } else {
        throw new Error(data.message)
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Planned': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Planned</Badge>
      case 'InProgress': return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">In Progress</Badge>
      case 'Completed': return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Completed</Badge>
      case 'Cancelled': return <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">Cancelled</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Production Orders</h1>
            <p className="text-muted-foreground mt-1">Track manufacturing lifecycle from planned to completed.</p>
          </div>
          <Button asChild className="gap-2">
            <Link href="/production/orders/new">
              <Plus className="w-4 h-4" /> New Order
            </Link>
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by order # or product..." 
              className="pl-10"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>

        <Card className="border-none shadow-md overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p>Loading production orders...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-4">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                  <ClipboardList className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground">No orders found</p>
                  <p className="text-sm text-muted-foreground">Plan your first production batch.</p>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((order) => (
                    <TableRow key={order.id} className="group hover:bg-muted/10 transition-colors cursor-pointer" onClick={() => router.push(`/production/orders/${order.id}`)}>
                      <TableCell className="font-bold">{order.order_number}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{order.output_part_name}</span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                            BOM: {order.bom_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                          {order.location_name}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono font-bold">
                        {Number(order.qty).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(order.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                          {order.status === 'Planned' && (
                            <Button 
                              size="sm" 
                              variant="default" 
                              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 h-8"
                              onClick={() => handleStart(order.id)}
                              disabled={actionLoading === order.id}
                            >
                              {actionLoading === order.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <Play className="w-3 h-3" />}
                              Start
                            </Button>
                          )}
                          {order.status === 'InProgress' && (
                            <Button 
                              size="sm" 
                              variant="default" 
                              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-8"
                              onClick={() => handleComplete(order.id)}
                              disabled={actionLoading === order.id}
                            >
                              {actionLoading === order.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <CheckCircle className="w-3 h-3" />}
                              Finish
                            </Button>
                          )}
                          {order.status === 'Completed' && (
                            <Badge variant="outline" className="h-8 border-emerald-200">Audit Ready</Badge>
                          )}
                          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                            <Link href={`/production/orders/${order.id}`}>
                              <Eye className="w-4 h-4" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dedicated pages used instead of dialog */}
    </DashboardLayout>
  )
}
