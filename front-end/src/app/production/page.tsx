"use client"

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Factory, 
  ClipboardList, 
  Play, 
  CheckCircle, 
  Plus, 
  ChevronRight, 
  Loader2, 
  TrendingUp,
  Boxes,
  Package
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

export default function ProductionOverviewPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/productionorder/stats')
      const data = await res.json()
      if (data.status === 'success') {
        setStats(data.data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const getCount = (status: string) => {
    if (!stats?.status_counts) return 0
    const match = stats.status_counts.find((s: any) => s.status === status)
    return match ? Number(match.count) : 0
  }

  const cards = [
    {
      label: "Active BOMs",
      value: stats?.active_boms || 0,
      icon: Factory,
      color: "text-blue-600",
      bg: "bg-blue-50",
      href: "/production/bom"
    },
    {
      label: "Planned Orders",
      value: getCount('Planned'),
      icon: ClipboardList,
      color: "text-amber-600",
      bg: "bg-amber-50",
      href: "/production/orders"
    },
    {
      label: "In Progress",
      value: getCount('InProgress'),
      icon: Play,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      href: "/production/orders"
    },
    {
      label: "Completed",
      value: getCount('Completed'),
      icon: CheckCircle,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      href: "/production/orders"
    }
  ]

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8">
        {/* Header Section */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-indigo-500/10 via-background to-background p-8">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-indigo-600 font-bold mb-2">Manufacturing Hub</div>
              <h1 className="text-3xl font-bold tracking-tight">Production Management</h1>
              <p className="text-muted-foreground mt-2 max-w-xl">
                Streamline your assembly line. Track material consumption, manage product recipes, and monitor production batches in real-time.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button asChild size="lg" className="shadow-lg shadow-primary/20 bg-indigo-600 hover:bg-indigo-700">
                <Link href="/production/orders/new" className="gap-2">
                  <Play className="w-4 h-4" /> Plan Batch
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((c, i) => (
            <Link key={i} href={c.href}>
              <Card className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className={cn("p-3 rounded-xl", c.bg, c.color)}>
                      <c.icon className="w-6 h-6" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </div>
                  <div className="mt-4">
                    <div className="text-3xl font-bold">{loading ? <Loader2 className="w-6 h-6 animate-spin"/> : c.value}</div>
                    <div className="text-sm font-medium text-muted-foreground mt-1">{c.label}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Quick Actions & Recent Info */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-8 border-none shadow-sm">
            <CardHeader>
              <CardTitle>Core Workflows</CardTitle>
              <CardDescription>Follow these steps to manage your production process.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link href="/production/bom">
                <div className="p-4 rounded-xl border-2 border-dashed hover:border-indigo-500 hover:bg-indigo-500/5 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                      <Factory className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold group-hover:text-indigo-600 transition-colors">1. Define BOMs</div>
                      <p className="text-xs text-muted-foreground">Create recipes for your finished goods by listing raw materials.</p>
                    </div>
                  </div>
                </div>
              </Link>
              <Link href="/production/orders">
                <div className="p-4 rounded-xl border-2 border-dashed hover:border-emerald-500 hover:bg-emerald-500/5 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold group-hover:text-emerald-600 transition-colors">2. Create Batch</div>
                      <p className="text-xs text-muted-foreground">Plan a production batch and select the target quantity.</p>
                    </div>
                  </div>
                </div>
              </Link>
              <div className="p-4 rounded-xl border bg-muted/30">
                 <div className="flex items-center gap-4 opacity-70">
                    <div className="w-12 h-12 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold">3. Track Material Cost</div>
                      <p className="text-xs text-muted-foreground">Costs are automatically calculated based on material consumption.</p>
                    </div>
                  </div>
              </div>
              <div className="p-4 rounded-xl border bg-muted/30">
                 <div className="flex items-center gap-4 opacity-70">
                    <div className="w-12 h-12 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                      <Boxes className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold">4. Automatic WIP</div>
                      <p className="text-xs text-muted-foreground">Accounting entries for Work in Progress are posted automatically.</p>
                    </div>
                  </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-4 border-none shadow-sm bg-gradient-to-br from-slate-900 to-slate-800 text-white">
            <CardHeader>
              <CardTitle className="text-white">Quick Navigation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <Link href="/production/orders" className="flex items-center justify-between p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors group">
                  <span className="font-medium">Active Production Orders</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
               </Link>
               <Link href="/production/bom" className="flex items-center justify-between p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors group">
                  <span className="font-medium">Master Formulas (BOM)</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
               </Link>
               <Link href="/inventory/items" className="flex items-center justify-between p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors group">
                  <span className="font-medium">Raw Materials Inventory</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
               </Link>
               <div className="pt-4 border-t border-white/10 mt-4">
                  <div className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-4">Production Status</div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/70">WIP Mapped</span>
                      <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-400/10">Connected</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/70">Inventory Sync</span>
                      <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-400/10">Real-time</Badge>
                    </div>
                  </div>
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
