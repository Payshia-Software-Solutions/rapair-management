"use client";

import React, { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { 
  Database, 
  Search, 
  ChevronRight, 
  ChevronDown, 
  Table as TableIcon, 
  Info,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCcw,
  Code
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Column = {
  column: string;
  type: string;
  nullable: string;
  default: string | null;
  extra: string;
};

type TableData = Record<string, Column[]>;

export default function AdminSchemaPage() {
  const [data, setData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);

  const fetchSchema = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api("/api/admin/schema");
      const json = await res.json();
      if (json.status === "success") {
        setData(json.data);
      } else {
        throw new Error(json.message || "Failed to fetch schema");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!confirm("Are you sure you want to synchronize the production database? This will repair missing tables and columns.")) return;
    
    setSyncing(true);
    setError(null);
    try {
      const res = await api("/api/admin/sync", { method: "POST" });
      const json = await res.json();
      if (json.status === "success") {
        alert("Database synchronized successfully!");
        void fetchSchema();
      } else {
        throw new Error(json.message || "Sync failed");
      }
    } catch (err: any) {
      setError(err.message || "Sync failed");
      alert("Error: " + (err.message || "Sync failed"));
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    void fetchSchema();
  }, []);

  const toggleTable = (tableName: string) => {
    const next = new Set(expandedTables);
    if (next.has(tableName)) {
      next.delete(tableName);
    } else {
      next.add(tableName);
    }
    setExpandedTables(next);
  };

  const filteredTables = useMemo(() => {
    if (!data) return [];
    const query = searchQuery.toLowerCase().trim();
    return Object.keys(data).filter(name => 
      name.toLowerCase().includes(query) || 
      data[name].some(col => col.column.toLowerCase().includes(query))
    ).sort();
  }, [data, searchQuery]);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Database Schema</h1>
            <p className="text-muted-foreground mt-1">
              Verify real-time table structures and column definitions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => void handleSync()} 
              disabled={syncing || loading} 
              className="gap-2 bg-primary hover:bg-primary/90 shadow-sm"
            >
              <RefreshCcw className={cn("w-4 h-4", syncing && "animate-spin")} />
              Sync Production Database
            </Button>
            <Button variant="outline" size="sm" onClick={() => void fetchSchema()} disabled={loading || syncing} className="gap-2">
              <RefreshCcw className={cn("w-4 h-4", loading && !syncing && "animate-spin")} />
              Refresh
            </Button>
            <Badge variant="secondary" className="px-3 py-1 bg-green-500/10 text-green-500 border-green-500/20 gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Connected
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1 bg-card/50 backdrop-blur-sm border-none shadow-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                Snapshot Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Total Tables</span>
                <span className="font-bold">{data ? Object.keys(data).length : "..."}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="text-green-500 font-medium">Synchronized</span>
              </div>
              <div className="pt-2 border-t">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  This tool displays the live structure of the MySQL database. 
                  Any missing columns here should be synced to the <code className="text-primary">database.sql</code> file.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="md:col-span-2 space-y-4">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="Search tables or columns..." 
                className="pl-10 bg-background/50 border-none shadow-sm focus-visible:ring-1" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground animate-pulse">Scanning database structure...</p>
              </div>
            ) : error ? (
              <Card className="border-destructive/20 bg-destructive/5">
                <CardContent className="flex items-center gap-3 py-6">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  <p className="text-sm font-medium text-destructive">{error}</p>
                </CardContent>
              </Card>
            ) : filteredTables.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed rounded-xl border-muted">
                <TableIcon className="w-10 h-10 text-muted mx-auto mb-3" />
                <p className="text-muted-foreground">No tables matching your search</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTables.map((tableName) => (
                  <Card key={tableName} className="overflow-hidden border-none shadow-sm transition-all hover:shadow-md">
                    <button 
                      onClick={() => toggleTable(tableName)}
                      className="w-full flex items-center justify-between p-4 bg-card/30 hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <TableIcon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="text-left">
                          <h3 className="font-bold text-base">{tableName}</h3>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            {data?.[tableName].length} Columns
                          </p>
                        </div>
                      </div>
                      {expandedTables.has(tableName) ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                    {expandedTables.has(tableName) && (
                      <CardContent className="p-0 border-t bg-background/40">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/30">
                                <th className="text-left py-2 px-4 font-semibold text-muted-foreground">Field</th>
                                <th className="text-left py-2 px-4 font-semibold text-muted-foreground">Type</th>
                                <th className="text-center py-2 px-4 font-semibold text-muted-foreground">Null</th>
                                <th className="text-left py-2 px-4 font-semibold text-muted-foreground">Default</th>
                                <th className="text-left py-2 px-4 font-semibold text-muted-foreground">Extra</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data?.[tableName].map((col, idx) => (
                                <tr key={idx} className="border-b last:border-0 hover:bg-accent/20 transition-colors">
                                  <td className="py-2.5 px-4 font-mono text-xs font-semibold text-primary">{col.column}</td>
                                  <td className="py-2.5 px-4 text-xs">{col.type}</td>
                                  <td className="py-2.5 px-4 text-center">
                                    <Badge variant={col.nullable === "YES" ? "outline" : "secondary"} className="text-[10px] uppercase font-bold px-1.5 py-0">
                                      {col.nullable === "YES" ? "Null" : "Not Null"}
                                    </Badge>
                                  </td>
                                  <td className="py-2.5 px-4 text-xs font-mono text-muted-foreground">
                                    {col.default === null ? <span className="italic opacity-50">NULL</span> : col.default}
                                  </td>
                                  <td className="py-2.5 px-4 text-[10px] font-bold text-amber-500 uppercase">
                                    {col.extra}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
