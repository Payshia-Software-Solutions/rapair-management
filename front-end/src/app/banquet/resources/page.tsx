"use client";

import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  Plus, 
  Search, 
  Loader2, 
  Edit, 
  LayoutGrid, 
  CheckCircle2, 
  XCircle,
  Package,
  Wrench,
  Truck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

export default function BanquetResourcesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [resources, setResources] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    resource_type: "Internal",
    base_price: "",
    selling_price: "",
    default_supplier_id: "",
    is_active: 1
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [suppliers, setSuppliers] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resRes, supRes] = await Promise.all([
        api("/api/banquet/resources"),
        api("/api/supplier/list?type=banquet")
      ]);
      const resData = await resRes.json();
      const supData = await supRes.json();
      setResources(resData.data || []);
      setSuppliers(supData.data || []);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingResource ? "PUT" : "POST";
    const url = editingResource ? `/api/banquet/resources/${editingResource.id}` : "/api/banquet/resources";

    try {
      const res = await api(url, {
        method,
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        toast({ title: "Success", description: `Resource ${editingResource ? "updated" : "created"}` });
        setIsDialogOpen(false);
        loadData();
      }
    } catch (err) {
      toast({ title: "Error", description: "Operation failed", variant: "destructive" });
    }
  };

  const filteredResources = resources.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredResources.length / itemsPerPage);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Resources & Services</h2>
            <p className="text-muted-foreground">Manage internal assets and outsourced service categories.</p>
          </div>
          <Button onClick={() => {
            setEditingResource(null);
            setFormData({ name: "", resource_type: "Internal", base_price: "", selling_price: "", default_supplier_id: "", is_active: 1 });
            setIsDialogOpen(true);
          }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Resource/Service
          </Button>
        </div>

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search resources..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>
        ) : (
          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                    <tr>
                      <th className="px-6 py-4 font-medium">Resource Name</th>
                      <th className="px-6 py-4 font-medium">Type</th>
                      <th className="px-6 py-4 font-medium text-right">Cost Price (LKR)</th>
                      <th className="px-6 py-4 font-medium text-right">Selling Price (LKR)</th>
                      <th className="px-6 py-4 font-medium text-center">Status</th>
                      <th className="px-6 py-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredResources.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((resource) => (
                      <tr key={resource.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                              {resource.resource_type === 'Internal' ? <Package size={16} /> : <Truck size={16} />}
                            </div>
                            <span className="font-bold">{resource.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className={resource.resource_type === 'External' ? 'bg-orange-50 text-orange-700 border-orange-200 w-fit' : 'bg-blue-50 text-blue-700 border-blue-200 w-fit'}>
                              {resource.resource_type === 'External' ? 'Outsourced' : 'Internal'}
                            </Badge>
                            {resource.resource_type === 'External' && resource.default_supplier_name && (
                              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                Provider: {resource.default_supplier_name}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-medium">
                          {Number(resource.base_price).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-primary">
                          {Number(resource.selling_price).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Badge variant={resource.is_active ? "default" : "secondary"}>
                            {resource.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-muted-foreground hover:text-primary"
                              onClick={() => {
                                setEditingResource(resource);
                                setFormData({
                                  name: resource.name,
                                  resource_type: resource.resource_type,
                                  base_price: resource.base_price,
                                  selling_price: resource.selling_price,
                                  default_supplier_id: resource.default_supplier_id ? String(resource.default_supplier_id) : "",
                                  is_active: Number(resource.is_active)
                                });
                                setIsDialogOpen(true);
                              }}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={async () => {
                                if (confirm("Are you sure you want to delete this resource?")) {
                                  try {
                                    const res = await api(`/api/banquet/resources/${resource.id}`, { method: "DELETE" });
                                    if (res.ok) {
                                      toast({ title: "Success", description: "Resource deleted" });
                                      loadData();
                                    }
                                  } catch (err) {
                                    toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
                                  }
                                }
                              }}
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredResources.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                          No resources found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/10">
                  <span className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredResources.length)} of {filteredResources.length} entries
                  </span>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1 px-2">
                      <span className="text-sm font-medium">Page {currentPage} of {totalPages}</span>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingResource ? "Edit Resource" : "Add New Resource"}</DialogTitle>
              <DialogDescription>Define a resource or service that can be assigned to events.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Resource Name</Label>
                <Input 
                  placeholder="e.g. Multimedia Projector, DJ System" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.resource_type}
                  onChange={(e) => setFormData({...formData, resource_type: e.target.value, default_supplier_id: ""})}
                >
                  <option value="Internal">Internal (Owned Asset)</option>
                  <option value="External">Outsourced (External Service)</option>
                </select>
              </div>
              
              {formData.resource_type === 'External' && (
                <div className="space-y-2">
                  <Label>Default Provider (Vendor)</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={formData.default_supplier_id}
                    onChange={(e) => setFormData({...formData, default_supplier_id: e.target.value})}
                  >
                    <option value="">-- No Default Vendor --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground">Select the preferred vendor for this service. You can change this when booking.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cost Price (LKR)</Label>
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    value={formData.base_price}
                    onChange={(e) => setFormData({...formData, base_price: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Selling Price (LKR)</Label>
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    value={formData.selling_price}
                    onChange={(e) => setFormData({...formData, selling_price: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="active-check"
                  checked={formData.is_active === 1}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked ? 1 : 0})}
                  className="w-4 h-4 accent-primary"
                />
                <Label htmlFor="active-check" className="cursor-pointer">Active and Available</Label>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full sm:w-auto">
                  {editingResource ? "Update Resource" : "Create Resource"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
