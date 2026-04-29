"use client";

import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  Plus, 
  Search, 
  Loader2, 
  Edit, 
  Truck,
  Phone,
  Mail,
  User,
  PlusCircle,
  ExternalLink
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
import { useRouter } from "next/navigation";

export default function BanquetVendorsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    resource_type: "External",
    base_price: "0",
    is_active: 1
  });

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    setLoading(true);
    try {
      const res = await api("/api/supplier/list?type=banquet");
      const data = await res.json();
      setVendors(data.data || []);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load vendors", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Banquet Vendors</h2>
            <p className="text-muted-foreground">List of external services (Florists, Musicians, Decorators) configured for Banquets.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => router.push("/inventory/suppliers")}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Manage Vendors in Master List
            </Button>
          </div>
        </div>

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search banquet vendors..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVendors.length === 0 && (
              <div className="col-span-full py-12 text-center border rounded-xl border-dashed">
                <p className="text-muted-foreground">No banquet vendors found. Configure them in the Main Suppliers page.</p>
              </div>
            )}
            {filteredVendors.map((vendor) => (
              <Card key={vendor.id} className="overflow-hidden border shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600">
                      <Truck size={18} />
                    </div>
                    <CardTitle className="text-lg font-bold">{vendor.name}</CardTitle>
                  </div>
                  <Badge variant={vendor.is_active ? "default" : "secondary"}>
                    {vendor.is_active ? "Active" : "Inactive"}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground mt-2">
                      <div className="flex items-center gap-2"><Phone className="w-4 h-4" /> {vendor.phone || "-"}</div>
                      <div className="flex items-center gap-2 mt-1"><Mail className="w-4 h-4" /> {vendor.email || "-"}</div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full mt-2"
                      onClick={() => router.push("/inventory/suppliers")}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit in Master List
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
