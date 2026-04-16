"use client";

import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Plus,
  Search,
  Car,
  Trash2,
  Edit,
  User,
  AlertCircle,
  Hash,
  Calendar,
  Loader2,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  fetchCustomers, 
  fetchCustomerVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  fetchMakes,
  fetchModels,
  fetchDepartments
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Vehicle, VehicleMake, VehicleModel } from "@/lib/types";

export default function CustomerVehiclesPage() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  
  // Master data for vehicle creation
  const [makes, setMakes] = useState<VehicleMake[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentVehicle, setCurrentVehicle] = useState<Vehicle | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    customer_id: null as number | null,
    department_id: null as number | null,
    make: "",
    model: "",
    year: new Date().getFullYear().toString(),
    vin: "",
    image_filename: "",
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      loadCustomerVehicles(selectedCustomerId);
      setFormData(prev => ({ ...prev, customer_id: Number(selectedCustomerId) }));
    } else {
      setVehicles([]);
    }
  }, [selectedCustomerId]);

  const loadInitialData = async () => {
    setLoadingCustomers(true);
    try {
      const [customerData, makeData, deptData] = await Promise.all([
        fetchCustomers(),
        fetchMakes(),
        fetchDepartments()
      ]);
      setCustomers(customerData);
      setMakes(makeData);
      setDepartments(deptData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load background data",
        variant: "destructive",
      });
    } finally {
      setLoadingCustomers(false);
    }
  };

  const loadCustomerVehicles = async (id: string) => {
    setLoading(true);
    try {
      const data = await fetchCustomerVehicles(id);
      setVehicles(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load customer vehicles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadModelsForMake = async (makeName: string) => {
    const makeId = makes.find((m) => m.name === makeName)?.id;
    if (!makeId) {
      setModels([]);
      return;
    }
    setLoadingModels(true);
    try {
      const data = await fetchModels(makeId);
      setModels(data);
    } catch (error) {
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleOpenModal = (vehicle: Vehicle | null = null) => {
    if (vehicle) {
      setCurrentVehicle(vehicle);
      setFormData({
        customer_id: Number(selectedCustomerId),
        department_id: null,
        make: vehicle.make,
        model: vehicle.model,
        year: String(vehicle.year),
        vin: vehicle.vin,
        image_filename: vehicle.image_filename || "",
      });
      loadModelsForMake(vehicle.make);
    } else {
      setCurrentVehicle(null);
      setFormData({
        customer_id: Number(selectedCustomerId),
        department_id: null,
        make: makes[0]?.name || "",
        model: "",
        year: new Date().getFullYear().toString(),
        vin: "",
        image_filename: "",
      });
      if (makes[0]?.name) loadModelsForMake(makes[0].name);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.make || !formData.model || !formData.vin) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (currentVehicle) {
        await updateVehicle(currentVehicle.id, formData);
        toast({ title: "Success", description: "Vehicle updated" });
      } else {
        await createVehicle(formData);
        toast({ title: "Success", description: "Vehicle created" });
      }
      setIsModalOpen(false);
      if (selectedCustomerId) loadCustomerVehicles(selectedCustomerId);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save vehicle",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const customerOptions = customers.map(c => ({
    value: String(c.id),
    label: `${c.name} (${c.phone || 'No phone'})`,
    keywords: `${c.name} ${c.nic} ${c.phone}`
  }));

  const selectedCustomer = customers.find(c => String(c.id) === selectedCustomerId);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-bold tracking-tight">Customer Vehicles</h2>
          <p className="text-muted-foreground">Manage vehicles associated with specific customers.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Select Customer</CardTitle>
              <CardDescription>Search and select a customer to view their fleet.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Customer Search</Label>
                  <SearchableSelect
                    options={customerOptions}
                    value={selectedCustomerId}
                    onValueChange={setSelectedCustomerId}
                    placeholder="Search by name, phone or NIC..."
                    disabled={loadingCustomers}
                  />
                </div>

                {selectedCustomer && (
                  <div className="p-4 rounded-lg bg-muted/40 border space-y-3 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {selectedCustomer.name.charAt(0)}
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="font-semibold truncate">{selectedCustomer.name}</span>
                        <span className="text-xs text-muted-foreground">{selectedCustomer.phone}</span>
                      </div>
                    </div>
                    {selectedCustomer.nic && (
                      <div className="flex items-center justify-between text-xs">
                         <span className="text-muted-foreground">NIC</span>
                         <span className="font-medium">{selectedCustomer.nic}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs pt-2 border-t">
                       <span className="text-muted-foreground">Total Vehicles</span>
                       <Badge variant="secondary">{vehicles.length}</Badge>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 shadow-sm border-0 bg-transparent flex flex-col gap-4">
            {!selectedCustomerId ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 bg-card border rounded-xl border-dashed">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <User className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-muted-foreground">No Customer Selected</h3>
                <p className="text-sm text-muted-foreground text-center max-w-[250px] mt-1">
                  Please select a customer from the left panel to manage their vehicles.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold">Registered Vehicles</h3>
                  <Button onClick={() => handleOpenModal()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Register Vehicle
                  </Button>
                </div>

                <div className="bg-card border rounded-xl overflow-hidden shadow-sm flex-1">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Vehicle Info</TableHead>
                        <TableHead>VIN / Identity</TableHead>
                        <TableHead>Year</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-48 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="w-8 h-8 animate-spin text-primary" />
                              <span className="text-muted-foreground">Loading fleet...</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : vehicles.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-48 text-center text-muted-foreground">
                             No vehicles registered for this customer.
                          </TableCell>
                        </TableRow>
                      ) : (
                        vehicles.map((v) => (
                          <TableRow key={v.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded bg-muted flex items-center justify-center">
                                  <Car className="w-5 h-5 text-muted-foreground" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-semibold">{v.make} {v.model}</span>
                                  <span className="text-xs text-muted-foreground">System ID: #{v.id}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <span className="font-mono text-xs font-bold bg-muted px-1.5 py-0.5 rounded w-fit">{v.vin}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-normal capitalize flex items-center gap-1 w-fit">
                                <Calendar className="w-3 h-3" />
                                {v.year}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleOpenModal(v)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{currentVehicle ? "Edit Vehicle" : "Register New Vehicle"}</DialogTitle>
            <DialogDescription>
              Associate a vehicle with <strong>{selectedCustomer?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="make">Make *</Label>
                <Select
                  value={formData.make}
                  onValueChange={(v) => {
                    setFormData({ ...formData, make: v, model: "" });
                    loadModelsForMake(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Make" />
                  </SelectTrigger>
                  <SelectContent>
                    {makes.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Model *</Label>
                <Select
                  value={formData.model}
                  onValueChange={(v) => setFormData({ ...formData, model: v })}
                  disabled={!formData.make || loadingModels}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingModels ? "Loading..." : "Select Model"} />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="year">Manufacturing Year *</Label>
                <Input
                  id="year"
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vin">CHASIS / VIN *</Label>
                <div className="relative">
                   <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                   <Input
                    id="vin"
                    className="pl-9 font-mono uppercase"
                    value={formData.vin}
                    onChange={(e) => setFormData({ ...formData, vin: e.target.value.toUpperCase() })}
                    placeholder="Enter VIN"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t gap-2">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Processing..." : (currentVehicle ? "Update Vehicle" : "Create Vehicle")}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
