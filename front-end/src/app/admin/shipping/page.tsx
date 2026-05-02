"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  updateCostingTemplate, 
  deleteCostingTemplate, 
  ShippingCostingTemplate, 
  ShippingCostingItem,
  LogisticsFactor,
  fetchLogisticsFactors,
  createLogisticsFactor,
  updateLogisticsFactor,
  deleteLogisticsFactor
} from "@/lib/api";
import { 
  Truck, 
  MapPin, 
  Plus, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  Building2,
  Search,
  Edit,
  Globe,
  Info,
  Calculator,
  FileText
} from "lucide-react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function ShippingManagementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "regional";
  const { toast } = useToast();
  const [shippingZones, setShippingZones] = useState<ShippingZone[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [shippingProviders, setShippingProviders] = useState<ShippingProvider[]>([]);
  const [costingTemplates, setCostingTemplates] = useState<ShippingCostingTemplate[]>([]);
  const [districtSearch, setDistrictSearch] = useState("");
  const [loadingZones, setLoadingZones] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [logisticsFactors, setLogisticsFactors] = useState<LogisticsFactor[]>([]);
  const [loadingFactors, setLoadingFactors] = useState(false);
  const [loading, setLoading] = useState(true);

  // Dialog States
  const [isZoneDialogOpen, setIsZoneDialogOpen] = useState(false);
  const [isEditZoneDialogOpen, setIsEditZoneDialogOpen] = useState(false);
  const [isDistrictDialogOpen, setIsDistrictDialogOpen] = useState(false);
  const [isProviderDialogOpen, setIsProviderDialogOpen] = useState(false);
  const [isEditProviderDialogOpen, setIsEditProviderDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isEditTemplateDialogOpen, setIsEditTemplateDialogOpen] = useState(false);
  const [isCitiesDialogOpen, setIsCitiesDialogOpen] = useState(false);
  const [isAddCityDialogOpen, setIsAddCityDialogOpen] = useState(false);
  const [isEditCityDialogOpen, setIsEditCityDialogOpen] = useState(false);
  
  const [isFactorDialogOpen, setIsFactorDialogOpen] = useState(false);
  const [isEditFactorDialogOpen, setIsEditFactorDialogOpen] = useState(false);

  const [isDeleteCityDialogOpen, setIsDeleteCityDialogOpen] = useState(false);
  const [cityToDelete, setCityToDelete] = useState<City | null>(null);

  const [selectedDistrictForCities, setSelectedDistrictForCities] = useState<District | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [newCityName, setNewCityName] = useState("");
  const [editingCity, setEditingCity] = useState<City | null>(null);

  const [newZone, setNewZone] = useState({ name: "", base_fee: 0, free_threshold: 0 });
  const [editingZone, setEditingZone] = useState<ShippingZone | null>(null);
  const [newDistrict, setNewDistrict] = useState({ name: "", shipping_zone_id: null as number | null });
  const [newProvider, setNewProvider] = useState({ name: "", base_cost: 0 });
  const [editingProvider, setEditingProvider] = useState<ShippingProvider | null>(null);
  
  const [newTemplate, setNewTemplate] = useState<{ name: string; items: ShippingCostingItem[] }>({ name: "", items: [] });
  const [editingTemplate, setEditingTemplate] = useState<ShippingCostingTemplate | null>(null);
  
  const [newFactor, setNewFactor] = useState({ name: "", type: "Logistic" });
  const [editingFactor, setEditingFactor] = useState<LogisticsFactor | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const loadShippingZones = async () => {
    try {
      setLoadingZones(true);
      const res = await fetchShippingZones();
      const data = (res && res.status === 'success' && Array.isArray(res.data)) ? res.data : [];
      setShippingZones(data);
      setLoadingZones(false);
    } catch (err) { 
      console.error("Failed to load shipping zones:", err);
      setShippingZones([]);
      setLoadingZones(false);
    }
  };

  const loadDistricts = async () => {
    try {
      setLoadingDistricts(true);
      const res = await fetchDistricts();
      const data = (res && res.status === 'success' && Array.isArray(res.data)) ? res.data : [];
      setDistricts(data);
      setLoadingDistricts(false);
    } catch (err) {
      console.error("Failed to load districts:", err);
      setDistricts([]);
      setLoadingDistricts(false);
    }
  };

  const loadProviders = async () => {
    try {
      setLoadingProviders(true);
      const res = await fetchShippingProviders();
      const data = (res && res.status === 'success' && Array.isArray(res.data)) ? res.data : [];
      setShippingProviders(data);
    } catch (err) {
      console.error("Failed to load providers:", err);
    } finally {
      setLoadingProviders(false);
    }
  };

  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const res = await fetchCostingTemplates();
      const data = (res && res.status === 'success' && Array.isArray(res.data)) ? res.data : [];
      setCostingTemplates(data);
    } catch (err) {
      console.error("Failed to load templates:", err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadFactors = async () => {
    try {
      setLoadingFactors(true);
      const res = await fetchLogisticsFactors();
      const data = (res && res.status === 'success' && Array.isArray(res.data)) ? res.data : [];
      setLogisticsFactors(data);
    } catch (err) {
      console.error("Failed to load factors:", err);
    } finally {
      setLoadingFactors(false);
    }
  };

  const loadCities = async (districtId: number) => {
    try {
      setLoadingCities(true);
      setCities([]); // Clear previous data immediately
      const res = await fetchCities(districtId);
      const data = (res && res.status === 'success' && Array.isArray(res.data)) ? res.data : [];
      setCities(data);
    } catch (err) {
      console.error("Failed to load cities:", err);
      toast({ title: "Load Error", description: "Could not fetch cities.", variant: "destructive" });
    } finally {
      setLoadingCities(false);
    }
  };

  useEffect(() => {
    if (selectedDistrictForCities) {
      loadCities(selectedDistrictForCities.id);
    }
  }, [selectedDistrictForCities]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadShippingZones(), 
      loadDistricts(), 
      loadProviders(), 
      loadTemplates(),
      loadFactors()
    ]).finally(() => setLoading(false));
  }, []);

  const handleAddZone = async () => {
    if (!newZone.name) return;
    try {
      setSubmitting(true);
      await createShippingZone(newZone);
      toast({ title: "Success", description: "Shipping zone created." });
      setIsZoneDialogOpen(false);
      setNewZone({ name: "", base_fee: 0, free_threshold: 0 });
      await loadShippingZones();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateZone = async () => {
    if (!editingZone) return;
    try {
      setSubmitting(true);
      await updateShippingZone(editingZone.id, editingZone);
      toast({ title: "Success", description: "Shipping zone updated." });
      setIsEditZoneDialogOpen(false);
      setEditingZone(null);
      await loadShippingZones();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddDistrict = async () => {
    if (!newDistrict.name) return;
    try {
      setSubmitting(true);
      await createDistrict(newDistrict);
      toast({ title: "Success", description: "District added." });
      setIsDistrictDialogOpen(false);
      setNewDistrict({ name: "", shipping_zone_id: null });
      await loadDistricts();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCity = async () => {
    if (!newCityName || !selectedDistrictForCities) return;
    try {
      setSubmitting(true);
      await createCity({ name: newCityName, district_id: selectedDistrictForCities.id });
      toast({ title: "Success", description: "City added." });
      setNewCityName("");
      setIsAddCityDialogOpen(false);
      loadCities(selectedDistrictForCities.id);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateCity = async () => {
    if (!editingCity || !selectedDistrictForCities) return;
    try {
      setSubmitting(true);
      await updateCity(editingCity.id, { name: editingCity.name, district_id: selectedDistrictForCities.id });
      toast({ title: "Success", description: "City updated." });
      setEditingCity(null);
      setIsEditCityDialogOpen(false);
      loadCities(selectedDistrictForCities.id);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCity = async () => {
    if (!cityToDelete || !selectedDistrictForCities) return;
    try {
      setSubmitting(true);
      await deleteCity(cityToDelete.id);
      toast({ title: "Success", description: "City deleted." });
      setCityToDelete(null);
      setIsDeleteCityDialogOpen(false);
      loadCities(selectedDistrictForCities.id);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddProvider = async () => {
    if (!newProvider.name) return;
    try {
      setSubmitting(true);
      await createShippingProvider(newProvider);
      toast({ title: "Success", description: "Shipping provider added." });
      setIsProviderDialogOpen(false);
      setNewProvider({ name: "", base_cost: 0 });
      await loadProviders();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateProvider = async () => {
    if (!editingProvider) return;
    try {
      setSubmitting(true);
      await updateShippingProvider(editingProvider.id, editingProvider);
      toast({ title: "Success", description: "Shipping provider updated." });
      setIsEditProviderDialogOpen(false);
      setEditingProvider(null);
      await loadProviders();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTemplate = async () => {
    if (!newTemplate.name) return;
    try {
      setSubmitting(true);
      await createCostingTemplate(newTemplate);
      toast({ title: "Success", description: "Costing template added." });
      setIsTemplateDialogOpen(false);
      setNewTemplate({ name: "", items: [] });
      await loadTemplates();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;
    try {
      setSubmitting(true);
      await updateCostingTemplate(editingTemplate.id, editingTemplate);
      toast({ title: "Success", description: "Costing template updated." });
      setIsEditTemplateDialogOpen(false);
      setEditingTemplate(null);
      await loadTemplates();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddFactor = async () => {
    if (!newFactor.name) return;
    try {
      setSubmitting(true);
      await createLogisticsFactor(newFactor);
      toast({ title: "Success", description: "Logistics factor added." });
      setIsFactorDialogOpen(false);
      setNewFactor({ name: "", type: "Logistic" });
      await loadFactors();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateFactor = async () => {
    if (!editingFactor) return;
    try {
      setSubmitting(true);
      await updateLogisticsFactor(editingFactor.id, editingFactor);
      toast({ title: "Success", description: "Logistics factor updated." });
      setIsEditFactorDialogOpen(false);
      setEditingFactor(null);
      await loadFactors();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteFactor = async (id: number) => {
    if (!confirm("Delete this factor?")) return;
    try {
      await deleteLogisticsFactor(id);
      toast({ title: "Success", description: "Factor deleted." });
      await loadFactors();
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    }
  };

  const filteredDistricts = districts.filter(d => 
    d.name.toLowerCase().includes(districtSearch.toLowerCase()) ||
    d.zone_name?.toLowerCase().includes(districtSearch.toLowerCase())
  );

  const filteredCities = cities.filter(c => c.name.toLowerCase().includes(citySearch.toLowerCase()));

  if (loading && shippingZones.length === 0) {
    return (
      <DashboardLayout title="Shipping Management">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Shipping Management">
      <div className="flex flex-col h-full gap-6">
        {/* Header... (omitted for space, keep original) */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Shipping Logistics</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Configure regional delivery rates and map districts to zones.</p>
          </div>
          <div className="flex items-center gap-3">
             <Button variant="outline" className="bg-white dark:bg-slate-800 dark:border-slate-700" onClick={() => setIsZoneDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> New Zone
             </Button>
             <Button variant="default" onClick={() => setIsDistrictDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> New District
             </Button>
          </div>
        </div>

        {/* Cities Management Dialog */}
        <Dialog open={isCitiesDialogOpen} onOpenChange={setIsCitiesDialogOpen}>
          <DialogContent className="max-w-2xl dark:bg-slate-900">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6">
                <div>
                   <DialogTitle>Cities in {selectedDistrictForCities?.name}</DialogTitle>
                   <DialogDescription>Manage urban locations and mapping for this district.</DialogDescription>
                </div>
                <Button size="sm" onClick={() => setIsAddCityDialogOpen(true)}>
                   <Plus className="w-4 h-4 mr-2" /> Add City
                </Button>
              </div>
            </DialogHeader>
            
            <div className="py-4 space-y-4">
               {/* Search... */}
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Search cities..." 
                    value={citySearch}
                    onChange={e => setCitySearch(e.target.value)}
                    className="pl-10 dark:bg-slate-800 dark:border-slate-700"
                  />
               </div>

               <div className="border dark:border-slate-800 rounded-xl overflow-hidden max-h-[400px] overflow-y-auto custom-scrollbar">
                  <Table>
                    <TableBody>
                       {loadingCities ? (
                         <TableRow><TableCell className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                       ) : filteredCities.length === 0 ? (
                         <TableRow><TableCell className="text-center py-10 text-slate-400">No cities found.</TableCell></TableRow>
                       ) : filteredCities.map(city => (
                         <TableRow key={city.id} className="group dark:border-slate-800/50">
                           <TableCell className="font-medium dark:text-slate-300 pl-6">{city.name}</TableCell>
                           <TableCell className="pr-6 text-right">
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <Button variant="ghost" size="icon" className="w-8 h-8 text-slate-400 hover:text-blue-500" onClick={() => {
                                    setEditingCity(city);
                                    setIsEditCityDialogOpen(true);
                                 }}>
                                    <Edit className="w-3.5 h-3.5" />
                                 </Button>
                                 <Button variant="ghost" size="icon" className="w-8 h-8 text-slate-400 hover:text-red-500" onClick={() => {
                                    setCityToDelete(city);
                                    setIsDeleteCityDialogOpen(true);
                                 }}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                 </Button>
                              </div>
                           </TableCell>
                        </TableRow>
                       ))}
                    </TableBody>
                  </Table>
               </div>
            </div>
            <DialogFooter>
               <Button variant="outline" onClick={() => setIsCitiesDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete City Confirmation */}
        <Dialog open={isDeleteCityDialogOpen} onOpenChange={setIsDeleteCityDialogOpen}>
           <DialogContent className="sm:max-w-[425px] dark:bg-slate-900">
              <DialogHeader>
                 <DialogTitle>Delete City</DialogTitle>
                 <DialogDescription>
                    Are you sure you want to delete <span className="font-bold text-red-500">{cityToDelete?.name}</span>? 
                    This action cannot be undone.
                 </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                 <Button variant="outline" onClick={() => setIsDeleteCityDialogOpen(false)}>Cancel</Button>
                 <Button variant="destructive" onClick={handleDeleteCity} disabled={submitting}>
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Delete
                 </Button>
              </DialogFooter>
           </DialogContent>
        </Dialog>

        {/* Add City Dialog */}
        <Dialog open={isAddCityDialogOpen} onOpenChange={setIsAddCityDialogOpen}>
           <DialogContent className="sm:max-w-[425px] dark:bg-slate-900">
              <DialogHeader>
                 <DialogTitle>Add New City</DialogTitle>
                 <DialogDescription>Add a new location to {selectedDistrictForCities?.name}.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                 <div className="grid gap-2">
                    <Label htmlFor="city-name">City Name</Label>
                    <Input 
                      id="city-name" 
                      placeholder="e.g. Maharagama" 
                      value={newCityName}
                      onChange={(e) => setNewCityName(e.target.value)}
                      className="dark:bg-slate-800 dark:border-slate-700"
                    />
                 </div>
              </div>
              <DialogFooter>
                 <Button variant="outline" onClick={() => setIsAddCityDialogOpen(false)}>Cancel</Button>
                 <Button onClick={handleAddCity} disabled={submitting || !newCityName}>
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Save City
                 </Button>
              </DialogFooter>
           </DialogContent>
        </Dialog>

        {/* Edit City Dialog */}
        <Dialog open={isEditCityDialogOpen} onOpenChange={setIsEditCityDialogOpen}>
           <DialogContent className="sm:max-w-[425px] dark:bg-slate-900">
              <DialogHeader>
                 <DialogTitle>Edit City</DialogTitle>
                 <DialogDescription>Update location name in {selectedDistrictForCities?.name}.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                 <div className="grid gap-2">
                    <Label htmlFor="edit-city-name">City Name</Label>
                    <Input 
                      id="edit-city-name" 
                      value={editingCity?.name || ""}
                      onChange={(e) => setEditingCity(prev => prev ? {...prev, name: e.target.value} : null)}
                      className="dark:bg-slate-800 dark:border-slate-700"
                    />
                 </div>
              </div>
              <DialogFooter>
                 <Button variant="outline" onClick={() => setIsEditCityDialogOpen(false)}>Cancel</Button>
                 <Button onClick={handleUpdateCity} disabled={submitting || !editingCity?.name}>
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Update City
                 </Button>
              </DialogFooter>
           </DialogContent>
        </Dialog>

        {/* Add Provider Dialog */}
        <Dialog open={isProviderDialogOpen} onOpenChange={setIsProviderDialogOpen}>
           <DialogContent className="sm:max-w-[425px] dark:bg-slate-900">
              <DialogHeader>
                 <DialogTitle>Add International Provider</DialogTitle>
                 <DialogDescription>Setup a new global shipping partner (e.g. DHL, UPS).</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                 <div className="grid gap-2">
                    <Label htmlFor="provider-name">Provider Name</Label>
                    <Input 
                      id="provider-name" 
                      placeholder="e.g. DHL Express" 
                      value={newProvider.name}
                      onChange={(e) => setNewProvider({...newProvider, name: e.target.value})}
                      className="dark:bg-slate-800 dark:border-slate-700"
                    />
                 </div>
                 <div className="grid gap-2">
                    <Label htmlFor="provider-cost">Base Cost (LKR)</Label>
                    <Input 
                      id="provider-cost" 
                      type="number"
                      value={newProvider.base_cost}
                      onChange={(e) => setNewProvider({...newProvider, base_cost: parseFloat(e.target.value)})}
                      className="dark:bg-slate-800 dark:border-slate-700"
                    />
                 </div>
              </div>
              <DialogFooter>
                 <Button variant="outline" onClick={() => setIsProviderDialogOpen(false)}>Cancel</Button>
                 <Button onClick={handleAddProvider} disabled={submitting || !newProvider.name}>
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Save Provider
                 </Button>
              </DialogFooter>
           </DialogContent>
        </Dialog>

        {/* Edit Provider Dialog */}
        <Dialog open={isEditProviderDialogOpen} onOpenChange={setIsEditProviderDialogOpen}>
           <DialogContent className="sm:max-w-[425px] dark:bg-slate-900">
              <DialogHeader>
                 <DialogTitle>Edit Provider</DialogTitle>
                 <DialogDescription>Update pricing or details for {editingProvider?.name}.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                 <div className="grid gap-2">
                    <Label htmlFor="edit-provider-name">Provider Name</Label>
                    <Input 
                      id="edit-provider-name" 
                      value={editingProvider?.name || ""}
                      onChange={(e) => setEditingProvider(prev => prev ? {...prev, name: e.target.value} : null)}
                      className="dark:bg-slate-800 dark:border-slate-700"
                    />
                 </div>
                 <div className="grid gap-2">
                    <Label htmlFor="edit-provider-cost">Base Cost (LKR)</Label>
                    <Input 
                      id="edit-provider-cost" 
                      type="number"
                      value={editingProvider?.base_cost || 0}
                      onChange={(e) => setEditingProvider(prev => prev ? {...prev, base_cost: parseFloat(e.target.value)} : null)}
                      className="dark:bg-slate-800 dark:border-slate-700"
                    />
                 </div>
              </div>
              <DialogFooter>
                 <Button variant="outline" onClick={() => setIsEditProviderDialogOpen(false)}>Cancel</Button>
                 <Button onClick={handleUpdateProvider} disabled={submitting || !editingProvider?.name}>
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Update Provider
                 </Button>
              </DialogFooter>
           </DialogContent>
        </Dialog>

         {/* Add Template Dialog */}
         <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
            <DialogContent className="sm:max-w-[500px] dark:bg-slate-900">
               <DialogHeader>
                  <DialogTitle>Create Costing Template</DialogTitle>
                  <DialogDescription>Define a set of rules for shipping cost calculation.</DialogDescription>
               </DialogHeader>
               <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                  <div className="grid gap-2">
                     <Label htmlFor="template-name">Template Name</Label>
                     <Input 
                       id="template-name" 
                       placeholder="e.g. Standard DHL Express" 
                       value={newTemplate.name}
                       onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                       className="dark:bg-slate-800 dark:border-slate-700"
                     />
                  </div>
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-black uppercase tracking-widest opacity-50">Cost Components</Label>
                      <Button variant="ghost" size="sm" className="text-[10px] h-7 font-bold text-primary" onClick={() => {
                        setNewTemplate({
                          ...newTemplate,
                          items: [...newTemplate.items, { name: "", cost_type: "Fixed", value: 0 }]
                        });
                      }}>
                        <Plus className="w-3 h-3 mr-1" /> Add Component
                      </Button>
                    </div>
                    {newTemplate.items.map((item, idx) => (
                      <div key={idx} className="p-3 border rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-3 relative">
                        <Button variant="ghost" size="icon" className="absolute top-1 right-1 w-6 h-6 text-red-500" onClick={() => {
                          const items = [...newTemplate.items];
                          items.splice(idx, 1);
                          setNewTemplate({...newTemplate, items});
                        }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                        <div className="grid gap-2">
                          <Label className="text-[10px]">Name</Label>
                          <Input size={1} className="h-8 text-xs" value={item.name} onChange={(e) => {
                             const items = [...newTemplate.items];
                             items[idx].name = e.target.value;
                             setNewTemplate({...newTemplate, items});
                          }} placeholder="e.g. Fuel Surcharge" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="grid gap-2">
                            <Label className="text-[10px]">Type</Label>
                            <Select value={item.cost_type} onValueChange={(val: any) => {
                               const items = [...newTemplate.items];
                               items[idx].cost_type = val;
                               setNewTemplate({...newTemplate, items});
                            }}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Fixed">Fixed Amount</SelectItem>
                                <SelectItem value="Percentage">Percentage of Base</SelectItem>
                                <SelectItem value="Per Unit">Per Unit (Qty/Kg)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label className="text-[10px]">Value</Label>
                            <Input type="number" className="h-8 text-xs" value={item.value} onChange={(e) => {
                               const items = [...newTemplate.items];
                               items[idx].value = parseFloat(e.target.value) || 0;
                               setNewTemplate({...newTemplate, items});
                            }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
               <DialogFooter>
                  <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddTemplate} disabled={submitting || !newTemplate.name}>
                     {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                     Save Template
                  </Button>
               </DialogFooter>
            </DialogContent>
         </Dialog>


         {/* Edit Template Dialog */}
         <Dialog open={isEditTemplateDialogOpen} onOpenChange={setIsEditTemplateDialogOpen}>
            <DialogContent className="sm:max-w-[500px] dark:bg-slate-900">
               <DialogHeader>
                  <DialogTitle>Edit Costing Template</DialogTitle>
                  <DialogDescription>Update rules for {editingTemplate?.name}.</DialogDescription>
               </DialogHeader>
               <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                  <div className="grid gap-2">
                     <Label htmlFor="edit-template-name">Template Name</Label>
                     <Input 
                       id="edit-template-name" 
                       value={editingTemplate?.name || ""}
                       onChange={(e) => setEditingTemplate(prev => prev ? {...prev, name: e.target.value} : null)}
                       className="dark:bg-slate-800 dark:border-slate-700"
                     />
                  </div>
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-black uppercase tracking-widest opacity-50">Cost Components</Label>
                      <Button variant="ghost" size="sm" className="text-[10px] h-7 font-bold text-primary" onClick={() => {
                        if (editingTemplate) {
                          setEditingTemplate({
                            ...editingTemplate,
                            items: [...(editingTemplate.items || []), { name: "", cost_type: "Fixed", value: 0 }]
                          });
                        }
                      }}>
                        <Plus className="w-3 h-3 mr-1" /> Add Component
                      </Button>
                    </div>
                    {editingTemplate?.items?.map((item, idx) => (
                      <div key={idx} className="p-3 border rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-3 relative">
                        <Button variant="ghost" size="icon" className="absolute top-1 right-1 w-6 h-6 text-red-500" onClick={() => {
                          if (editingTemplate) {
                            const items = [...(editingTemplate.items || [])];
                            items.splice(idx, 1);
                            setEditingTemplate({...editingTemplate, items});
                          }
                        }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                        <div className="grid gap-2">
                          <Label className="text-[10px]">Name</Label>
                          <Input size={1} className="h-8 text-xs" value={item.name} onChange={(e) => {
                             if (editingTemplate) {
                               const items = [...(editingTemplate.items || [])];
                               items[idx].name = e.target.value;
                               setEditingTemplate({...editingTemplate, items});
                             }
                          }} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="grid gap-2">
                            <Label className="text-[10px]">Type</Label>
                            <Select value={item.cost_type} onValueChange={(val: any) => {
                               if (editingTemplate) {
                                 const items = [...(editingTemplate.items || [])];
                                 items[idx].cost_type = val;
                                 setEditingTemplate({...editingTemplate, items});
                               }
                            }}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Fixed">Fixed Amount</SelectItem>
                                <SelectItem value="Percentage">Percentage of Base</SelectItem>
                                <SelectItem value="Per Unit">Per Unit (Qty/Kg)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label className="text-[10px]">Value</Label>
                            <Input type="number" className="h-8 text-xs" value={item.value} onChange={(e) => {
                               if (editingTemplate) {
                                 const items = [...(editingTemplate.items || [])];
                                 items[idx].value = parseFloat(e.target.value) || 0;
                                 setEditingTemplate({...editingTemplate, items});
                               }
                            }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
               <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditTemplateDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleUpdateTemplate} disabled={submitting || !editingTemplate?.name}>
                     {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                     Update Template
                  </Button>
               </DialogFooter>
            </DialogContent>
         </Dialog>

          {/* Add Factor Dialog */}
          <Dialog open={isFactorDialogOpen} onOpenChange={setIsFactorDialogOpen}>
             <DialogContent className="sm:max-w-[425px] dark:bg-slate-900">
                <DialogHeader>
                   <DialogTitle>Add Logistics Factor</DialogTitle>
                   <DialogDescription>Pre-define a cost factor for export logistics.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                   <div className="grid gap-2">
                      <Label htmlFor="factor-name">Factor Name</Label>
                      <Input 
                        id="factor-name" 
                        placeholder="e.g. Clearance Charges" 
                        value={newFactor.name}
                        onChange={(e) => setNewFactor({...newFactor, name: e.target.value})}
                        className="dark:bg-slate-800 dark:border-slate-700"
                      />
                   </div>
                   <div className="grid gap-2">
                      <Label htmlFor="factor-type">Category</Label>
                      <Select value={newFactor.type} onValueChange={(val) => setNewFactor({...newFactor, type: val})}>
                         <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700">
                            <SelectValue />
                         </SelectTrigger>
                         <SelectContent>
                            <SelectItem value="Logistic">Logistic</SelectItem>
                            <SelectItem value="Clearence">Clearence</SelectItem>
                            <SelectItem value="Freight">Freight</SelectItem>
                            <SelectItem value="General">General</SelectItem>
                         </SelectContent>
                      </Select>
                   </div>
                </div>
                <DialogFooter>
                   <Button variant="outline" onClick={() => setIsFactorDialogOpen(false)}>Cancel</Button>
                   <Button onClick={handleAddFactor} disabled={submitting || !newFactor.name}>
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Save Factor
                   </Button>
                </DialogFooter>
             </DialogContent>
          </Dialog>

          {/* Edit Factor Dialog */}
          <Dialog open={isEditFactorDialogOpen} onOpenChange={setIsEditFactorDialogOpen}>
             <DialogContent className="sm:max-w-[425px] dark:bg-slate-900">
                <DialogHeader>
                   <DialogTitle>Edit Logistics Factor</DialogTitle>
                   <DialogDescription>Update details for {editingFactor?.name}.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                   <div className="grid gap-2">
                      <Label htmlFor="edit-factor-name">Factor Name</Label>
                      <Input 
                        id="edit-factor-name" 
                        value={editingFactor?.name || ""}
                        onChange={(e) => setEditingFactor(prev => prev ? {...prev, name: e.target.value} : null)}
                        className="dark:bg-slate-800 dark:border-slate-700"
                      />
                   </div>
                   <div className="grid gap-2">
                      <Label htmlFor="edit-factor-type">Category</Label>
                      <Select value={editingFactor?.type || "General"} onValueChange={(val) => setEditingFactor(prev => prev ? {...prev, type: val} : null)}>
                         <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700">
                            <SelectValue />
                         </SelectTrigger>
                         <SelectContent>
                            <SelectItem value="Logistic">Logistic</SelectItem>
                            <SelectItem value="Clearence">Clearence</SelectItem>
                            <SelectItem value="Freight">Freight</SelectItem>
                            <SelectItem value="General">General</SelectItem>
                         </SelectContent>
                      </Select>
                   </div>
                   <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="edit-factor-active" 
                        checked={editingFactor?.is_active} 
                        onChange={(e) => setEditingFactor(prev => prev ? {...prev, is_active: e.target.checked} : null)}
                        className="w-4 h-4 rounded border-slate-300"
                      />
                      <Label htmlFor="edit-factor-active">Active</Label>
                   </div>
                </div>
                <DialogFooter>
                   <Button variant="outline" onClick={() => setIsEditFactorDialogOpen(false)}>Cancel</Button>
                   <Button onClick={handleUpdateFactor} disabled={submitting || !editingFactor?.name}>
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Update Factor
                   </Button>
                </DialogFooter>
             </DialogContent>
          </Dialog>

 <Tabs value={initialTab} onValueChange={(val) => router.push(`/admin/shipping/page?tab=${val}`)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8 max-w-xl h-12 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <TabsTrigger value="regional" className="font-bold rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm">
              <Truck className="w-4 h-4 mr-2" /> Regional
            </TabsTrigger>
            <TabsTrigger value="international" className="font-bold rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm">
              <Calculator className="w-4 h-4 mr-2" /> Costing Templates
            </TabsTrigger>
            <TabsTrigger value="factors" className="font-bold rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm">
              <FileText className="w-4 h-4 mr-2" /> Logistics Factors
            </TabsTrigger>
          </TabsList>

          <TabsContent value="regional">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start pb-10">
          {/* Shipping Zones - Left Column */}
          <div className="xl:col-span-5 space-y-6">
            <Card className="border-none shadow-xl overflow-hidden bg-white dark:bg-slate-900">
              <CardHeader className="bg-slate-900 dark:bg-slate-950 text-white p-6">
                <div className="flex items-center gap-3">
                  <Truck className="w-6 h-6 text-blue-400" />
                  <CardTitle className="text-xl font-bold">Shipping Zones</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-6">Zone</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Base Fee</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Free Over</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shippingZones.map((zone) => (
                      <TableRow key={zone.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-slate-50 dark:border-slate-800/50">
                        <TableCell className="pl-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-slate-700 dark:text-slate-200">{zone.name}</span>
                            <Badge variant={zone.is_active ? "success" : "secondary"} className="w-fit text-[9px] h-4">
                              {zone.is_active ? "Active" : "Disabled"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-black text-slate-600 dark:text-slate-300">Rs. {parseFloat(zone.base_fee.toString()).toLocaleString()}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-black text-slate-600 dark:text-slate-300">Rs. {(parseFloat(zone.free_threshold?.toString() || "0")).toLocaleString()}</span>
                        </TableCell>
                        <TableCell className="pr-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="w-8 h-8 text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => {
                              setEditingZone(zone);
                              setIsEditZoneDialogOpen(true);
                            }}>
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="w-8 h-8 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => {
                              if (confirm("Delete zone?")) deleteShippingZone(zone.id).then(() => loadShippingZones());
                            }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="p-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/20 flex items-start gap-4">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300">Pro Tip</h4>
                <p className="text-xs text-blue-700 dark:text-blue-400/80 leading-relaxed mt-1">
                  Assign districts on the right to these zones. If a district isn't mapped, shipping will be disabled for that location.
                </p>
              </div>
            </div>
          </div>

          {/* District Mapping - Right Column */}
          <div className="xl:col-span-7 h-full">
            <Card className="border-none shadow-xl overflow-hidden bg-white dark:bg-slate-900 h-full flex flex-col">
              <CardHeader className="bg-slate-50 dark:bg-slate-950/50 border-b dark:border-slate-800 p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                    <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">District Mapping</CardTitle>
                  </div>
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      placeholder="Search districts..." 
                      className="pl-10 h-10 text-sm font-medium bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                      value={districtSearch}
                      onChange={(e) => setDistrictSearch(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden">
                <div className="h-[calc(100vh-350px)] overflow-y-auto custom-scrollbar">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white dark:bg-slate-900 z-10 border-b dark:border-slate-800">
                      <TableRow className="hover:bg-transparent border-none">
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-8 py-4">District</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-4">Zone Assignment</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDistricts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-20 text-slate-400 font-medium italic">
                            No districts found matching "{districtSearch}"
                          </TableCell>
                        </TableRow>
                      ) : filteredDistricts.map((district) => (
                        <TableRow key={district.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors border-slate-50 dark:border-slate-800/50">
                          <TableCell className="pl-8 py-3">
                            <div className="flex flex-col">
                               <span className="font-bold text-slate-700 dark:text-slate-200">{district.name}</span>
                               <Button variant="link" size="sm" className="h-4 p-0 w-fit text-[10px] text-blue-600 hover:text-blue-700 font-bold" onClick={() => {
                                  setSelectedDistrictForCities(district);
                                  setIsCitiesDialogOpen(true);
                               }}>
                                  Manage Cities
                               </Button>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <Select 
                              defaultValue={district.shipping_zone_id?.toString() || "none"} 
                              onValueChange={(val) => {
                                const zoneId = val === "none" ? null : parseInt(val);
                                updateDistrict(district.id, { ...district, shipping_zone_id: zoneId }).then(() => {
                                  toast({ title: "Assignment Saved", description: `${district.name} updated.` });
                                  loadDistricts();
                                });
                              }}
                            >
                              <SelectTrigger className={cn(
                                "w-64 h-10 font-bold border-slate-200 dark:border-slate-700 transition-all",
                                district.shipping_zone_id 
                                  ? "bg-blue-50/30 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/30" 
                                  : "bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500"
                              )}>
                                <SelectValue placeholder="Select Zone" />
                              </SelectTrigger>
                              <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                                <SelectItem value="none" className="text-red-500">Not Assigned</SelectItem>
                                {shippingZones.map(zone => (
                                  <SelectItem key={zone.id} value={zone.id.toString()}>{zone.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="pr-6">
                             <Button variant="ghost" size="icon" className="text-slate-300 dark:text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => {
                              if (confirm(`Delete ${district.name}?`)) deleteDistrict(district.id).then(() => loadDistricts());
                            }}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
          </TabsContent>

          <TabsContent value="international">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start pb-10">
              <div className="xl:col-span-8 space-y-6">
                <Card className="border-none shadow-xl overflow-hidden bg-white dark:bg-slate-900">
                  <CardHeader className="bg-slate-900 dark:bg-slate-950 text-white p-6 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Globe className="w-6 h-6 text-blue-400" />
                      <div>
                        <CardTitle className="text-xl font-bold">International Providers</CardTitle>
                        <CardDescription className="text-blue-100/60">Manage global carriers and standard shipping rates.</CardDescription>
                      </div>
                    </div>
                    <Button variant="outline" className="bg-white/10 border-white/20 hover:bg-white/20 text-white" onClick={() => setIsProviderDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" /> Add Provider
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-8 py-4">Carrier</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-4">Base Costing</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-4">Status</TableHead>
                          <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loadingProviders ? (
                          <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                        ) : shippingProviders.length === 0 ? (
                          <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-400 italic">No international providers configured.</TableCell></TableRow>
                        ) : shippingProviders.map((provider) => (
                          <TableRow key={provider.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors border-slate-50 dark:border-slate-800/50">
                            <TableCell className="pl-8 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-xs">
                                  {provider.name.substring(0, 2).toUpperCase()}
                                </div>
                                <span className="font-bold text-slate-700 dark:text-slate-200">{provider.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <span className="font-black text-slate-900 dark:text-white">LKR {parseFloat(provider.base_cost.toString()).toLocaleString()}</span>
                            </TableCell>
                            <TableCell className="py-4">
                              <Badge variant={provider.is_active ? "success" : "secondary"}>
                                {provider.is_active ? "Live" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="pr-8 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-blue-600" onClick={() => {
                                  setEditingProvider(provider);
                                  setIsEditProviderDialogOpen(true);
                                }}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-500" onClick={() => {
                                  if (confirm(`Delete ${provider.name}?`)) deleteShippingProvider(provider.id).then(() => loadProviders());
                                }}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              <div className="xl:col-span-4 space-y-6">
                <Card className="border-none shadow-xl bg-blue-600 text-white overflow-hidden">
                  <CardHeader>
                    <div className="p-3 bg-white/20 w-fit rounded-xl mb-2">
                      <Globe className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-white text-xl">Global Reach</CardTitle>
                    <CardDescription className="text-blue-100">Configure providers for international quotations.</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm leading-relaxed text-blue-50/80">
                    Providers defined here will be available in the Quotation builder when the "International" option is enabled.
                    <div className="mt-4 p-4 bg-white/10 rounded-xl border border-white/10">
                      <h5 className="font-bold text-white flex items-center gap-2 mb-1">
                        <Info className="w-3.5 h-3.5" />
                        Cost Calculation
                      </h5>
                      The base cost will be automatically applied as the default shipping fee, which can be overridden per quotation.
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="factors">
             <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start pb-10">
                <div className="xl:col-span-8 space-y-6">
                   <Card className="border-none shadow-xl overflow-hidden bg-white dark:bg-slate-900">
                      <CardHeader className="bg-slate-900 dark:bg-slate-950 text-white p-6 flex flex-row items-center justify-between">
                         <div className="flex items-center gap-3">
                            <FileText className="w-6 h-6 text-indigo-400" />
                            <div>
                               <CardTitle className="text-xl font-bold">Logistics Factors</CardTitle>
                               <CardDescription className="text-indigo-100/60">Manage pre-defined factors for Clearance, Freight, and Logistics.</CardDescription>
                            </div>
                         </div>
                         <Button variant="outline" className="bg-white/10 border-white/20 hover:bg-white/20 text-white" onClick={() => setIsFactorDialogOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" /> Add Factor
                         </Button>
                      </CardHeader>
                      <CardContent className="p-0">
                         <Table>
                            <TableHeader>
                               <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-8 py-4">Factor Name</TableHead>
                                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-4">Category</TableHead>
                                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-4">Status</TableHead>
                                  <TableHead className="w-[100px]"></TableHead>
                               </TableRow>
                            </TableHeader>
                            <TableBody>
                               {loadingFactors ? (
                                 <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" /></TableCell></TableRow>
                               ) : logisticsFactors.length === 0 ? (
                                 <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-400 italic">No logistics factors configured.</TableCell></TableRow>
                               ) : logisticsFactors.map((factor) => (
                                 <TableRow key={factor.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors border-slate-50 dark:border-slate-800/50">
                                    <TableCell className="pl-8 py-4 font-bold text-slate-700 dark:text-slate-200">{factor.name}</TableCell>
                                    <TableCell className="py-4">
                                       <Badge variant="outline" className={cn(
                                          "font-bold",
                                          factor.type === 'Clearence' ? "text-orange-600 border-orange-200 bg-orange-50" :
                                          factor.type === 'Freight' ? "text-blue-600 border-blue-200 bg-blue-50" :
                                          "text-green-600 border-green-200 bg-green-50"
                                       )}>
                                          {factor.type}
                                       </Badge>
                                    </TableCell>
                                    <TableCell className="py-4">
                                       <Badge variant={factor.is_active ? "success" : "secondary"}>
                                          {factor.is_active ? "Active" : "Inactive"}
                                       </Badge>
                                    </TableCell>
                                    <TableCell className="pr-8 text-right">
                                       <div className="flex items-center justify-end gap-1">
                                          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-indigo-600" onClick={() => {
                                             setEditingFactor(factor);
                                             setIsEditFactorDialogOpen(true);
                                          }}>
                                             <Edit className="w-4 h-4" />
                                          </Button>
                                          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-500" onClick={() => handleDeleteFactor(factor.id)}>
                                             <Trash2 className="w-4 h-4" />
                                          </Button>
                                       </div>
                                    </TableCell>
                                 </TableRow>
                               ))}
                            </TableBody>
                         </Table>
                      </CardContent>
                   </Card>
                </div>

                <div className="xl:col-span-4 space-y-6">
                   <Card className="border-none shadow-xl bg-indigo-600 text-white overflow-hidden">
                      <CardHeader>
                         <div className="p-3 bg-white/20 w-fit rounded-xl mb-2">
                            <Info className="w-6 h-6" />
                         </div>
                         <CardTitle className="text-white text-xl">Factor Management</CardTitle>
                         <CardDescription className="text-indigo-100">Standardize your logistics charges.</CardDescription>
                      </CardHeader>
                      <CardContent className="text-sm leading-relaxed text-indigo-50/80">
                         Defining logistics factors here allows your team to select them from a searchable dropdown during costing.
                         <div className="mt-4 p-4 bg-white/10 rounded-xl border border-white/10">
                            <h5 className="font-bold text-white flex items-center gap-2 mb-1 uppercase text-[10px] tracking-widest">Categories</h5>
                            <ul className="space-y-2 mt-2">
                               <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-orange-400" /><span><strong>Clearence:</strong> Customs & Duty related</span></li>
                               <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-400" /><span><strong>Freight:</strong> Shipping & Insurance</span></li>
                               <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-400" /><span><strong>Logistic:</strong> Transport & Handling</span></li>
                            </ul>
                         </div>
                      </CardContent>
                   </Card>
                </div>
             </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
