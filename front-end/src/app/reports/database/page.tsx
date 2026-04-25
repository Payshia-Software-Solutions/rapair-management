"use client";

import React, { useEffect, useState, useMemo } from "react";
import { ReportShell } from "../_components/report-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { fetchDatabaseAudit, fetchSchemaDiff, syncSchema } from "@/lib/api/reports";
import { Loader2, Database, ShieldCheck, ShieldAlert, Search, Table as TableIcon, RefreshCw, Camera, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function DatabaseAuditPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ tables: any[]; optimizations: any[] } | null>(null);
  const [diff, setDiff] = useState<{ 
    defined_table_count: number, 
    live_table_count: number,
    missing_tables: string[], 
    missing_columns: any[], 
    missing_indexes: any[] 
  } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [auditRes, diffRes] = await Promise.all([
        fetchDatabaseAudit(),
        fetchSchemaDiff()
      ]);
      setData(auditRes);
      setDiff(diffRes);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to load database audit", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!diff || (diff.missing_columns.length === 0 && diff.missing_indexes.length === 0)) {
      toast({ title: "System Up to Date", description: "No changes needed." });
      return;
    }
    
    setSyncing(true);
    try {
      const res = await syncSchema();
      toast({ title: "Success", description: `Applied ${res.length} changes to database.` });
      await load();
    } catch (e: any) {
      toast({ title: "Sync Failed", description: e?.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleTableSync = async (tableName: string) => {
    setSyncing(true);
    try {
      const res = await syncSchema(tableName);
      toast({ title: "Table Updated", description: `Applied ${res.length} changes to ${tableName}.` });
      await load();
    } catch (e: any) {
      toast({ title: "Sync Failed", description: e?.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredTables = useMemo(() => {
    if (!data?.tables) return [];
    
    const tables = data.tables.filter(t => 
      t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort by mismatch status first, then by name
    return [...tables].sort((a, b) => {
      const aMissing = !a.live || !a.defined;
      const bMissing = !b.live || !b.defined;

      // Check for column mismatches
      const aColsDefined = Object.keys(a.defined?.columns || {});
      const aColsLive = Object.keys(a.live?.columns || {});
      const aMismatched = aMissing || aColsDefined.length !== aColsLive.length || aColsDefined.some(c => !a.live?.columns[c]);

      const bColsDefined = Object.keys(b.defined?.columns || {});
      const bColsLive = Object.keys(b.live?.columns || {});
      const bMismatched = bMissing || bColsDefined.length !== bColsLive.length || bColsDefined.some(c => !b.live?.columns[c]);

      if (aMismatched && !bMismatched) return -1;
      if (!aMismatched && bMismatched) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [data?.tables, searchTerm]);

  return (
    <ReportShell
      title="Database Schema Audit"
      subtitle="Side-by-side comparison between Defined Schema and Live Database"
    >
      <div className="space-y-6">
        {/* Sync Status Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-none shadow-md bg-gradient-to-br from-primary/10 to-background">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
                    Schema Sync Dashboard
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    Comparison Status
                    {diff && (
                      <span className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-[9px] h-4">Defined: {diff.defined_table_count}</Badge>
                        <Badge variant="outline" className="text-[9px] h-4">Live: {diff.live_table_count}</Badge>
                      </span>
                    )}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={handleSync} 
                    disabled={syncing || !diff || (diff.missing_columns.length === 0 && diff.missing_indexes.length === 0)}
                    className="gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} /> Update All Tables
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-20 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
              ) : diff && (diff.missing_columns.length > 0 || diff.missing_indexes.length > 0 || diff.missing_tables.length > 0) ? (
                <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Divergence Detected</AlertTitle>
                  <AlertDescription className="text-xs space-y-1 mt-2">
                    {diff.missing_tables.length > 0 && <div>• {diff.missing_tables.length} tables missing in live database.</div>}
                    {diff.missing_columns.length > 0 && <div>• {diff.missing_columns.length} columns missing in live database.</div>}
                    {diff.missing_indexes.length > 0 && <div>• {diff.missing_indexes.length} indexes missing in live database.</div>}
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-green-500/5 border border-green-500/20 rounded-lg text-green-700">
                  <CheckCircle2 className="w-5 h-5" />
                  <div>
                    <div className="font-bold text-sm">Schema Synchronized</div>
                    <div className="text-[10px] opacity-80">The live database perfectly matches the defined schema snapshot.</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-md overflow-hidden bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Index Health
              </CardTitle>
              <CardDescription>Critical report optimizations</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-2">
                {loading ? (
                  Array(3).fill(0).map((_, i) => <div key={i} className="h-10 bg-muted animate-pulse rounded-md" />)
                ) : data?.optimizations.map((opt, i) => (
                  <div key={i} className="bg-background border rounded p-2 flex items-center justify-between text-xs">
                    <div className="font-mono">{opt.index}</div>
                    {opt.status === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table Comparison Explorer */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <TableIcon className="w-5 h-5" />
              Side-by-Side Schema Explorer
            </h2>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search tables..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
          ) : (
            <div className="grid grid-cols-1 gap-8">
              {filteredTables.map((table, i) => (
                <TableComparison key={i} table={table} onSync={handleTableSync} syncing={syncing} />
              ))}
            </div>
          )}
        </div>
      </div>
    </ReportShell>
  );
}

function TableComparison({ table, onSync, syncing }: { table: any, onSync: (name: string) => void, syncing: boolean }) {
  const isMissingInLive = !table.live;
  const isMissingInDefined = !table.defined;

  // Check for mismatches
  const definedCols = Object.keys(table.defined?.columns || {});
  const liveCols = Object.keys(table.live?.columns || {});
  const hasMismatch = isMissingInLive || isMissingInDefined || definedCols.length !== liveCols.length || definedCols.some(c => !table.live?.columns[c]);

  // Union of all column names
  const allCols = Array.from(new Set([
    ...Object.keys(table.defined?.columns || {}),
    ...Object.keys(table.live?.columns || {})
  ])).sort();

  return (
    <Card className={`border-none shadow-md overflow-hidden ${isMissingInLive ? 'ring-2 ring-destructive/20' : hasMismatch ? 'ring-2 ring-amber-500/20' : ''}`}>
      <CardHeader className="bg-muted/30 border-b py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-mono flex items-center gap-2">
            <Database className="w-4 h-4 text-muted-foreground" />
            {table.name}
            {hasMismatch && <AlertCircle className="w-4 h-4 text-amber-500" />}
          </CardTitle>
          <div className="flex gap-2">
            {!isMissingInDefined ? (
              <Badge variant="secondary" className="text-[10px]">In Defined Schema</Badge>
            ) : (
              <Badge variant="destructive" className="text-[10px]">Not in Defined</Badge>
            )}
            {!isMissingInLive ? (
              <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">Live in Database</Badge>
            ) : (
              <Badge variant="destructive" className="text-[10px]">Missing from Database</Badge>
            )}
            
            {hasMismatch && !isMissingInLive && (
              <Button 
                variant="default" 
                size="xs" 
                className="h-6 text-[10px] gap-1 bg-amber-600 hover:bg-amber-700" 
                onClick={() => onSync(table.name)}
                disabled={syncing}
              >
                <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                Update Table
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-muted-foreground/10">
          {/* Defined Side */}
          <div className="bg-muted/5">
            <div className="px-4 py-2 text-[10px] font-bold uppercase border-b bg-muted/20 text-muted-foreground flex justify-between">
              <span>Defined Structure (Snapshot)</span>
              {isMissingInDefined && <span className="text-destructive">MISSING</span>}
            </div>
            <div className="p-0">
              <table className="w-full text-[11px]">
                <thead className="bg-muted/10 border-b">
                  <tr>
                    <th className="text-left px-4 py-2">Column</th>
                    <th className="text-left px-4 py-2">Type</th>
                    <th className="text-center px-4 py-2">Key</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted/10">
                  {allCols.map(colName => {
                    const col = table.defined?.columns?.[colName];
                    const existsInLive = !!table.live?.columns?.[colName];
                    return (
                      <tr key={colName} className={`h-10 ${!col ? 'bg-muted/5 opacity-30' : ''} ${col && !existsInLive ? 'bg-amber-500/5' : ''}`}>
                        <td className="px-4 py-2 font-bold">{colName}</td>
                        <td className="px-4 py-2 text-muted-foreground">{col?.Type || '-'}</td>
                        <td className="px-4 py-2 text-center">
                          {col?.Key && <Badge variant="secondary" className="text-[9px] h-4">{col.Key}</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live Side */}
          <div className="bg-background">
            <div className="px-4 py-2 text-[10px] font-bold uppercase border-b bg-primary/5 text-primary flex justify-between">
              <span>Live Structure (Database)</span>
              {isMissingInLive && <span className="text-destructive">MISSING TABLE</span>}
            </div>
            <div className="p-0">
              <table className="w-full text-[11px]">
                <thead className="bg-primary/5 border-b">
                  <tr>
                    <th className="text-left px-4 py-2">Column</th>
                    <th className="text-left px-4 py-2">Type</th>
                    <th className="text-center px-4 py-2">Key</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted/10">
                  {allCols.map(colName => {
                    const col = table.live?.columns?.[colName];
                    const existsInDefined = !!table.defined?.columns?.[colName];
                    return (
                      <tr key={colName} className={`h-10 ${!col ? 'bg-destructive/5 text-destructive' : ''} ${col && !existsInDefined ? 'bg-blue-500/5' : ''}`}>
                        <td className="px-4 py-2 font-bold">
                          {colName}
                          {!col && !isMissingInLive && <span className="ml-2 text-[8px] uppercase">[Missing]</span>}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{col?.Type || '-'}</td>
                        <td className="px-4 py-2 text-center">
                          {col?.Key && <Badge variant="secondary" className="text-[9px] h-4">{col.Key}</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
