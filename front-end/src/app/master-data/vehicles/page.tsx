"use client"

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Trash2, 
  Search, 
  Car, 
  Loader2, 
  AlertCircle,
  Pencil,
  Hash,
  Calendar
} from 'lucide-react';
import { fetchDepartments, fetchMakes, fetchModels, fetchVehicles, createVehicle, deleteVehicle, updateVehicle, uploadVehicleImage, contentUrl } from '@/lib/api';
import { Vehicle, VehicleMake, VehicleModel } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function VehiclesPage() {
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [makes, setMakes] = useState<VehicleMake[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  
  // Form state
  const [formData, setFormData] = useState({
    department_id: null as number | null,
    make: '',
    model: '',
    year: new Date().getFullYear().toString(),
    vin: '',
    image_filename: '' as string,
  });

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
      toast({
        title: "Error",
        description: "Failed to load models",
        variant: "destructive"
      });
    } finally {
      setLoadingModels(false);
    }
  };

  const loadVehicles = async () => {
    setLoading(true);
    try {
      const data = await fetchVehicles('internal');
      setVehicles(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load vehicles",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      try {
        const [vehicleData, makeData, deptData] = await Promise.all([fetchVehicles('internal'), fetchMakes(), fetchDepartments()]);
        setVehicles(vehicleData);
        setMakes(makeData);
        setDepartments(Array.isArray(deptData) ? deptData.map((d: any) => ({ id: Number(d.id), name: String(d.name) })) : []);

        const defaultMake = makeData?.[0]?.name ?? '';
        setFormData((prev) => ({
          ...prev,
          make: prev.make || defaultMake,
        }));
        if (defaultMake) {
          await loadModelsForMake(defaultMake);
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load master data",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    void loadAll();
  }, []);

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let imageFilename = formData.image_filename || '';
      if (imageFile) {
        const up = await uploadVehicleImage(imageFile);
        imageFilename = up.data?.filename ?? imageFilename;
      }
      const payload = {
        ...formData,
        customer_id: null,
        year: parseInt(formData.year),
        image_filename: imageFilename || undefined,
      };

      if (editingVehicleId) {
        await updateVehicle(editingVehicleId.toString(), payload);
        toast({ title: "Success", description: "Vehicle updated successfully" });
      } else {
        await createVehicle(payload);
        toast({ title: "Success", description: "Vehicle added successfully" });
      }
      setIsAddDialogOpen(false);
      setEditingVehicleId(null);
      setImageFile(null);
      setImagePreview('');
      setFormData({
        department_id: null,
        make: makes?.[0]?.name ?? '',
        model: '',
        year: new Date().getFullYear().toString(),
        vin: '',
        image_filename: '',
      });
      if (makes?.[0]?.name) {
        await loadModelsForMake(makes[0].name);
      } else {
        setModels([]);
      }
      loadVehicles();
    } catch (error) {
      toast({
        title: "Error",
        description: editingVehicleId ? "Failed to update vehicle" : "Failed to add vehicle",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAddDialog = async () => {
    setEditingVehicleId(null);
    const defaultMake = makes?.[0]?.name ?? '';
    setFormData({
      department_id: null,
      make: defaultMake,
      model: '',
      year: new Date().getFullYear().toString(),
      vin: '',
      image_filename: '',
    });
    setImageFile(null);
    setImagePreview('');
    if (defaultMake) {
      await loadModelsForMake(defaultMake);
    } else {
      setModels([]);
    }
    setIsAddDialogOpen(true);
  };

  const openEditDialog = async (vehicle: Vehicle) => {
    setEditingVehicleId(vehicle.id);
    setFormData({
      department_id: (vehicle as any).department_id ?? null,
      make: vehicle.make,
      model: vehicle.model,
      year: String(vehicle.year),
      vin: vehicle.vin,
      image_filename: (vehicle as any).image_filename ?? '',
    });
    setImageFile(null);
    const fn = (vehicle as any).image_filename as string | null | undefined;
    setImagePreview(fn ? contentUrl('vehicles', fn) : '');
    await loadModelsForMake(vehicle.make);
    setIsAddDialogOpen(true);
  };

  const handleDeleteVehicle = async (id: number) => {
    if (!confirm('Are you sure you want to delete this vehicle?')) return;
    
    try {
      await deleteVehicle(id.toString());
      toast({
        title: "Deleted",
        description: "Vehicle removed successfully",
      });
      loadVehicles();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete vehicle",
        variant: "destructive"
      });
    }
  };

  const filteredVehicles = vehicles.filter(v => 
    v.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.vin.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const departmentName = (deptId: any) => {
    const id = typeof deptId === "number" ? deptId : (deptId ? Number(deptId) : null);
    if (!id) return null;
    return departments.find((d) => d.id === id)?.name ?? null;
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Vehicle Master Data</h1>
          <p className="text-muted-foreground mt-1">Manage the database of authorized vehicles</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="hidden sm:flex px-3 py-1 bg-primary/10 text-primary border-primary/20">
            {vehicles.length} Total Vehicles
          </Badge>
          <Button className="gap-2 bg-primary" onClick={() => void openAddDialog()}>
            <Plus className="w-4 h-4" />
            Add Vehicle
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={handleAddVehicle}>
                <DialogHeader>
                  <DialogTitle>{editingVehicleId ? "Edit Vehicle" : "Add New Vehicle"}</DialogTitle>
                  <DialogDescription>
                    {editingVehicleId ? "Update the details of the vehicle." : "Enter the details of the vehicle to add it to the master data."}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Department</Label>
                    <div className="col-span-3">
                      <Select
                        value={formData.department_id ? String(formData.department_id) : "none"}
                        onValueChange={(value) => {
                          setFormData((prev) => ({
                            ...prev,
                            department_id: value === "none" ? null : Number(value),
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No department</SelectItem>
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-2">
                        Departments are managed in Master Data → Departments.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Image</Label>
                    <div className="col-span-3 space-y-2">
                      {imagePreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imagePreview}
                          alt="Vehicle"
                          className="h-20 w-20 rounded-lg object-cover border"
                        />
                      ) : (
                        <div className="h-20 w-20 rounded-lg border border-dashed bg-muted/20 flex items-center justify-center text-xs text-muted-foreground">
                          No image
                        </div>
                      )}
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          setImageFile(f);
                          if (f) {
                            const url = URL.createObjectURL(f);
                            setImagePreview(url);
                          } else {
                            setImagePreview(formData.image_filename ? contentUrl('vehicles', formData.image_filename) : '');
                          }
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Uploads to FTP and stores only the filename in the database.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="make" className="text-right">Make</Label>
                    {makes.length === 0 ? (
                      <Input
                        id="make"
                        value={formData.make}
                        onChange={(e) => setFormData({...formData, make: e.target.value})}
                        className="col-span-3"
                        placeholder="e.g. Toyota"
                        required
                      />
                    ) : (
                      <div className="col-span-3">
                        <Select
                          value={formData.make || undefined}
                          onValueChange={(value) => {
                            setFormData((prev) => ({ ...prev, make: value, model: '' }));
                            void loadModelsForMake(value);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a make" />
                          </SelectTrigger>
                          <SelectContent>
                            {makes.map((m) => (
                              <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="model" className="text-right">Model</Label>
                    {makes.length === 0 ? (
                      <Input
                        id="model"
                        value={formData.model}
                        onChange={(e) => setFormData({...formData, model: e.target.value})}
                        className="col-span-3"
                        placeholder="e.g. Camry"
                        required
                      />
                    ) : (
                      <div className="col-span-3">
                        <Select
                          value={formData.model || undefined}
                          onValueChange={(value) => setFormData((prev) => ({ ...prev, model: value }))}
                          disabled={!formData.make || loadingModels || models.length === 0}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={loadingModels ? "Loading models..." : "Select a model"} />
                          </SelectTrigger>
                          <SelectContent>
                            {models.map((m) => (
                              <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="year" className="text-right">Year</Label>
                    <Input
                      id="year"
                      type="number"
                      value={formData.year}
                      onChange={(e) => setFormData({...formData, year: e.target.value})}
                      className="col-span-3"
                      min="1900"
                      max={new Date().getFullYear() + 1}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="vin" className="text-right">VIN</Label>
                    <Input
                      id="vin"
                      value={formData.vin}
                      onChange={(e) => setFormData({...formData, vin: e.target.value})}
                      className="col-span-3"
                      placeholder="17-digit VIN"
                      required
                      maxLength={17}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingVehicleId ? "Update Vehicle" : "Save Vehicle"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by make, model or VIN..." 
            className="pl-9 h-11"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Card className="border-none shadow-md overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading vehicle data...</p>
              </div>
            ) : filteredVehicles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <AlertCircle className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold">No vehicles found</h3>
                <p className="text-muted-foreground max-w-xs">
                  {searchQuery ? "No vehicles match your search criteria." : "Get started by adding your first vehicle."}
                </p>
                {searchQuery && (
                  <Button variant="ghost" className="mt-4" onClick={() => setSearchQuery('')}>Clear Search</Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>VIN</TableHead>
                    <TableHead>Added On</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVehicles.map((vehicle) => (
                    <TableRow key={vehicle.id} className="hover:bg-muted/10 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {(vehicle as any).image_filename ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={contentUrl('vehicles', (vehicle as any).image_filename)}
                              alt="Vehicle"
                              className="h-10 w-10 rounded-lg object-cover border"
                            />
                          ) : (
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <Car className="w-5 h-5 text-primary" />
                            </div>
                          )}
                          <div>
                            <p className="font-bold">{vehicle.make} {vehicle.model}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">MASTER DATA REF: #{vehicle.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {departmentName((vehicle as any).department_id) ?? "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm">{vehicle.year}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm font-mono">{vehicle.vin}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {new Date(vehicle.created_at).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => void openEditDialog(vehicle)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteVehicle(vehicle.id)}
                          >
                            <Trash2 className="w-4 h-4" />
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
    </DashboardLayout>
  );
}
