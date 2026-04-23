"use client"

import React, { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { fetchSystemSettings, updateSystemSettings, testSms, fetchApiClients, createApiClient, deleteApiClient, regenerateApiClientKey, toggleApiClientStatus, ApiClientRow } from "@/lib/api";
import { Settings, Mail, MessageSquare, Save, Loader2, Link2, ShieldCheck, UserCheck, Smartphone, Globe, Copy, RotateCw, CheckCircle2, AlertCircle, Plus, Trash2, ExternalLink, Eye, EyeOff } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function SystemSettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingSms, setTestingSms] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [apiClients, setApiClients] = useState<ApiClientRow[]>([]);
  const [showKeyId, setShowKeyId] = useState<number | null>(null);
  const [newClient, setNewClient] = useState({ client_name: "", domain: "" });
  const [addingClient, setAddingClient] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [settings, setSettings] = useState<Record<string, string>>({
    mail_host: "",
    mail_port: "",
    mail_user: "",
    mail_pass: "",
    mail_encryption: "tls",
    mail_from_addr: "",
    mail_from_name: "",
    sms_gateway_url: "",
    sms_api_key: "",
    sms_sender_id: ""
  });

  const load = async () => {
    setLoading(true);
    try {
      const [s, clients] = await Promise.all([
        fetchSystemSettings(),
        fetchApiClients()
      ]);
      setSettings(prev => ({ ...prev, ...s }));
      setApiClients(clients);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleChange = (key: string, val: string) => {
    setSettings(prev => ({ ...prev, [key]: val }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateSystemSettings(settings);
      toast({ title: "Success", description: "System settings updated successfully." });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTestSms = async () => {
    const num = testPhone.trim();
    if (!num) {
      toast({ title: "Phone Required", description: "Please enter a phone number to test.", variant: "destructive" });
      return;
    }
    setTestingSms(true);
    try {
      await testSms(num);
      toast({ title: "Sent", description: "Test SMS sent successfully. Check your phone." });
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setTestingSms(false);
    }
  };

  const handleAddClient = async () => {
    if (!newClient.client_name || !newClient.domain) return;
    setAddingClient(true);
    try {
      await createApiClient(newClient);
      toast({ title: "Client Added", description: "New API client created successfully." });
      setNewClient({ client_name: "", domain: "" });
      setIsDialogOpen(false);
      const clients = await fetchApiClients();
      setApiClients(clients);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setAddingClient(false);
    }
  };

  const handleRegenerateKey = async (id: number) => {
    try {
      const newKey = await regenerateApiClientKey(id);
      setApiClients(prev => prev.map(c => c.id === id ? { ...c, api_key: newKey } : c));
      toast({ title: "Key Regenerated", description: "API key updated." });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleDeleteClient = async (id: number) => {
    try {
      await deleteApiClient(id);
      setApiClients(prev => prev.filter(c => c.id !== id));
      toast({ title: "Deleted", description: "Client removed." });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: number) => {
    try {
      const newStatus = currentStatus === 1 ? false : true;
      await toggleApiClientStatus(id, newStatus);
      setApiClients(prev => prev.map(c => c.id === id ? { ...c, is_active: newStatus ? 1 : 0 } : c));
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({ title: "Copied!", description: "API Key copied to clipboard." });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground font-medium">Loading system configurations...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          System Settings
        </h1>
        <p className="text-muted-foreground mt-1">Configure global communication gateways and server infrastructure</p>
      </div>

      <Tabs defaultValue="mail" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl border">
          <TabsTrigger value="mail" className="rounded-lg px-6 gap-2">
            <Mail className="w-4 h-4" />
            Email (SMTP)
          </TabsTrigger>
          <TabsTrigger value="sms" className="rounded-lg px-6 gap-2">
            <MessageSquare className="w-4 h-4" />
            SMS Gateway
          </TabsTrigger>
          <TabsTrigger value="public-api" className="rounded-lg px-6 gap-2">
            <Globe className="w-4 h-4" />
            Public API
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mail">
          <Card className="border-none shadow-lg overflow-hidden">
            <CardHeader className="bg-primary/[0.03] border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Outgoing Mail Server</CardTitle>
                  <CardDescription>Configure SMTP credentials for system notifications and invoices.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-8 md:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground/60 border-b pb-2 flex items-center gap-2">
                    <Link2 className="w-3.5 h-3.5" />
                    Connection Details
                  </h3>
                  <div className="grid gap-2">
                    <Label htmlFor="mail_host">SMTP Host</Label>
                    <Input id="mail_host" placeholder="smtp.example.com" value={settings.mail_host} onChange={(e) => handleChange('mail_host', e.target.value)} />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="mail_port">SMTP Port</Label>
                      <Input id="mail_port" placeholder="587" value={settings.mail_port} onChange={(e) => handleChange('mail_port', e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="mail_encryption">Encryption</Label>
                      <Select value={settings.mail_encryption} onValueChange={(v) => handleChange('mail_encryption', v)}>
                        <SelectTrigger id="mail_encryption">
                          <SelectValue placeholder="Select encryption" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tls">TLS (STARTTLS)</SelectItem>
                          <SelectItem value="ssl">SSL / Implicit TLS</SelectItem>
                          <SelectItem value="none">None (Insecure)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground/60 border-b pb-2 flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Authentication
                  </h3>
                  <div className="grid gap-2">
                    <Label htmlFor="mail_user">Username</Label>
                    <Input id="mail_user" placeholder="user@example.com" value={settings.mail_user} onChange={(e) => handleChange('mail_user', e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="mail_pass">Password</Label>
                    <Input id="mail_pass" type="password" placeholder="••••••••" value={settings.mail_pass} onChange={(e) => handleChange('mail_pass', e.target.value)} />
                  </div>
                </div>

                <div className="space-y-4 md:col-span-2">
                  <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground/60 border-b pb-2 flex items-center gap-2">
                    <UserCheck className="w-3.5 h-3.5" />
                    Sender Identity
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="mail_from_addr">From Email Address</Label>
                      <Input id="mail_from_addr" placeholder="no-reply@servicebay.com" value={settings.mail_from_addr} onChange={(e) => handleChange('mail_from_addr', e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="mail_from_name">From Name</Label>
                      <Input id="mail_from_name" placeholder="ServiceBay Notifications" value={settings.mail_from_name} onChange={(e) => handleChange('mail_from_name', e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 border-t p-6 flex justify-end">
              <Button onClick={save} disabled={saving} size="lg" className="px-8 shadow-md">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save Mail Configuration
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="sms">
          <Card className="border-none shadow-lg overflow-hidden">
            <CardHeader className="bg-primary/[0.03] border-b pb-4">
               <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">SMS Gateway Configuration</CardTitle>
                  <CardDescription>Setup your API provider for automated transaction alerts and booking confirmations.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-8 md:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground/60 border-b pb-2 flex items-center gap-2">
                    <Link2 className="w-3.5 h-3.5" />
                    Gateway Details
                  </h3>
                  <div className="grid gap-2">
                    <Label htmlFor="sms_gateway_url">Gateway API URL</Label>
                    <Input id="sms_gateway_url" placeholder="https://api.smsprovider.com/v1/send" value={settings.sms_gateway_url} onChange={(e) => handleChange('sms_gateway_url', e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="sms_api_key">API Token / Key</Label>
                    <Input id="sms_api_key" type="password" placeholder="••••••••" value={settings.sms_api_key} onChange={(e) => handleChange('sms_api_key', e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="sms_sender_id">Sender ID</Label>
                    <Input id="sms_sender_id" placeholder="SERVICEBAY" value={settings.sms_sender_id} onChange={(e) => handleChange('sms_sender_id', e.target.value)} />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground/60 border-b pb-2 flex items-center gap-2">
                    <Smartphone className="w-3.5 h-3.5" />
                    Test Connectivity
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Verify your credentials by sending a test message. Make sure to **Save** your settings before testing if you have made changes.
                  </p>
                  <div className="grid gap-2">
                    <Label htmlFor="test_phone">Recipient Number</Label>
                    <Input id="test_phone" placeholder="9477..." value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
                  </div>
                  <Button variant="secondary" onClick={handleTestSms} disabled={testingSms || !testPhone.trim()} className="w-full">
                    {testingSms ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MessageSquare className="w-4 h-4 mr-2" />}
                    Send Test SMS
                  </Button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 border-t p-6 flex justify-end">
              <Button onClick={save} disabled={saving} size="lg" className="px-8 shadow-md">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save SMS Gateway
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent value="public-api">
          <Card className="border-none shadow-lg overflow-hidden">
            <CardHeader className="bg-primary/[0.03] border-b pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Domain-Specific API Keys</CardTitle>
                    <CardDescription>Manage keys and restricted domains for external website integrations.</CardDescription>
                  </div>
                </div>
                
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2 shadow-sm">
                      <Plus className="w-4 h-4" />
                      Add API Client
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Register API Client</DialogTitle>
                      <DialogDescription>
                        Create a new secure key tied to a specific website domain.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="client_name">Client Name (Reference)</Label>
                        <Input id="client_name" placeholder="e.g. Main E-commerce Site" value={newClient.client_name} onChange={(e) => setNewClient(p => ({ ...p, client_name: e.target.value }))} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="domain">Target Domain (Origin)</Label>
                        <Input id="domain" placeholder="https://www.example.com" value={newClient.domain} onChange={(e) => setNewClient(p => ({ ...p, domain: e.target.value }))} />
                        <p className="text-[10px] text-muted-foreground">The protocol (http/https) and domain must match exactly.</p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleAddClient} disabled={addingClient || !newClient.client_name || !newClient.domain}>
                        {addingClient ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Create Client
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-[200px]">Client / Domain</TableHead>
                      <TableHead>API Key</TableHead>
                      <TableHead className="w-[100px] text-center">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiClients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-40 text-center">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <ShieldCheck className="w-8 h-8 opacity-20" />
                            <p>No API clients registered yet.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      apiClients.map((client) => (
                        <TableRow key={client.id} className="group">
                          <TableCell>
                            <div className="font-medium text-sm">{client.client_name}</div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <ExternalLink className="w-2.5 h-2.5" />
                              {client.domain}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 max-w-[250px]">
                              <code className="font-mono text-[10px] bg-muted/40 px-2 py-1 rounded truncate flex-1">
                                {showKeyId === client.id ? client.api_key : "••••••••••••••••••••••••••••••••"}
                              </code>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7" 
                                onClick={() => setShowKeyId(showKeyId === client.id ? null : client.id)}
                              >
                                {showKeyId === client.id ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7" 
                                onClick={() => copyToClipboard(client.api_key)}
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch 
                              checked={client.is_active === 1} 
                              onCheckedChange={() => handleToggleStatus(client.id, client.is_active)} 
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                                    <RotateCw className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Regenerate Key for "{client.client_name}"?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will immediately block access for any site using the current key.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleRegenerateKey(client.id)} className="bg-destructive hover:bg-destructive/90">
                                      Regenerate
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete API Client?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{client.client_name}"? This action cannot be undone and will permanently block its API access.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteClient(client.id)} className="bg-destructive hover:bg-destructive/90">
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            
            <CardFooter className="bg-muted/30 border-t p-6">
              <div className="grid gap-4 w-full">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <Link2 className="w-4 h-4" />
                  Integration Guide
                </div>
                <div className="grid sm:grid-cols-2 gap-6 items-start">
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      To connect your external website, use the URLs below and include the <code className="bg-muted px-1 rounded">X-API-Key</code> header from the table above.
                    </p>
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-3 mt-2">
                      <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
                      <p className="text-[10px] text-blue-700 leading-relaxed">
                        The <strong>Domain Binding</strong> feature ensures that keys only work when requests originate from their registered website.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 p-4 bg-background rounded-xl border">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground">Base Inventory URL:</p>
                      <code className="text-[10px] break-all block bg-muted p-1.5 rounded select-all cursor-pointer">
                        {typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : ''}api/publicitem/inventory
                      </code>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground">Product Detail URL:</p>
                      <code className="text-[10px] break-all block bg-muted p-1.5 rounded">
                        ...api/publicitem/get/{"{id}"}
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
