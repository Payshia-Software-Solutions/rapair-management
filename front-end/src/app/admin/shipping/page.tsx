"use client";

import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  fetchShippingZones, 
  createShippingZone, 
  updateShippingZone, 
  deleteShippingZone, 
  ShippingZone, 
  fetchDistricts, 
  createDistrict, 
  updateDistrict, 
  deleteDistrict, 
  District,
  fetchCities,
  createCity,
  updateCity,
  deleteCity,
  City
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
  Edit
} from "lucide-react";
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
  const { toast } = useToast();
  const [shippingZones, setShippingZones] = useState<ShippingZone[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [districtSearch, setDistrictSearch] = useState("");
  const [loadingZones, setLoadingZones] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loading, setLoading] = useState(true);

  // Dialog States
  const [isZoneDialogOpen, setIsZoneDialogOpen] = useState(false);
  const [isEditZoneDialogOpen, setIsEditZoneDialogOpen] = useState(false);
  const [isDistrictDialogOpen, setIsDistrictDialogOpen] = useState(false);
  const [isCitiesDialogOpen, setIsCitiesDialogOpen] = useState(false);
  const [isAddCityDialogOpen, setIsAddCityDialogOpen] = useState(false);
  const [isEditCityDialogOpen, setIsEditCityDialogOpen] = useState(false);
  
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
    Promise.all([loadShippingZones(), loadDistricts()]).finally(() => setLoading(false));
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
      </div>
    </DashboardLayout>
  );
}
