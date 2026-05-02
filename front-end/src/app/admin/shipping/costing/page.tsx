"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  fetchCostingTemplate, 
  fetchCostingTemplates, 
  fetchShippingProviders,
  fetchCostingSheet,
  createCostingSheet,
  updateCostingSheet,
  fetchParts,
  fetchCustomers,
  fetchLogisticsFactors,
  createLogisticsFactor,
  updateLogisticsFactor,
  deleteLogisticsFactor,
  fetchLogisticsCategories,
  createLogisticsCategory,
  updateLogisticsCategory,
  deleteLogisticsCategory,
  fetchTermDefaults,
  fetchPackagingTypes,
  createPackagingType,
  updatePackagingType,
  deletePackagingType,
  fetchPalletTypes,
  createPalletType,
  updatePalletType,
  deletePalletType,
  duplicateCostingSheet,
  fetchContainerTypes,
  ShippingCostingTemplate,
  ShippingCostingItem,
  LogisticsFactor,
  LogisticsCategory,
  Part,
  PackagingType,
  PalletType,
  ContainerType
} from "@/lib/api";
import { fetchBomByPart } from "@/lib/api/production";
import { ProductionBOMDialog } from "@/components/production/bom-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Printer,
  Save, 
  ChevronLeft, 
  Loader2,
  Calculator,
  Plus,
  Trash2,
  Edit,
  Package,
  Box,
  User,
  Truck,
  TrendingUp,
  Info,
  DollarSign,
  Briefcase,
  Plane,
  Ship,
  Zap,
  Anchor,
  Container,
  RotateCcw,
  Lock,
  Globe,
  ShieldCheck,
  Copy,
  Download
} from "lucide-react";

const INCOTERM_DESCRIPTIONS: Record<string, string> = {
  'EXW': 'Seller makes goods available at their premises. Buyer assumes all risks and costs.',
  'FCA': 'Seller delivers goods to a carrier nominated by the buyer.',
  'FAS': 'Seller delivers goods alongside the vessel at the named port of shipment.',
  'FOB': 'Seller bears costs and risks until goods are loaded on board the vessel.',
  'CFR': 'Seller pays costs to destination port, but risk transfers once loaded.',
  'CIF': 'Same as CFR, plus seller pays for marine insurance.',
  'CPT': 'Seller pays for carriage to the named destination. Risk transfers at first carrier.',
  'CIP': 'Same as CPT, plus seller pays for insurance.',
  'DAP': 'Seller delivers goods ready for unloading at the named place of destination.',
  'DPU': 'Seller bears all risks and costs to unload goods at the destination.',
  'DDP': 'Seller bears all costs, including import clearance and duties.'
};

const FREIGHT_TYPES = ['Sea Freight', 'Air Freight', 'Courier', 'Land Freight'];

export default function ExportCostingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bomDialogOpen, setBomDialogOpen] = useState(false);
  const [currentBomIdx, setCurrentBomIdx] = useState<number | null>(null);
  const [selectedBom, setSelectedBom] = useState<any>(null);
  const [templates, setTemplates] = useState<ShippingCostingTemplate[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [availableParts, setAvailableParts] = useState<Part[]>([]);
  const [logisticsFactors, setLogisticsFactors] = useState<LogisticsFactor[]>([]);
  const [logisticsCategories, setLogisticsCategories] = useState<LogisticsCategory[]>([]);
  const [packagingTypes, setPackagingTypes] = useState<PackagingType[]>([]);
  const [palletTypes, setPalletTypes] = useState<PalletType[]>([]);
  const [containerTypes, setContainerTypes] = useState<ContainerType[]>([]);
  
  const [isFactorDialogOpen, setIsFactorDialogOpen] = useState(false);
  const [isEditFactorDialogOpen, setIsEditFactorDialogOpen] = useState(false);
  const [isManageFactorsOpen, setIsManageFactorsOpen] = useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isManagePackagingOpen, setIsManagePackagingOpen] = useState(false);
  const [isPackagingDialogOpen, setIsPackagingDialogOpen] = useState(false);
  const [isEditPackagingDialogOpen, setIsEditPackagingDialogOpen] = useState(false);
  const [isManagePalletsOpen, setIsManagePalletsOpen] = useState(false);
  const [isPalletDialogOpen, setIsPalletDialogOpen] = useState(false);
  const [isEditPalletDialogOpen, setIsEditPalletDialogOpen] = useState(false);
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  
  const [newFactor, setNewFactor] = useState({ name: "", type: "", absorption_method: "Value" as const, default_terms: [] as string[] });
  const [editingFactor, setEditingFactor] = useState<(LogisticsFactor & { default_terms_array?: string[] }) | null>(null);
  const [newCategory, setNewCategory] = useState({ name: "", description: "" });
  const [newPackaging, setNewPackaging] = useState({ 
    name: "", type: "Carton", length_cm: 0, width_cm: 0, height_cm: 0, tare_weight_kg: 0, max_weight_capacity_kg: 0 
  });
  const [editingPackaging, setEditingPackaging] = useState<PackagingType | null>(null);
  const [newPallet, setNewPallet] = useState({ 
    name: "", length_cm: 0, width_cm: 0, max_load_height_cm: 0, tare_weight_kg: 0, max_weight_capacity_kg: 0 
  });
  const [editingPallet, setEditingPallet] = useState<PalletType | null>(null);
  
  const [sheet, setSheet] = useState({
    template_id: "",
    customer_id: "",
    costing_number: "",
    reference_number: "",
    status: "Draft",
    items: [] as { 
      part_id: string; name: string; quantity: number; unit_cost: number; line_total: number; unit?: string; weight: number; cbm: number; profit_margin: number; packing_type: string;
      units_per_carton?: number; 
      carton_length?: number; carton_width?: number; carton_height?: number; volume_cbm?: number; carton_tare_weight?: number; net_weight?: number; gross_weight?: number;
    }[],
    cost_components: [] as ShippingCostingItem[],
    manual_costs: [
      { name: 'Local Transport to Port', amount: 0, absorption_method: 'Value' as const },
      { name: 'Origin Terminal Handling', amount: 0, absorption_method: 'Value' as const },
      { name: 'Export Customs Clearance', amount: 0, absorption_method: 'Value' as const }
    ],
    shipping_term: "FOB",
    freight_type: "Sea Freight",
    shipment_mode: "LCL",
    profit_method: "Markup" as 'Markup' | 'Margin' | 'Fixed',
    profit_margin_percent: 10,
    other_costs: 0,
    overhead_absorption_method: 'Value',
    target_currency: 'USD',
    exchange_rate: 300
  });

  const [loadPlan, setLoadPlan] = useState({
     palletize: false,
     pallet_type_id: "",
     manual_container_override: false,
     selected_container_id: "",
     manual_packing_override: false,
     manual_cartons_count: 1,
     manual_packaging_type_id: "none"
  });

  useEffect(() => {
    const init = async () => {
      try {
        const [tRes, cRes, pRes, fRes, catRes, packRes, palRes, contRes] = await Promise.all([
          fetchCostingTemplates(),
          fetchCustomers(),
          fetchParts(),
          fetchLogisticsFactors(),
          fetchLogisticsCategories(),
          fetchPackagingTypes(),
          fetchPalletTypes(),
          fetchContainerTypes()
        ]);
        
        setTemplates(tRes.data || []);
        setCustomers(cRes || []);
        setAvailableParts(pRes || []);
        setLogisticsFactors(fRes.data || []);
        setLogisticsCategories(catRes.data || []);
        setPackagingTypes(packRes?.data || []);
        setPalletTypes(palRes?.data || []);
        setContainerTypes(contRes?.data || []);

        if (editId) {
          const sRes = await fetchCostingSheet(Number(editId));
          if (sRes.status === 'success') {
            const data = sRes.data;
            setSheet({
              template_id: data.template_id?.toString() || "",
              customer_id: data.customer_id?.toString() || "",
              costing_number: data.costing_number || "",
              reference_number: data.reference_number || "",
              shipping_term: data.shipping_term || "FOB",
              freight_type: data.freight_type || "Sea Freight",
              status: data.status,
              items: (data.product_items || []).map((p: any) => ({
                ...p,
                line_total: Number(p.quantity) * Number(p.unit_cost),
                carton_length: Number(p.carton_length_cm || p.carton_length || 0),
                carton_width: Number(p.carton_width_cm || p.carton_width || 0),
                carton_height: Number(p.carton_height_cm || p.carton_height || 0),
                carton_tare_weight: Number(p.carton_tare_weight_kg || p.carton_tare_weight || 0),
                net_weight: Number(p.net_weight_kg || p.net_weight || 0),
                gross_weight: Number(p.gross_weight_kg || p.gross_weight || 0),
                volume_cbm: Number(p.volume_cbm || 0),
                units_per_carton: Number(p.units_per_carton || 1),
                packaging_type_id: p.packaging_type_id?.toString() || ""
              })),
              cost_components: (data.items || []).filter((i: any) => i.cost_type !== 'Manual'),
              manual_costs: (data.items || []).filter((i: any) => i.cost_type === 'Manual').map((i: any) => ({ 
                name: i.name, 
                amount: Number(i.calculated_amount),
                absorption_method: i.absorption_method || 'Value'
              })),
              shipment_mode: data.shipment_mode || "LCL",
              profit_method: data.profit_method || "Markup",
              profit_base: data.profit_base || "Landed",
              profit_margin_percent: Number(data.profit_value || 10),
              other_costs: Number(data.other_costs || 0),
              overhead_absorption_method: data.overhead_absorption_method || "Value",
              target_currency: data.target_currency || "USD",
              exchange_rate: Number(data.exchange_rate || 300)
            });

            // Re-fetch BOM materials for items that might have them
            const itemsWithBoms = (data.product_items || []).map(async (p: any, idx: number) => {
               // We need to know if it's a recipe part. availableParts should have this.
               const part = (pRes || []).find((ap: any) => ap.id === p.part_id);
               if (part?.recipe_type && part.recipe_type !== 'Standard') {
                  try {
                     const bom = await fetchBomByPart(p.part_id);
                     return { idx, materials: bom?.items || [] };
                  } catch (e) { return { idx, materials: [] }; }
               }
               return { idx, materials: [] };
            });

            const materialsResults = await Promise.all(itemsWithBoms);
            setSheet(prev => {
               const next = { ...prev };
               materialsResults.forEach(res => {
                  if (next.items[res.idx]) {
                     (next.items[res.idx] as any).bom_materials = res.materials;
                  }
               });
               return next;
            });
          }
        }
      } catch (err: any) {
        console.error("Initialization error:", err);
        toast({ title: "Error", description: err?.message || "Failed to load data", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [editId]);

  const addItem = () => {
    setSheet({
      ...sheet,
      items: [...sheet.items, { 
        part_id: "", 
        name: "", 
        quantity: 1, 
        unit_cost: 0, 
        line_total: 0, 
        weight: 0, 
        cbm: 0, 
        profit_margin: 0, 
        packing_type: "Carton",
        carton_length: 0,
        carton_width: 0,
        carton_height: 0,
        units_per_carton: 1,
        volume_cbm: 0,
        carton_tare_weight: 0,
        net_weight: 0,
        gross_weight: 0,
        hs_code: "",
        packaging_type_id: "none"
      }]
    });
  };

  const openBomModal = async (idx: number) => {
    const item = sheet.items[idx];
    if (!item.part_id) {
       toast({ title: "Error", description: "Please select a product first", variant: "destructive" });
       return;
    }

    try {
       setSubmitting(true);
       const bom = await fetchBomByPart(item.part_id);
       setCurrentBomIdx(idx);
       if (bom) {
          setSelectedBom(bom);
       } else {
          // Initialize a new BOM skeleton
          setSelectedBom({
             name: `${item.name} BOM`,
             output_part_id: Number(item.part_id),
             output_qty: 1,
             items: []
          });
       }
       setBomDialogOpen(true);
    } catch (e: any) {
       toast({ title: "Error", description: "Failed to load BOM data", variant: "destructive" });
    } finally {
       setSubmitting(false);
    }
  };

  const handleBomSuccess = async () => {
    if (currentBomIdx === null) return;
    
    // Re-fetch the BOM to get the latest items and costs
    const item = sheet.items[currentBomIdx];
    try {
       const bom = await fetchBomByPart(item.part_id);
       if (bom && Array.isArray(bom.items)) {
          // Calculate the total cost from BOM components
          const totalCost = bom.items.reduce((sum: number, i: any) => sum + (Number(i.qty) * Number(i.current_cost || 0)), 0);
          const yieldQty = Number(bom.output_qty) || 1;
          const costPerUnit = totalCost / yieldQty;
          
          updateItem(currentBomIdx, 'unit_cost', costPerUnit);
          // Update materials list too
          setSheet(prev => {
            const next = { ...prev };
            next.items[currentBomIdx!].bom_materials = bom.items;
            return next;
          });
          toast({ title: "Price Updated", description: `Unit cost updated from BOM: LKR ${costPerUnit.toLocaleString()}` });
       }
    } catch (e) {}
  };

  const removeItem = (index: number) => {
    const newItems = [...sheet.items];
    newItems.splice(index, 1);
    setSheet({ ...sheet, items: newItems });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...sheet.items];
    if (field === 'part_id') {
      const part = availableParts.find(p => p.id.toString() === value) as any;
      
      const upc = Number(part?.units_per_carton) || 1;
      const cbm_per_unit = part && Number(part.volume_cbm) > 0 ? Number(part.volume_cbm) : 0;
      const wt_per_unit = part ? (Number(part.gross_weight_kg) || Number(part.net_weight_kg) || Number(part.weight) || 0) : 0;

      newItems[index] = { 
        ...newItems[index], 
        part_id: value, 
        name: part?.part_name || part?.name || "", 
        unit_cost: Number(part?.price || 0),
        unit: part?.base_unit || part?.unit || "Units",
        units_per_carton: upc,
        packing_type: part?.packing_type || "Carton",
        weight: wt_per_unit,
        cbm: cbm_per_unit,
        carton_length: Number(part?.carton_length_cm || 0),
        carton_width: Number(part?.carton_width_cm || 0),
        carton_height: Number(part?.carton_height_cm || 0),
        volume_cbm: Number(part?.volume_cbm || 0),
        carton_tare_weight: Number(part?.carton_tare_weight_kg || 0),
        net_weight: Number(part?.net_weight_kg || 0),
        gross_weight: Number(part?.gross_weight_kg || 0),
        hs_code: part?.hs_code || "",
        recipe_type: part?.recipe_type || "Standard",
        bom_materials: []
      };
      newItems[index].line_total = Number(newItems[index].quantity) * Number(newItems[index].unit_cost);

      // Async fetch BOM materials if needed
      if (part?.recipe_type && part.recipe_type !== 'Standard') {
        void (async () => {
           try {
              const bom = await fetchBomByPart(value);
              if (bom && bom.items) {
                 setSheet(prev => {
                    const next = { ...prev };
                    next.items[index].bom_materials = bom.items;
                    return next;
                 });
              }
           } catch (e) {}
        })();
      }
    } else if (field === 'carton_length' || field === 'carton_width' || field === 'carton_height' || field === 'units_per_carton' || field === 'volume_cbm') {
      newItems[index] = { ...newItems[index], [field]: value };
      
      if (field !== 'volume_cbm') {
        const l = Number(newItems[index].carton_length || 0);
        const w = Number(newItems[index].carton_width || 0);
        const h = Number(newItems[index].carton_height || 0);
        const upc = Number(newItems[index].units_per_carton || 1);
        const carton_cbm = (l * w * h) / 1000000;
        if (carton_cbm > 0) {
          newItems[index].volume_cbm = carton_cbm;
          newItems[index].cbm = carton_cbm / upc;
        }
      } else {
        const upc = Number(newItems[index].units_per_carton || 1);
        newItems[index].cbm = Number(value || 0) / upc;
      }
    } else if (field === 'packaging_type_id') {
      const pack = packagingTypes.find(p => p.id.toString() === value);
      newItems[index] = { 
        ...newItems[index], 
        packaging_type_id: value,
        carton_length: pack ? Number(pack.length_cm) : newItems[index].carton_length,
        carton_width: pack ? Number(pack.width_cm) : newItems[index].carton_width,
        carton_height: pack ? Number(pack.height_cm) : newItems[index].carton_height,
        volume_cbm: pack ? Number(pack.cbm) : newItems[index].volume_cbm,
        carton_tare_weight: pack ? Number(pack.tare_weight_kg) : newItems[index].carton_tare_weight,
        units_per_carton: pack && Number(pack.max_weight_capacity_kg) > 0 ? Number(pack.max_weight_capacity_kg) : newItems[index].units_per_carton
      };
      const upc = Number(newItems[index].units_per_carton || 1);
      newItems[index].cbm = Number(newItems[index].volume_cbm || 0) / upc;
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    newItems[index].line_total = Number(newItems[index].quantity) * Number(newItems[index].unit_cost);
    setSheet({ ...sheet, items: newItems });
  };

  const handleTemplateChange = async (tid: string) => {
    if (!tid || tid === "none") {
      setSheet({ ...sheet, template_id: "", cost_components: [] });
      return;
    }
    try {
      const res = await fetchCostingTemplate(Number(tid));
      if (res.status === 'success') {
        setSheet({ ...sheet, template_id: tid, cost_components: res.data.items || [] });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to load template" });
    }
  };

  const handleTermChange = async (v: string) => {
    try {
      setLoadingDefaults(true);
      setSheet(prev => ({ ...prev, shipping_term: v }));
      
      const res = await fetchTermDefaults(v);
      if (res.status === 'success' && res.data.length > 0) {
        const defaults = res.data.map((f: any) => ({ 
          name: f.name, 
          amount: 0, 
          absorption_method: f.absorption_method || 'Value' 
        }));
        
        const currentCosts = sheet.manual_costs.filter(m => m.name && m.amount > 0);
        const combined = [...currentCosts, ...defaults.filter((d: any) => !currentCosts.some(c => c.name === d.name))];
        
        setSheet(prev => ({ ...prev, manual_costs: combined }));
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to load term defaults" });
    } finally {
      setLoadingDefaults(false);
    }
  };

  const totalQuantity = sheet.items.reduce((sum, item) => sum + Number(item.quantity), 0);
  const baseProductCost = sheet.items.reduce((sum, item) => sum + Number(item.line_total), 0);
  
  const calculatedComponents = sheet.cost_components.map(comp => {
    let amount = 0;
    if (comp.cost_type === 'Fixed') amount = Number(comp.value);
    else if (comp.cost_type === 'Percentage') amount = baseProductCost * (Number(comp.value) / 100);
    else if (comp.cost_type === 'Per Unit') amount = Number(comp.value) * totalQuantity;
    return { ...comp, calculated_amount: amount };
  });

  const computeLoadPlan = () => {
     let netWeight = 0;
     let grossWeight = 0;
     let totalCbm = 0;
     let totalCartons = 0;
     let packagingTare = 0;
     let palletTare = 0;

     sheet.items.forEach(item => {
        const itemNetW = Number(item.quantity) * Number(item.weight || 0);
        const itemNetV = Number(item.quantity) * Number(item.cbm || 0);
        netWeight += itemNetW;
        grossWeight += itemNetW;

        if (!loadPlan.manual_packing_override) {
           if (item.packaging_type_id && item.units_per_carton && item.units_per_carton > 0) {
              const packDef = packagingTypes.find(p => p.id.toString() === item.packaging_type_id);
              const cartons = Math.ceil(Number(item.quantity) / item.units_per_carton);
              totalCartons += cartons;

              if (packDef) {
                 const currentPackTare = (cartons * Number(packDef.tare_weight_kg));
                 packagingTare += currentPackTare;
                 grossWeight += currentPackTare;
                 totalCbm += cartons * Number(packDef.cbm);
              } else {
                 totalCbm += itemNetV;
              }
           } else {
              totalCbm += itemNetV;
           }
        }
     });

     if (loadPlan.manual_packing_override) {
         if (loadPlan.manual_packaging_type_id && loadPlan.manual_packaging_type_id !== "none" && loadPlan.manual_cartons_count > 0) {
             const manualPackDef = packagingTypes.find(p => p.id.toString() === loadPlan.manual_packaging_type_id);
             if (manualPackDef) {
                totalCartons = loadPlan.manual_cartons_count;
                const currentPackTare = (totalCartons * Number(manualPackDef.tare_weight_kg));
                packagingTare = currentPackTare;
                grossWeight += currentPackTare;
                totalCbm = totalCartons * Number(manualPackDef.cbm);
             } else {
                 sheet.items.forEach(item => {
                     totalCbm += Number(item.quantity) * Number(item.cbm || 0);
                 });
             }
         } else {
             sheet.items.forEach(item => {
                 totalCbm += Number(item.quantity) * Number(item.cbm || 0);
             });
         }
     }

     let finalPallets = 0;
     if (loadPlan.palletize && loadPlan.pallet_type_id) {
        const palDef = palletTypes.find(p => p.id.toString() === loadPlan.pallet_type_id);
        if (palDef) {
           const cbmPerPallet = (Number(palDef.length_cm) / 100) * (Number(palDef.width_cm) / 100) * (Number(palDef.max_load_height_cm) / 100);
           const palletsByVolume = Math.ceil(totalCbm / cbmPerPallet);
           
           let palletsByWeight = 0;
           if (Number(palDef.max_weight_capacity_kg) > 0) {
              palletsByWeight = Math.ceil(grossWeight / Number(palDef.max_weight_capacity_kg));
           }

           finalPallets = Math.max(palletsByVolume, palletsByWeight);
           
           const currentPalletTare = finalPallets * Number(palDef.tare_weight_kg);
           palletTare += currentPalletTare;
           grossWeight += currentPalletTare;
           totalCbm = finalPallets * cbmPerPallet;
        }
     }

     return { netWeight, grossWeight, totalCbm, totalCartons, finalPallets, packagingTare, palletTare };
  };

  const loadData = computeLoadPlan();
  const totalLevies = calculatedComponents.reduce((sum, c) => sum + (c.calculated_amount || 0), 0);
  const totalManualCosts = sheet.manual_costs.reduce((sum, c) => sum + Number(c.amount), 0);
  
  const perUnitRateFromTemplates = calculatedComponents
    .filter(c => c.cost_type === 'Per Unit')
    .reduce((sum, c) => sum + Number(c.value), 0);
  
  const perUnitRateFromManual = sheet.manual_costs
    .filter(m => m.absorption_method === 'Quantity' && totalQuantity > 0)
    .reduce((sum, m) => sum + (Number(m.amount) / totalQuantity), 0);

  const perUnitRate = perUnitRateFromTemplates + perUnitRateFromManual;

  const totalNetWeight = loadData.netWeight;
  const totalGrossWeight = loadData.grossWeight;

  const perNetWeightRate = sheet.manual_costs
    .filter(m => m.absorption_method === 'Net Weight' && totalNetWeight > 0)
    .reduce((sum, m) => sum + (Number(m.amount) / totalNetWeight), 0);
  
  const perGrossWeightRate = sheet.manual_costs
    .filter(m => (m.absorption_method === 'Gross Weight' || m.absorption_method === 'Weight') && totalGrossWeight > 0)
    .reduce((sum, m) => sum + (Number(m.amount) / totalGrossWeight), 0);

  const perVolumeRateFromManual = sheet.manual_costs
    .filter(m => m.absorption_method === 'Volume' && loadData.totalCbm > 0)
    .reduce((sum, m) => sum + (Number(m.amount) / loadData.totalCbm), 0);
  
  const totalDirectCosts = baseProductCost + totalLevies + totalManualCosts + Number(sheet.other_costs);
  
  const totalOverheadOnly = (totalDirectCosts - (perUnitRate * totalQuantity) - (perNetWeightRate * totalNetWeight) - (perGrossWeightRate * totalGrossWeight) - (perVolumeRateFromManual * loadData.totalCbm)) - baseProductCost;
  const overheadAbsorptionFactor = baseProductCost > 0 ? (totalOverheadOnly / baseProductCost) : 0;

  // Centralized item math to ensure labels and totals always match
  const calculateItemLandedPrice = (item: any) => {
    const unitCost = Number(item.unit_cost) || 0;
    const directCharges = perUnitRate + 
                          ((item.weight || 0) * perNetWeightRate) + 
                          ((item.weight || 0) * (totalNetWeight > 0 ? (totalGrossWeight / totalNetWeight) : 1) * perGrossWeightRate) + 
                          ((item.cbm || 0) * perVolumeRateFromManual);
    
    let overheadCharges = 0;
    if (sheet.overhead_absorption_method === 'Quantity' && totalQuantity > 0) {
      overheadCharges = totalOverheadOnly / totalQuantity;
    } else if (sheet.overhead_absorption_method === 'Net Weight' && totalNetWeight > 0) {
      overheadCharges = (totalOverheadOnly / totalNetWeight) * (item.weight || 0);
    } else if (sheet.overhead_absorption_method === 'Volume' && loadData.totalCbm > 0) {
      overheadCharges = (totalOverheadOnly / loadData.totalCbm) * (item.cbm || 0);
    } else if ((sheet.overhead_absorption_method === 'Gross Weight' || sheet.overhead_absorption_method === 'Weight') && totalGrossWeight > 0) {
      overheadCharges = (totalOverheadOnly / totalGrossWeight) * ((item.weight || 0) * (totalNetWeight > 0 ? (totalGrossWeight / totalNetWeight) : 1));
    } else {
      // Default to Value based absorption
      overheadCharges = (unitCost * overheadAbsorptionFactor);
    }
    const itemCostBeforeProfit = unitCost + directCharges + overheadCharges;
    
    // Determine the base amount for profit calculation (Item level override first)
    const effectiveBase = item.profit_base || sheet.profit_base || 'Landed';
    const calculationBase = effectiveBase === 'Base' ? unitCost : itemCostBeforeProfit;
    
    const effectiveMargin = (item.profit_margin && Number(item.profit_margin) > 0) 
      ? Number(item.profit_margin) 
      : Number(sheet.profit_margin_percent);

    const effectiveMethod = item.profit_method || sheet.profit_method;
    
    let profitAmount = 0;
    if (effectiveMethod === 'Margin') {
      const m = effectiveMargin / 100;
      // Note: Margin on Base Cost is rare but we support it if base is selected
      profitAmount = m < 1 ? (calculationBase / (1 - m)) - calculationBase : 0;
    } else if (effectiveMethod === 'Fixed') {
      profitAmount = effectiveMargin;
    } else {
      // Markup or default
      profitAmount = calculationBase * (effectiveMargin / 100);
    }
    
    return {
      base: unitCost,
      direct: directCharges,
      other: overheadCharges,
      profit: profitAmount,
      total: itemCostBeforeProfit + profitAmount,
      method: effectiveMethod,
      isOverride: (item.profit_margin && Number(item.profit_margin) > 0) || (item.profit_method && item.profit_method !== sheet.profit_method)
    };
  };

  const profitMarginAmount = sheet.items.reduce((sum, item) => {
    return sum + (calculateItemLandedPrice(item).profit * item.quantity);
  }, 0);

  const grandTotal = totalDirectCosts + profitMarginAmount;
  const pricePerUnit = totalQuantity > 0 ? grandTotal / totalQuantity : 0;
  const profitAbsorptionFactor = baseProductCost > 0 ? (profitMarginAmount / baseProductCost) : 0;
  
  const hasOverrides = sheet.items.some(item => (item.profit_margin && Number(item.profit_margin) > 0) || item.profit_method);
  
  const saveSheet = async (shouldRedirect = true, dataOverride = null) => {
    if (!sheet.customer_id && !dataOverride?.customer_id) {
        toast({ title: "Error", description: "Customer is required", variant: "destructive" });
        return false;
    }
    setSubmitting(true);
    try {
      const activeSheet = dataOverride || sheet;
      const manualItemsForBackend = activeSheet.manual_costs.map((m: any) => ({
          name: m.name,
          cost_type: 'Manual',
          value: m.amount,
          calculated_amount: m.amount,
          absorption_method: m.absorption_method
      }));

      const payload = {
        ...activeSheet,
        profit_value: activeSheet.profit_margin_percent, // Map for backend
        total_cost: grandTotal,
        total_quantity: totalQuantity,
        base_carrier_cost: baseProductCost, 
        items: [...calculatedComponents, ...manualItemsForBackend], 
        product_items: activeSheet.items 
      };
      
      let savedId = editId;
      if (editId) {
        await updateCostingSheet(Number(editId), payload);
      } else {
        const res = await createCostingSheet(payload);
        savedId = res?.id || res?.data?.id;
        // If it's a new sheet, we might want to update the URL so further saves are updates
        if (savedId && !shouldRedirect) {
           router.replace(`/admin/shipping/costing?id=${savedId}`);
        }
      }
      
      toast({ title: "Success", description: "Export costing saved successfully" });
      if (shouldRedirect) {
        router.push("/accounts/costing-sheet");
      }
      return savedId;
    } catch (err) {
      toast({ title: "Error", description: "Failed to save costing sheet", variant: "destructive" });
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleSave = () => saveSheet(true);

  const handleAddFactor = async () => {
    if (!newFactor.name) return;
    try {
      setSubmitting(true);
      await createLogisticsFactor({
        ...newFactor,
        default_terms: newFactor.default_terms
      });
      toast({ title: "Success", description: "Logistics factor added." });
      setIsFactorDialogOpen(false);
      setNewFactor({ name: "", type: "", default_terms: [] });
      
      const fRes = await fetchLogisticsFactors();
      setLogisticsFactors(fRes.data || []);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditFactor = (f: LogisticsFactor) => {
    setEditingFactor({
      ...f,
      default_terms_array: f.default_terms ? f.default_terms.split(',') : []
    });
    setIsEditFactorDialogOpen(true);
  };

  const toggleTermForFactor = (term: string, isNew: boolean) => {
    if (isNew) {
      const current = newFactor.default_terms || [];
      const updated = current.includes(term) ? current.filter(t => t !== term) : [...current, term];
      setNewFactor({ ...newFactor, default_terms: updated });
    } else if (editingFactor) {
      const current = editingFactor.default_terms_array || [];
      const updated = current.includes(term) ? current.filter(t => t !== term) : [...current, term];
      setEditingFactor({ ...editingFactor, default_terms_array: updated });
    }
  };

  const handleUpdateFactor = async () => {
    if (!editingFactor || !editingFactor.name) return;
    try {
      setSubmitting(true);
      await updateLogisticsFactor(editingFactor.id, {
        ...editingFactor,
        default_terms: editingFactor.default_terms_array
      });
      toast({ title: "Success", description: "Factor updated." });
      setIsEditFactorDialogOpen(false);
      setEditingFactor(null);
      
      const fRes = await fetchLogisticsFactors();
      setLogisticsFactors(fRes.data || []);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteFactor = async (id: number) => {
    if (!confirm("Are you sure you want to delete this factor?")) return;
    try {
      setSubmitting(true);
      await deleteLogisticsFactor(id);
      toast({ title: "Success", description: "Factor deleted." });
      
      const fRes = await fetchLogisticsFactors();
      setLogisticsFactors(fRes.data || []);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.name) return;
    try {
      setSubmitting(true);
      await createLogisticsCategory(newCategory);
      toast({ title: "Success", description: "Category added." });
      setIsCategoryDialogOpen(false);
      setNewCategory({ name: "", description: "" });
      
      const res = await fetchLogisticsCategories();
      setLogisticsCategories(res.data || []);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm("Are you sure you want to delete this category? Factors using this category might need update.")) return;
    try {
      setSubmitting(true);
      await deleteLogisticsCategory(id);
      toast({ title: "Success", description: "Category deleted." });
      
      const res = await fetchLogisticsCategories();
      setLogisticsCategories(res.data || []);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddPackaging = async () => {
    if (!newPackaging.name) return;
    try {
      setSubmitting(true);
      const cbm = (Number(newPackaging.length_cm) * Number(newPackaging.width_cm) * Number(newPackaging.height_cm)) / 1000000;
      await createPackagingType({ ...newPackaging, cbm });
      toast({ title: "Success", description: "Packaging type added." });
      setIsPackagingDialogOpen(false);
      setNewPackaging({ name: "", type: "Carton", length_cm: 0, width_cm: 0, height_cm: 0, tare_weight_kg: 0, max_weight_capacity_kg: 0 });
      
      const res = await fetchPackagingTypes();
      setPackagingTypes(res.data || []);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePackaging = async (id: number) => {
    if (!confirm("Are you sure you want to delete this packaging type?")) return;
    try {
      setSubmitting(true);
      await deletePackagingType(id);
      toast({ title: "Success", description: "Packaging type deleted." });
      
      const res = await fetchPackagingTypes();
      setPackagingTypes(res.data || []);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPackaging = (pt: PackagingType) => {
    setEditingPackaging(pt);
    setIsEditPackagingDialogOpen(true);
  };

  const handlePrintQuote = async () => {
    const newCurrency = prompt("Enter target currency for MANAGEMENT report:", sheet.target_currency || "USD");
    if (!newCurrency) return;
    const newRate = prompt(`Enter exchange rate for ${newCurrency}:`, sheet.exchange_rate?.toString() || "300");
    if (!newRate) return;

    const updatedSheet = { ...sheet, target_currency: newCurrency, exchange_rate: parseFloat(newRate) || 1 };
    setSheet(updatedSheet);
    const savedId = await saveSheet(false, updatedSheet);
    if (savedId) window.open(`/admin/shipping/costing/print/${savedId}`, '_blank');
  };

  const handlePrintCustomer = async () => {
    const newCurrency = prompt("Enter target currency for CUSTOMER quote:", sheet.target_currency || "USD");
    if (!newCurrency) return;
    const newRate = prompt(`Enter exchange rate for ${newCurrency}:`, sheet.exchange_rate?.toString() || "300");
    if (!newRate) return;

    const updatedSheet = { ...sheet, target_currency: newCurrency, exchange_rate: parseFloat(newRate) || 1 };
    setSheet(updatedSheet);
    const savedId = await saveSheet(false, updatedSheet);
    if (savedId) window.open(`/admin/shipping/costing/print-customer/${savedId}`, '_blank');
  };

  const handleUpdatePackaging = async () => {
    if (!editingPackaging || !editingPackaging.name) return;
    try {
      setSubmitting(true);
      const cbm = (Number(editingPackaging.length_cm) * Number(editingPackaging.width_cm) * Number(editingPackaging.height_cm)) / 1000000;
      await updatePackagingType(editingPackaging.id, { ...editingPackaging, cbm });
      toast({ title: "Success", description: "Packaging type updated." });
      setIsEditPackagingDialogOpen(false);
      
      const res = await fetchPackagingTypes();
      setPackagingTypes(res.data || []);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddPallet = async () => {
    if (!newPallet.name) return;
    try {
      setSubmitting(true);
      await createPalletType(newPallet);
      toast({ title: "Success", description: "Pallet type created." });
      setIsPalletDialogOpen(false);
      setNewPallet({ name: "", length_cm: 0, width_cm: 0, max_load_height_cm: 0, tare_weight_kg: 0, max_weight_capacity_kg: 0 });
      
      const res = await fetchPalletTypes();
      setPalletTypes(res.data || []);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePallet = async (id: number) => {
    if (!confirm("Are you sure you want to delete this pallet type?")) return;
    try {
      setSubmitting(true);
      await deletePalletType(id);
      toast({ title: "Success", description: "Pallet type deleted." });
      
      const res = await fetchPalletTypes();
      setPalletTypes(res.data || []);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPallet = (p: PalletType) => {
    setEditingPallet(p);
    setIsEditPalletDialogOpen(true);
  };

  const handleUpdatePallet = async () => {
    if (!editingPallet || !editingPallet.name) return;
    try {
      setSubmitting(true);
      await updatePalletType(editingPallet.id, editingPallet);
      toast({ title: "Success", description: "Pallet type updated." });
      setIsEditPalletDialogOpen(false);
      
      const res = await fetchPalletTypes();
      setPalletTypes(res.data || []);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDuplicate = async () => {
    if (!sheet.id) return;
    if (!confirm("Are you sure you want to create a duplicate of this costing sheet?")) return;
    try {
      setSubmitting(true);
      const res = await duplicateCostingSheet(sheet.id);
      if (res.status === 'success' && (res.id || res.data?.id)) {
        const newId = res.id || res.data?.id;
        toast({ title: "Success", description: "Costing sheet duplicated." });
        router.push(`/admin/shipping/costing?id=${newId}`);
      } else {
        throw new Error(res.message || res.error || "Failed to duplicate");
      }
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportExcel = () => {
    try {
      const rows = [];
      
      // Header Info
      rows.push(["EXPORT ORDER COSTING SHEET"]);
      rows.push(["Quote Number", sheet.costing_number || "AUTO-GEN"]);
      rows.push(["Reference", sheet.reference_number || ""]);
      rows.push(["Customer", customers.find(c => c.id.toString() === sheet.customer_id)?.name || ""]);
      rows.push(["Shipping Term", sheet.shipping_term]);
      rows.push(["Freight Type", sheet.freight_type]);
      rows.push(["Date Exported", new Date().toLocaleString()]);
      rows.push([]);

      // Items Header
      rows.push(["PART NAME", "QUANTITY", "UNIT COST", "LANDED PRICE", "LINE TOTAL"]);
      
      // Items Data
      sheet.items.forEach(item => {
        const part = availableParts.find(p => p.id.toString() === item.part_id);
        const landed = calculateItemLandedPrice(item);
        rows.push([
          part ? (part as any).part_name || part.name : "Unknown",
          item.quantity,
          item.unit_cost,
          landed.total,
          landed.total * item.quantity
        ]);
      });
      rows.push([]);

      // Logistics Header
      rows.push(["LOGISTICS & CUSTOMS CHARGES"]);
      rows.push(["CHARGE NAME", "METHOD", "AMOUNT"]);
      
      // Logistics Data
      sheet.manual_costs.forEach(mc => {
        rows.push([
          mc.name,
          mc.absorption_method,
          mc.amount
        ]);
      });
      rows.push([]);

      // Totals
      const totalBase = sheet.items.reduce((sum, item) => sum + (Number(item.line_total) || 0), 0);
      const totalDirect = sheet.items.reduce((sum, item) => sum + ((Number(calculateItemLandedPrice(item).direct) || 0) * (Number(item.quantity) || 1)), 0);
      const totalProfit = sheet.items.reduce((sum, item) => sum + ((Number(calculateItemLandedPrice(item).profit) || 0) * (Number(item.quantity) || 1)), 0);
      const grandTotal = sheet.items.reduce((sum, item) => sum + ((Number(calculateItemLandedPrice(item).total) || 0) * (Number(item.quantity) || 1)), 0);

      rows.push(["SUMMARY"]);
      rows.push(["Total Base Cost", totalBase]);
      rows.push(["Total Direct Logistics", totalDirect]);
      rows.push(["Total Profit", totalProfit]);
      rows.push(["GRAND TOTAL VALUE", grandTotal]);

      // Generate CSV content
      const csvContent = rows.map(r => r.map(cell => {
        const s = cell === null || cell === undefined ? "" : String(cell);
        if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      }).join(",")).join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `costing-sheet-${sheet.costing_number || "draft"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({ title: "Success", description: "Exported to CSV (Excel compatible)." });
    } catch (err) {
      toast({ title: "Error", description: "Failed to export: " + (err as Error).message, variant: "destructive" });
    }
  };

  if (loading) return <DashboardLayout><div className="p-20 flex justify-center"><Loader2 className="animate-spin w-10 h-10 text-primary" /></div></DashboardLayout>;

  return (
    <DashboardLayout title="Export Order Costing" fullWidth={true}>
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/accounts/costing-sheet">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ChevronLeft className="w-6 h-6" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Export Order Costing</h1>
              <p className="text-muted-foreground text-xs uppercase font-black tracking-widest opacity-70">Complete Landing & Export Price Analysis</p>
            </div>
          </div>
          <div className="flex gap-3">
              <Button 
                 variant="outline"
                 className="h-11 px-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 font-black shadow-sm hover:bg-indigo-50" 
                 onClick={handleDuplicate} 
                 disabled={submitting || !sheet.id}
                 title="Duplicate this costing sheet"
              >
                 <Copy className="w-5 h-5 mr-2" />
                 Duplicate
              </Button>
              <Button 
                 variant="outline"
                 className="h-11 px-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-black shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700" 
                 onClick={handleExportExcel} 
                 disabled={submitting}
                 title="Export to Excel / CSV"
              >
                 <Download className="w-5 h-5 mr-2" />
                 Export Excel
              </Button>
              <Button 
                 variant="outline"
                 className="h-11 px-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 font-black shadow-sm hover:bg-indigo-50" 
                 onClick={handlePrintCustomer} 
                 disabled={submitting}
              >
                 <Globe className="w-5 h-5 mr-2" />
                 Customer Quote
              </Button>
              <Button 
                 variant="outline"
                 className="h-11 px-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-black shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700" 
                 onClick={handlePrintQuote} 
                 disabled={submitting}
              >
                 <ShieldCheck className="w-5 h-5 mr-2" />
                 Print Report
              </Button>
             <Button className="h-11 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-100" onClick={handleSave} disabled={submitting}>
                {submitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                Save Costing
             </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8 space-y-6">
            <Card className="border-none shadow-xl overflow-hidden bg-white dark:bg-slate-900">
              <CardHeader className="bg-slate-50 dark:bg-slate-800/50 pb-4">
                <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-white"><User className="w-5 h-5 text-indigo-600" /> Inquiry Details</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-[10px] uppercase font-black opacity-50 text-slate-900 dark:text-slate-400">Customer / Buyer</Label>
                  <SearchableSelect 
                    value={sheet.customer_id} 
                    onValueChange={(v) => setSheet({...sheet, customer_id: v})}
                    options={customers.map(c => ({ value: c.id.toString(), label: c.name }))}
                    placeholder="Select Buyer"
                    triggerClassName="h-12 border-none bg-slate-100 dark:bg-slate-800 font-bold dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black opacity-50 text-slate-900 dark:text-slate-400">Quote Number</Label>
                  <div className="h-12 flex items-center px-4 bg-slate-200 dark:bg-slate-700/50 rounded-md font-black text-indigo-600 dark:text-indigo-400">
                    {sheet.costing_number || 'AUTO-GEN'}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black opacity-50 text-slate-900 dark:text-slate-400">Inquiry / Export Ref</Label>
                  <Input value={sheet.reference_number} onChange={(e) => setSheet({...sheet, reference_number: e.target.value})} className="h-12 border-none bg-slate-100 dark:bg-slate-800 font-bold dark:text-white" placeholder="e.g. REF-2024-001" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black opacity-50 text-slate-900 dark:text-slate-400">Status</Label>
                  <Select value={sheet.status} onValueChange={(v) => setSheet({...sheet, status: v})}>
                     <SelectTrigger className={`h-12 border-none font-black text-white ${sheet.status === 'Finalized' ? 'bg-indigo-600' : sheet.status === 'Approved' ? 'bg-emerald-600' : sheet.status === 'Cancelled' ? 'bg-red-600' : 'bg-amber-600'}`}>
                        <SelectValue placeholder="Status" />
                     </SelectTrigger>
                     <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                        <SelectItem value="Draft" className="font-bold">Draft</SelectItem>
                        <SelectItem value="Finalized" className="font-bold">Finalized</SelectItem>
                        <SelectItem value="Approved" className="font-bold text-emerald-600">Approved</SelectItem>
                        <SelectItem value="Cancelled" className="font-bold text-red-600">Cancelled</SelectItem>
                     </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black opacity-50 text-slate-900 dark:text-slate-400">Shipping Term</Label>
                  <Select value={sheet.shipping_term} onValueChange={handleTermChange}>
                     <SelectTrigger className="h-12 border-none bg-slate-100 dark:bg-slate-800 font-bold dark:text-white"><SelectValue placeholder="Term" /></SelectTrigger>
                     <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                        {Object.keys(INCOTERM_DESCRIPTIONS).map(term => <SelectItem key={term} value={term} className="text-slate-900 dark:text-slate-100 font-bold cursor-pointer">{term}</SelectItem>)}
                     </SelectContent>
                  </Select>
                </div>
                 <div className="space-y-3 lg:col-span-3">
                   <Label className="text-[10px] uppercase font-black opacity-50 text-slate-900 dark:text-slate-400">Freight Type</Label>
                   <div className="flex flex-wrap gap-2">
                      {FREIGHT_TYPES.map(type => {
                         const Icon = type === 'Sea Freight' ? Ship : 
                                    type === 'Air Freight' ? Plane : 
                                    type === 'Courier' ? Package : Truck;
                         return (
                            <div 
                              key={type} 
                              className={`flex items-center space-x-3 p-2.5 px-4 rounded-xl border transition-all cursor-pointer ${sheet.freight_type === type ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'}`}
                              onClick={() => setSheet({...sheet, freight_type: type})}
                            >
                               <div className={`p-1.5 rounded-lg ${sheet.freight_type === type ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                  <Icon className={`w-4 h-4 ${sheet.freight_type === type ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                               </div>
                               <Label className="font-bold cursor-pointer text-[11px] whitespace-nowrap leading-none">{type}</Label>
                            </div>
                         );
                      })}
                   </div>
                 </div>

                 <div className="space-y-3 lg:col-span-4 border-t border-slate-100 dark:border-slate-800 pt-6 mt-2">
                   <Label className="text-[10px] uppercase font-black opacity-50 text-slate-900 dark:text-slate-400">Shipment Mode</Label>
                   <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'FCL', label: 'FCL', icon: Package },
                        { value: 'LCL', label: 'LCL', icon: Box },
                        { value: 'Air Freight', label: 'Air', icon: Plane },
                        { value: 'Courier', label: 'Courier', icon: Zap },
                        { value: 'FTL', label: 'FTL', icon: Truck },
                        { value: 'LTL', label: 'LTL', icon: Container },
                        { value: 'Break Bulk', label: 'Break Bulk', icon: Anchor },
                      ].map(mode => {
                         const Icon = mode.icon;
                         return (
                            <div 
                              key={mode.value} 
                              className={`flex items-center space-x-2.5 p-2 px-3 rounded-xl border transition-all cursor-pointer ${sheet.shipment_mode === mode.value ? 'bg-amber-600 border-amber-600 text-white shadow-lg shadow-amber-900/20' : 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'}`}
                              onClick={() => setSheet({...sheet, shipment_mode: mode.value})}
                            >
                               <div className={`p-1.5 rounded-lg ${sheet.shipment_mode === mode.value ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                  <Icon className={`w-3.5 h-3.5 ${sheet.shipment_mode === mode.value ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                               </div>
                               <Label className="font-bold cursor-pointer text-[10px] whitespace-nowrap leading-none">{mode.label}</Label>
                            </div>
                         );
                      })}
                   </div>
                 </div>
                 <div className="hidden">
                 <Select value={sheet.shipment_mode} onValueChange={(v) => setSheet({...sheet, shipment_mode: v})}>
                    <SelectTrigger className="h-12 border-none bg-slate-100 dark:bg-slate-800 font-bold dark:text-white"><SelectValue placeholder="Select Mode" /></SelectTrigger>
                    <SelectContent className="dark:bg-slate-900 border-none shadow-2xl">
                       <SelectItem value="FCL">FCL (Full Container)</SelectItem>
                       <SelectItem value="LCL">LCL (Shared Container)</SelectItem>
                       <SelectItem value="Air Freight">Air Freight (General)</SelectItem>
                       <SelectItem value="Courier">Courier (Express)</SelectItem>
                       <SelectItem value="FTL">FTL (Full Truck)</SelectItem>
                       <SelectItem value="LTL">LTL (Shared Truck)</SelectItem>
                       <SelectItem value="Break Bulk">Break Bulk</SelectItem>
                    </SelectContent>
                 </Select>
                 </div>
                 
                 <div className="space-y-2 lg:col-span-4">
                   <Label className="text-[10px] uppercase font-black opacity-50 text-indigo-600 dark:text-indigo-400">Term Meaning & Responsibilities</Label>
                   <div className="h-12 flex items-center px-4 rounded-md bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-sm font-medium border border-indigo-100 dark:border-indigo-800/30">
                      {INCOTERM_DESCRIPTIONS[sheet.shipping_term]}
                   </div>
                 </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl overflow-hidden bg-white dark:bg-slate-900">
              <CardHeader className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-row justify-between items-center py-5">
                <CardTitle className="text-lg flex items-center gap-2"><Package className="w-5 h-5 text-indigo-400" /> Export Items</CardTitle>
                <Button variant="outline" size="sm" className="bg-white/10 border-white/20 hover:bg-white/20 text-white font-bold" onClick={addItem}><Plus className="w-4 h-4 mr-2" /> Add Item</Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800 border-none">
                      <TableHead className="text-xs font-black uppercase pl-6 py-5 dark:text-slate-400">Product & Quantity</TableHead>
                      <TableHead className="text-xs font-black uppercase text-right w-40 dark:text-slate-400">Unit Cost</TableHead>
                      <TableHead className="text-xs font-black uppercase text-right pr-6 w-40 dark:text-slate-400">Line Total</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sheet.items.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="py-10 text-center text-slate-400 italic dark:text-slate-500">No items added to this export inquiry.</TableCell></TableRow>
                    ) : sheet.items.map((item, idx) => (
                      <React.Fragment key={idx}>
                        <TableRow className="border-none hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                          <TableCell className="pl-6 py-4">
                            <div className="flex gap-4 items-start">
                              <div className="flex-1">
                                <SearchableSelect 
                                  value={item.part_id} 
                                  onValueChange={(v) => updateItem(idx, 'part_id', v)}
                                  options={availableParts.map(p => ({ value: p.id.toString(), label: (p as any).part_name || p.name }))}
                                  placeholder="Select Product"
                                  triggerClassName="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold dark:text-white h-10 shadow-sm"
                                />
                              </div>
                              <div className="w-32 flex flex-col items-center">
                                <Input type="number" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} className="h-10 text-center border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold dark:text-white shadow-sm focus:ring-2 focus:ring-indigo-500/20" />
                                <span className="text-[10px] uppercase font-black opacity-40 mt-1">{item.unit || "Units"}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                             <div className="flex flex-col items-end gap-1">
                                <div className="flex items-center gap-1">
                                   <Button 
                                     variant="outline" 
                                     size="icon" 
                                     className="h-7 w-7 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                                     onClick={() => openBomModal(idx)}
                                     title="Manage BOM / Materials"
                                   >
                                      <Box className="w-3.5 h-3.5" />
                                   </Button>
                                   <Input type="number" value={item.unit_cost} onChange={(e) => updateItem(idx, 'unit_cost', parseFloat(e.target.value) || 0)} className="h-10 w-32 text-right border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold dark:text-white shadow-sm" />
                                </div>
                                <span className="text-[10px] uppercase font-black opacity-40">Base Cost</span>
                             </div>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                             <div className="font-black text-slate-900 dark:text-white text-lg">LKR {(Number(item.line_total) || 0).toLocaleString()}</div>
                             <span className="text-[10px] uppercase font-black opacity-40">Subtotal</span>
                          </TableCell>
                          <TableCell className="pr-4"><Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></Button></TableCell>
                        </TableRow>
                        <TableRow className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                          <TableCell colSpan={4} className="py-3 pl-6 pr-6">
                            <div className="flex flex-col gap-4">
                              {/* Inputs Row */}
                              <div className="flex items-center justify-between w-full gap-x-4">
                                <div className="flex flex-col gap-1 flex-[2]">
                                  <span className="text-[10px] uppercase font-black opacity-40">Packaging</span>
                                  <Select value={item.packaging_type_id} onValueChange={(v) => updateItem(idx, 'packaging_type_id', v)}>
                                    <SelectTrigger className="h-9 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold w-full shadow-sm"><SelectValue placeholder="Packing" /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">None</SelectItem>
                                      {packagingTypes.map(pt => <SelectItem key={pt.id} value={pt.id.toString()}>{pt.name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="flex flex-col gap-1 flex-[3]">
                                  <span className="text-[10px] uppercase font-black opacity-40 text-center">Dimensions (L*W*H) cm</span>
                                  <div className="flex items-center gap-1.5 w-full">
                                    <Input type="number" value={item.carton_length || 0} onChange={(e) => updateItem(idx, 'carton_length', parseFloat(e.target.value) || 0)} className="h-9 w-full flex-1 text-center p-0 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold dark:text-white shadow-sm" />
                                    <span className="text-[10px] opacity-30">×</span>
                                    <Input type="number" value={item.carton_width || 0} onChange={(e) => updateItem(idx, 'carton_width', parseFloat(e.target.value) || 0)} className="h-9 w-full flex-1 text-center p-0 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold dark:text-white shadow-sm" />
                                    <span className="text-[10px] opacity-30">×</span>
                                    <Input type="number" value={item.carton_height || 0} onChange={(e) => updateItem(idx, 'carton_height', parseFloat(e.target.value) || 0)} className="h-9 w-full flex-1 text-center p-0 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold dark:text-white shadow-sm" />
                                  </div>
                                </div>

                                <div className="flex flex-col gap-1 flex-1">
                                  <span className="text-[10px] uppercase font-black opacity-40">{(item.unit || 'Units').toUpperCase()}/PKG</span>
                                  <Input type="number" value={item.units_per_carton || 0} onChange={(e) => updateItem(idx, 'units_per_carton', parseFloat(e.target.value) || 0)} className="h-9 w-full text-center border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold dark:text-white shadow-sm" />
                                </div>

                                <div className="flex flex-col gap-1 flex-1">
                                  <span className="text-[10px] uppercase font-black opacity-40">Unit Wt (kg)</span>
                                  <Input type="number" value={item.weight || 0} onChange={(e) => updateItem(idx, 'weight', parseFloat(e.target.value) || 0)} className="h-9 w-full text-center border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold dark:text-white shadow-sm" />
                                </div>

                                <div className="flex flex-col gap-1 flex-1">
                                  <span className="text-[10px] uppercase font-black opacity-40">Unit Vol (cbm)</span>
                                  <Input type="number" value={item.cbm || 0} onChange={(e) => updateItem(idx, 'cbm', parseFloat(e.target.value) || 0)} className="h-9 w-full text-center border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold dark:text-white shadow-sm" />
                                </div>

                              </div>
                              <div className="flex items-center gap-4 pt-2 mt-2 border-t border-slate-100 dark:border-slate-800/50">
                                 <div className="flex items-center gap-2 shrink-0">
                                   <div className="flex flex-col gap-1">
                                     <span className="text-[9px] uppercase font-black opacity-40">Margin %</span>
                                     <Input 
                                       type="number" 
                                       placeholder={`${sheet.profit_margin_percent}%`} 
                                       value={item.profit_margin && Number(item.profit_margin) > 0 ? item.profit_margin : sheet.profit_margin_percent} 
                                       onChange={(e) => updateItem(idx, 'profit_margin', parseFloat(e.target.value) || 0)} 
                                       className={`h-9 w-20 text-center border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/20 font-black shadow-sm ${item.profit_margin && Number(item.profit_margin) > 0 ? 'text-amber-600' : 'text-slate-400 opacity-70'}`} 
                                     />
                                   </div>
                                   <div className="flex flex-col gap-1">
                                     <span className="text-[9px] uppercase font-black opacity-40">Method</span>
                                     <Select 
                                       value={item.profit_method || sheet.profit_method} 
                                       onValueChange={(v) => updateItem(idx, 'profit_method', v)}
                                     >
                                       <SelectTrigger className={`h-9 w-24 border-amber-200/50 dark:border-amber-900/30 bg-white/50 dark:bg-amber-950/10 text-[9px] font-black uppercase ${item.profit_method ? 'text-amber-600' : 'text-slate-400 opacity-70'}`}>
                                          <SelectValue />
                                       </SelectTrigger>
                                       <SelectContent>
                                         <SelectItem value="Markup">Markup</SelectItem>
                                         <SelectItem value="Margin">Margin</SelectItem>
                                         <SelectItem value="Fixed">Fixed</SelectItem>
                                       </SelectContent>
                                     </Select>
                                   </div>
                                   <div className="flex flex-col gap-1">
                                     <span className="text-[9px] uppercase font-black opacity-40">Profit Base</span>
                                     <div className="flex bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-md items-center h-9 border border-amber-200/50 dark:border-amber-900/30">
                                       <button 
                                         onClick={() => updateItem(idx, 'profit_base', 'Landed')}
                                         className={`px-2 h-full text-[9px] font-black uppercase rounded transition-all ${
                                           (item.profit_base || sheet.profit_base || 'Landed') === 'Landed' 
                                             ? 'bg-white dark:bg-slate-700 shadow-sm text-amber-600' 
                                             : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                         }`}
                                       >
                                         Landed
                                       </button>
                                       <button 
                                         onClick={() => updateItem(idx, 'profit_base', 'Base')}
                                         className={`px-2 h-full text-[9px] font-black uppercase rounded transition-all ${
                                           (item.profit_base || sheet.profit_base || 'Landed') === 'Base' 
                                             ? 'bg-white dark:bg-slate-700 shadow-sm text-amber-600' 
                                             : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                         }`}
                                       >
                                         Base
                                       </button>
                                     </div>
                                   </div>
                                 </div>

                                 <div className="flex items-center justify-between bg-white dark:bg-slate-900/40 p-2 px-3 rounded-lg border border-slate-200 dark:border-slate-800/50 flex-grow overflow-x-auto">
                                   <div className="flex items-center gap-6 min-w-max">
                                     <div className="flex flex-col">
                                       <span className="text-[8px] uppercase font-black text-slate-500">Base Cost</span>
                                       <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">LKR {item.unit_cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                       <span className="text-[8px] text-slate-400 mt-0.5">Total: LKR {(item.unit_cost * (item.quantity || 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                     </div>
                                     <div className="flex flex-col">
                                       <span className="text-[8px] uppercase font-black text-indigo-500">Direct Logistics</span>
                                       <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                                         LKR {calculateItemLandedPrice(item).direct.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                       </span>
                                       <span className="text-[8px] text-indigo-400/70 mt-0.5">Total: LKR {(calculateItemLandedPrice(item).direct * (item.quantity || 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                     </div>
                                     <div className="flex flex-col">
                                       <span className="text-[8px] uppercase font-black text-slate-500">Other Absorb</span>
                                       <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">LKR {calculateItemLandedPrice(item).other.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                       <span className="text-[8px] text-slate-400 mt-0.5">Total: LKR {(calculateItemLandedPrice(item).other * (item.quantity || 0)).toLocaleString(undefined, { maximumFractionDigits: 3 })}</span>
                                     </div>
                                     <div className="flex flex-col">
                                       <span className="text-[8px] uppercase font-black text-amber-600">
                                         {calculateItemLandedPrice(item).method === 'Fixed' ? 'Fixed Profit' : 
                                          calculateItemLandedPrice(item).method === 'Margin' ? 'Profit Margin' : 'Profit Markup'}
                                         <span className="text-[7px] opacity-50 ml-1 lowercase">on {sheet.profit_base === 'Base' ? 'base' : 'landed'}</span>
                                       </span>
                                       <span className="text-[11px] font-bold text-amber-600">
                                         LKR {calculateItemLandedPrice(item).profit.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                         {calculateItemLandedPrice(item).isOverride && <span className="text-[7px] ml-1 opacity-60">(Override)</span>}
                                       </span>
                                       <span className="text-[8px] text-amber-600/70 mt-0.5">Total: LKR {(calculateItemLandedPrice(item).profit * (item.quantity || 0)).toLocaleString(undefined, { maximumFractionDigits: 3 })}</span>
                                     </div>
                                   </div>

                                   <div className="flex flex-col items-end pl-4 ml-4 border-l border-slate-200 dark:border-slate-800 justify-center">
                                     <span className="text-[8px] uppercase font-black text-indigo-500 tracking-widest">Final Landed Price</span>
                                     <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 leading-none mt-0.5 mb-1">
                                       LKR {(Number(calculateItemLandedPrice(item).total) || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                                     </span>
                                     <span className="text-[9px] font-bold text-indigo-500/70">Total: LKR {( (Number(calculateItemLandedPrice(item).total) || 0) * (Number(item.quantity) || 0)).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
                                   </div>
                                 </div>
                              </div>
                            </div>
                            {item.bom_materials && item.bom_materials.length > 0 && (
                              <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                                <div className="flex items-center justify-between mb-3">
                                   <h4 className="text-[10px] uppercase font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                                     <Calculator className="w-3 h-3" /> Production Materials (BOM)
                                   </h4>
                                   <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Recipe Type: {item.recipe_type || 'Custom'}</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                   {item.bom_materials.map((m: any, midx: number) => (
                                     <div key={midx} className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 shadow-sm">
                                        <div className="flex flex-col min-w-0">
                                           <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">{m.part_name}</span>
                                           <span className="text-[8px] text-slate-400 font-medium uppercase tracking-tight">{m.sku || 'N/A'}</span>
                                        </div>
                                        <div className="text-right ml-2 shrink-0">
                                           <div className="text-[10px] font-black text-slate-900 dark:text-slate-200">{m.qty} {m.unit || 'Units'}</div>
                                           <div className="text-[8px] text-slate-400">LKR {(m.qty * (m.current_cost || 0)).toLocaleString()}</div>
                                        </div>
                                     </div>
                                   ))}
                                </div>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
                 
                 {/* Grand Total Breakdown Row */}
                 <div className="p-5 px-6 bg-slate-900 text-white flex flex-col md:flex-row justify-between items-center border-t dark:border-slate-700 shadow-inner rounded-b-xl gap-4">
                    <div className="flex items-center gap-6 overflow-x-auto min-w-max pb-2 md:pb-0 hide-scrollbar">
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase font-black text-slate-400">Total Base Cost</span>
                        <span className="text-sm font-bold text-slate-200">LKR {sheet.items.reduce((sum, item) => sum + (Number(item.line_total) || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 3 })}</span>
                      </div>
                      <div className="h-8 w-px bg-slate-700/50 hidden md:block"></div>
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase font-black text-indigo-400">Total Direct Log.</span>
                        <span className="text-sm font-bold text-indigo-300">LKR {sheet.items.reduce((sum, item) => sum + ((Number(calculateItemLandedPrice(item).direct) || 0) * (Number(item.quantity) || 1)), 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
                      </div>
                      <div className="h-8 w-px bg-slate-700/50 hidden md:block"></div>
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase font-black text-slate-400">Total Other Absorb</span>
                        <span className="text-sm font-bold text-slate-300">LKR {sheet.items.reduce((sum, item) => sum + ((Number(calculateItemLandedPrice(item).other) || 0) * (Number(item.quantity) || 1)), 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
                      </div>
                      <div className="h-8 w-px bg-slate-700/50 hidden md:block"></div>
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase font-black text-amber-500">Total Profit</span>
                        <span className="text-sm font-bold text-amber-400">LKR {sheet.items.reduce((sum, item) => sum + ((Number(calculateItemLandedPrice(item).profit) || 0) * (Number(item.quantity) || 1)), 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end md:ml-auto pl-6 border-l border-slate-700/50 min-w-max">
                      <span className="text-[10px] uppercase font-black text-indigo-400 tracking-widest">Total Landed Value</span>
                      <span className="text-2xl font-black text-white">LKR {sheet.items.reduce((sum, item) => sum + ((Number(calculateItemLandedPrice(item).total) || 0) * (Number(item.quantity) || 1)), 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
                    </div>
                 </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl bg-indigo-50 dark:bg-slate-900 overflow-hidden">
              <CardHeader className="bg-indigo-100 dark:bg-slate-800/50 flex flex-row justify-between items-center">
                <CardTitle className="text-lg flex items-center gap-2 dark:text-white"><Package className="w-5 h-5 text-indigo-600" /> Load Planning & Palletization</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-4">
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
                       <div className="flex items-center justify-between">
                          <Label className="font-bold text-slate-900 dark:text-white">Global Packaging Override</Label>
                          <Select value={loadPlan.manual_packing_override ? 'yes' : 'no'} onValueChange={(v) => setLoadPlan({...loadPlan, manual_packing_override: v === 'yes'})}>
                             <SelectTrigger className="w-24 h-8 text-xs bg-slate-50 dark:bg-slate-900 font-bold border-slate-200 dark:border-slate-700"><SelectValue/></SelectTrigger>
                             <SelectContent>
                                <SelectItem value="no">No</SelectItem>
                                <SelectItem value="yes">Yes</SelectItem>
                             </SelectContent>
                          </Select>
                       </div>
                       
                       {loadPlan.manual_packing_override && (
                          <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                             <div className="flex-1 space-y-1.5">
                                <Label className="text-[10px] uppercase font-black opacity-60">Master Carton</Label>
                                <Select value={loadPlan.manual_packaging_type_id} onValueChange={(v) => setLoadPlan({...loadPlan, manual_packaging_type_id: v})}>
                                   <SelectTrigger className="h-9 text-xs font-bold border-slate-200 dark:border-slate-700"><SelectValue placeholder="Select Packing" /></SelectTrigger>
                                   <SelectContent>
                                      <SelectItem value="none">Custom / None</SelectItem>
                                      {packagingTypes.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                                   </SelectContent>
                                </Select>
                             </div>
                             <div className="w-20 space-y-1.5">
                                <Label className="text-[10px] uppercase font-black opacity-60">Count</Label>
                                <Input type="number" value={loadPlan.manual_cartons_count} onChange={(e) => setLoadPlan({...loadPlan, manual_cartons_count: parseInt(e.target.value) || 0})} className="h-9 text-center font-bold border-slate-200 dark:border-slate-700" />
                             </div>
                          </div>
                       )}
                    </div>

                    <div className="flex items-center justify-between px-1">
                       <Label className="font-bold">Palletize Cargo?</Label>
                       <Select value={loadPlan.palletize ? 'yes' : 'no'} onValueChange={(v) => setLoadPlan({...loadPlan, palletize: v === 'yes'})}>
                          <SelectTrigger className="w-24 h-8 text-xs border-none bg-white dark:bg-slate-800 font-bold dark:text-white"><SelectValue/></SelectTrigger>
                          <SelectContent>
                             <SelectItem value="no">No</SelectItem>
                             <SelectItem value="yes">Yes</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                    {loadPlan.palletize && (
                       <div className="space-y-2 px-1">
                          <Label className="text-[10px] uppercase font-black opacity-50 text-slate-900 dark:text-slate-400">Pallet Type</Label>
                          <Select value={loadPlan.pallet_type_id} onValueChange={(v) => setLoadPlan({...loadPlan, pallet_type_id: v})}>
                             <SelectTrigger className="h-10 border-none bg-white dark:bg-slate-800 font-bold dark:text-white w-full"><SelectValue placeholder="Select Pallet" /></SelectTrigger>
                             <SelectContent>
                                {palletTypes.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                             </SelectContent>
                          </Select>
                       </div>
                    )}
                 </div>
                 
                 <div className="bg-white dark:bg-slate-800 rounded-xl p-4 space-y-3 shadow-sm border border-indigo-100 dark:border-slate-700">
                    <h4 className="text-xs uppercase font-black text-indigo-600 tracking-widest border-b border-indigo-100 dark:border-slate-700 pb-2 mb-2">Load Summary</h4>
                    <div className="flex justify-between text-sm"><span className="opacity-70 font-bold">Total Net Weight</span><span className="font-black">{loadData.netWeight.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg</span></div>
                     
                     <div className="space-y-1 py-1 border-y border-dashed border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between text-[10px] opacity-60 italic"><span>Packaging Tare</span><span>+ {loadData.packagingTare.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg</span></div>
                        <div className="flex justify-between text-[10px] opacity-60 italic"><span>Pallet Tare</span><span>+ {loadData.palletTare.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg</span></div>
                     </div>
                    <div className="flex justify-between text-sm"><span className="opacity-70 font-bold">Total Gross Weight</span><span className="font-black text-indigo-600 dark:text-indigo-400">{loadData.grossWeight.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg</span></div>
                    <div className="flex justify-between text-sm"><span className="opacity-70 font-bold">Total Volume (CBM)</span><span className="font-black text-amber-600">{loadData.totalCbm.toLocaleString(undefined, { maximumFractionDigits: 4 })} m³</span></div>
                    <div className="flex justify-between text-sm pt-2 border-t border-dashed border-slate-200 dark:border-slate-700"><span className="opacity-70 font-bold">Total Cartons / Sacks</span><span className="font-black">{loadData.totalCartons.toLocaleString()}</span></div>
                    {loadPlan.palletize && <div className="flex justify-between text-sm text-green-600 dark:text-green-400"><span className="opacity-70 font-bold text-slate-900 dark:text-white">Est. Pallets Required</span><span className="font-black">{loadData.finalPallets.toLocaleString()}</span></div>}
                    
                    <div className="pt-2 border-t border-indigo-100 dark:border-slate-700">
                       <h4 className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-2">
                          {sheet.shipment_mode === 'FCL' ? 'Recommended Container' : 
                           sheet.shipment_mode === 'LCL' ? 'Consolidation Status' : 
                           sheet.shipment_mode === 'Air Freight' || sheet.shipment_mode === 'Courier' ? 'Transport Recommendation' : 'Load Recommendation'}
                       </h4>
                       
                       {sheet.shipment_mode === 'LCL' ? (
                          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                             <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase">LCL Shared Load</span>
                                <Package className="w-3.5 h-3.5 text-amber-500" />
                             </div>
                             {containerTypes[0] && (
                                <p className="text-[10px] text-amber-600 dark:text-amber-500 font-medium leading-tight">
                                   Occupies <strong>{((loadData.totalCbm / containerTypes[0].max_cbm_capacity) * 100).toFixed(1)}%</strong> of a standard 20ft (TEU) container.
                                </p>
                             )}
                          </div>
                       ) : sheet.shipment_mode === 'Air Freight' || sheet.shipment_mode === 'Courier' ? (
                          <div className="bg-blue-600 text-white rounded-lg p-3 shadow-lg shadow-blue-900/20">
                             <div className="flex justify-between items-center">
                                <span className="text-sm font-bold uppercase tracking-tight">{sheet.shipment_mode} Shipment</span>
                                <Plane className="w-4 h-4 text-blue-200" />
                             </div>
                             <p className="text-[9px] text-blue-100 mt-1 opacity-80 uppercase font-black tracking-widest">Charged by {loadData.totalCbm * 167 > loadData.grossWeight ? 'Volumetric Weight' : 'Actual Weight'}</p>
                          </div>
                       ) : (
                          <>
                             {containerTypes.filter(c => c.max_cbm_capacity >= loadData.totalCbm && c.max_weight_capacity_kg >= loadData.grossWeight).sort((a, b) => a.max_cbm_capacity - b.max_cbm_capacity)[0] ? (
                                <div className="bg-indigo-600 text-white rounded-lg p-2 px-3 text-sm font-bold flex justify-between items-center shadow-lg shadow-indigo-900/20">
                                   <span>{containerTypes.filter(c => c.max_cbm_capacity >= loadData.totalCbm && c.max_weight_capacity_kg >= loadData.grossWeight).sort((a, b) => a.max_cbm_capacity - b.max_cbm_capacity)[0].name}</span>
                                   <Truck className="w-4 h-4 text-indigo-200" />
                                </div>
                             ) : (
                                <div className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded-lg p-2 text-xs font-bold text-center">
                                   Requires Multiple Containers / Heavy Lift
                                </div>
                             )}
                          </>
                       )}
                    </div>
                 </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl bg-white dark:bg-slate-900">
              <CardHeader className="bg-slate-50 dark:bg-slate-800/50 flex flex-row justify-between items-center">
                <CardTitle className="text-lg flex items-center gap-2 dark:text-white"><Truck className="w-5 h-5 text-indigo-600" /> Logistics & Customs</CardTitle>
                <div className="flex items-center gap-1">
                   {loadingDefaults && <Loader2 className="w-4 h-4 animate-spin text-indigo-600 mr-2" />}
                   <Button variant="ghost" size="sm" onClick={() => setIsManageFactorsOpen(true)} className="h-8 text-slate-500 hover:text-indigo-600">
                      <Edit className="w-3.5 h-3.5 mr-1"/> Manage Items
                   </Button>
                   <Button variant="ghost" size="sm" onClick={() => setIsManagePackagingOpen(true)} className="h-8 text-slate-500 hover:text-indigo-600">
                      <Box className="w-3.5 h-3.5 mr-1"/> Manage Packing
                   </Button>
                   <Button variant="ghost" size="sm" onClick={() => setIsManagePalletsOpen(true)} className="h-8 text-slate-500 hover:text-indigo-600">
                      <Calculator className="w-3.5 h-3.5 mr-1"/> Manage Pallets
                   </Button>
                   <Button variant="ghost" size="sm" onClick={() => setSheet({...sheet, manual_costs: [...sheet.manual_costs, { name: '', amount: 0 }]})} className="h-8 text-indigo-600">
                      <Plus className="w-4 h-4 mr-1"/> Add Cost
                   </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4 relative">
                 {loadingDefaults && (
                    <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-b-xl">
                       <div className="flex flex-col items-center gap-2">
                          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Applying Defaults...</span>
                       </div>
                    </div>
                 )}
                 {sheet.manual_costs.map((mc, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                       <div className="flex-1">
                          <SearchableSelect 
                            value={mc.name}
                            onValueChange={(v) => {
                               const factor = logisticsFactors.find(f => f.name === v);
                               const newCosts = [...sheet.manual_costs];
                               newCosts[idx].name = v;
                               newCosts[idx].absorption_method = factor?.absorption_method || 'Value';
                               setSheet({...sheet, manual_costs: newCosts});
                            }}
                            options={logisticsFactors.map(f => ({ value: f.name, label: `${f.name} (${f.type}) - Absorb: ${f.absorption_method}` }))}
                            placeholder="Select Charge Type"
                            triggerClassName="h-11 border-none bg-slate-100 dark:bg-slate-800 font-bold dark:text-white w-full"
                          />
                       </div>
                       <div className="w-32">
                          <Select value={mc.absorption_method} onValueChange={(v: any) => {
                             const newCosts = [...sheet.manual_costs];
                             newCosts[idx].absorption_method = v;
                             setSheet({...sheet, manual_costs: newCosts});
                          }}>
                            <SelectTrigger className="h-11 border-none bg-slate-100 dark:bg-slate-800 font-bold text-[10px] uppercase text-slate-500">
                              <SelectValue placeholder="Absorb By" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Value">Value</SelectItem>
                              <SelectItem value="Quantity">Quantity</SelectItem>
                              <SelectItem value="Net Weight">Net Weight</SelectItem>
                              <SelectItem value="Gross Weight">Gross Wt</SelectItem>
                              <SelectItem value="Volume">Volume</SelectItem>
                            </SelectContent>
                          </Select>
                       </div>
                       <Input type="number" value={mc.amount} onChange={(e) => {
                          const newCosts = [...sheet.manual_costs];
                          newCosts[idx].amount = parseFloat(e.target.value) || 0;
                          setSheet({...sheet, manual_costs: newCosts});
                       }} className="h-11 border-none bg-slate-100 dark:bg-slate-800 font-bold dark:text-white w-32 text-right" />
                       <Button variant="ghost" size="icon" onClick={() => {
                          const newCosts = [...sheet.manual_costs];
                          newCosts.splice(idx, 1);
                          setSheet({...sheet, manual_costs: newCosts});
                       }} className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                 ))}
                 {sheet.manual_costs.length === 0 && <p className="text-sm text-slate-400 italic">No logistics costs added.</p>}
              </CardContent>
            </Card>
          </div>

          <div className="xl:col-span-4 space-y-6">


             <Card className="border-none shadow-2xl bg-slate-900 text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 blur-3xl -mr-16 -mt-16"></div>
                <CardHeader className="pb-2">
                   <CardTitle className="text-xl font-black flex items-center gap-2 uppercase tracking-tighter"><DollarSign className="w-6 h-6 text-indigo-400" /> Export Pricing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-white/10">
                       <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-black opacity-50 text-slate-400">Target Currency</Label>
                          <Select 
                             value={sheet.target_currency || 'USD'} 
                             onValueChange={(v: any) => setSheet({...sheet, target_currency: v})}
                          >
                             <SelectTrigger className="h-10 border-white/10 bg-white/5 font-bold text-indigo-400">
                                <SelectValue/>
                             </SelectTrigger>
                             <SelectContent className="dark:bg-slate-900 border-none">
                                <SelectItem value="USD">USD ($)</SelectItem>
                                <SelectItem value="EUR">EUR (€)</SelectItem>
                                <SelectItem value="GBP">GBP (£)</SelectItem>
                                <SelectItem value="AUD">AUD (A$)</SelectItem>
                                <SelectItem value="LKR">LKR (Rs)</SelectItem>
                             </SelectContent>
                          </Select>
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-black opacity-50 text-slate-400">Ex. Rate (1 {sheet.target_currency} = ? LKR)</Label>
                          <Input 
                             type="number" 
                             value={sheet.exchange_rate} 
                             onChange={(e) => setSheet({...sheet, exchange_rate: parseFloat(e.target.value) || 1})} 
                             className="h-10 border-white/10 bg-white/5 font-bold text-white" 
                          />
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-black opacity-50 text-slate-400">Profit Method</Label>
                          <Select 
                             value={sheet.profit_method} 
                             onValueChange={(v: any) => setSheet({...sheet, profit_method: v})}
                             disabled={hasOverrides}
                          >
                             <SelectTrigger className={`h-10 border-white/10 bg-white/5 font-bold text-white ${hasOverrides ? 'cursor-not-allowed' : ''}`}>
                                <SelectValue/>
                             </SelectTrigger>
                             <SelectContent className="dark:bg-slate-900 border-none">
                                <SelectItem value="Markup">Markup (%)</SelectItem>
                                <SelectItem value="Margin">Margin (%)</SelectItem>
                                <SelectItem value="Fixed">Fixed Amount</SelectItem>
                             </SelectContent>
                          </Select>
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-black opacity-50 text-slate-400">Profit Base</Label>
                          <Select 
                             value={sheet.profit_base || 'Landed'} 
                             onValueChange={(v: any) => setSheet({...sheet, profit_base: v})}
                             disabled={hasOverrides}
                          >
                             <SelectTrigger className={`h-10 border-white/10 bg-white/5 font-bold text-white ${hasOverrides ? 'cursor-not-allowed' : ''}`}>
                                <SelectValue/>
                             </SelectTrigger>
                             <SelectContent className="dark:bg-slate-900 border-none">
                                <SelectItem value="Landed">Landed Cost (Standard)</SelectItem>
                                <SelectItem value="Base">Base Cost Only</SelectItem>
                             </SelectContent>
                          </Select>
                       </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black opacity-50 text-slate-400">Other Absorb Distribution Method</Label>
                        <Select 
                            value={sheet.overhead_absorption_method || 'Value'} 
                            onValueChange={(v: any) => setSheet({...sheet, overhead_absorption_method: v})}
                        >
                            <SelectTrigger className="h-10 border-white/10 bg-white/5 font-bold text-white">
                                <SelectValue/>
                            </SelectTrigger>
                            <SelectContent className="dark:bg-slate-900 border-none">
                                <SelectItem value="Value">Weighted (By Item Price)</SelectItem>
                                <SelectItem value="Quantity">Common (Equal per Unit)</SelectItem>
                                <SelectItem value="Net Weight">By Net Weight</SelectItem>
                                <SelectItem value="Gross Weight">By Gross Weight</SelectItem>
                                <SelectItem value="Volume">By Volume (CBM)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                       <Label className="text-[10px] uppercase font-black opacity-50 text-slate-400">
                          {hasOverrides ? `Weighted Avg ${sheet.profit_method} (%)` : sheet.profit_method === 'Fixed' ? 'Amount (LKR)' : `Value (${sheet.profit_method} %)`}
                       </Label>
                       <div className="relative">
                          <Input 
                             type="number" 
                             value={hasOverrides ? (profitAbsorptionFactor * 100).toFixed(2) : sheet.profit_margin_percent} 
                             onChange={(e) => setSheet({...sheet, profit_margin_percent: parseFloat(e.target.value) || 0})} 
                             disabled={hasOverrides}
                             className={`h-10 border-white/10 bg-white/5 font-bold text-white pr-8 ${hasOverrides ? 'cursor-not-allowed text-amber-400' : ''}`} 
                          />
                          {hasOverrides && <Lock className="absolute right-2.5 top-2.5 w-4 h-4 text-amber-500/50" />}
                       </div>
                    </div>



                   <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full h-8 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 border border-white/5"
                      onClick={() => {
                        if (confirm("This will clear all individual product margin overrides and revert everything to the global settings. Continue?")) {
                          const resetItems = sheet.items.map(item => ({
                            ...item,
                            profit_margin: 0,
                            profit_method: null
                          }));
                          setSheet({ ...sheet, items: resetItems });
                          toast({ title: "Margins Reset", description: "All item-level overrides have been cleared." });
                        }
                      }}
                    >
                      <RotateCcw className="w-3 h-3 mr-2" /> Reset All to Global
                    </Button>

                   <div className="space-y-3">
                      <div className="flex justify-between text-sm opacity-60"><span>Base Product Cost</span><span>LKR {baseProductCost.toLocaleString()}</span></div>
                      <div className="flex justify-between text-sm opacity-60"><span>Logistics & Levies</span><span>+ LKR {(totalLevies + totalManualCosts).toLocaleString()}</span></div>
                       <div className="flex justify-between text-sm text-indigo-400 font-bold">
                          <span>
                             Total Profit {hasOverrides ? '(Weighted)' : sheet.profit_method === 'Fixed' ? 'Amount' : sheet.profit_method}
                          </span>
                          <span>+ LKR {profitMarginAmount.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
                       </div>
                      
                      <div className="pt-4 border-t border-white/10">
                         <div className="flex items-center justify-between mb-1">
                            <p className="text-[10px] uppercase font-black tracking-widest text-slate-500">Final {sheet.shipping_term} Value</p>
                            <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[8px] font-black uppercase tracking-tighter">Absorbed View</Badge>
                         </div>
                         <p className="text-4xl font-black text-white tracking-tighter">LKR {(Number(grandTotal) || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</p>
                         {sheet.target_currency !== 'LKR' && (
                           <p className="text-xl font-bold text-indigo-300 mt-1">
                              ≈ {sheet.target_currency} {(grandTotal / (sheet.exchange_rate || 1)).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                           </p>
                         )}
                      </div>

                      <div className="p-4 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-900/40">
                         <p className="text-[10px] uppercase font-black tracking-widest text-indigo-200 mb-1">Average Landed / Export Price</p>
                         <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-black">LKR {(Number(pricePerUnit) || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</p>
                            <span className="text-[10px] text-indigo-200 font-bold uppercase tracking-widest">/ Unit</span>
                         </div>
                      </div>
                   </div>

                   <div className="bg-slate-800/50 p-4 rounded-xl space-y-2 border border-white/5">
                      <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2"><Info className="w-3 h-3 text-indigo-400" /> Absorption Logic</h4>
                       
                       <div className="space-y-2">
                          <div className="flex justify-between items-center">
                             <span className="text-[9px] text-slate-400 font-bold uppercase">Overhead Factor</span>
                             <span className="text-xs font-black text-white">{(overheadAbsorptionFactor * 100).toFixed(3)}%</span>
                          </div>
                          <div className="flex justify-between items-center">
                             <span className="text-[9px] text-slate-400 font-bold uppercase">Profit Factor</span>
                             <span className="text-xs font-black text-amber-400">{(profitAbsorptionFactor * 100).toFixed(3)}%</span>
                          </div>
                       </div>

                       <Separator className="bg-white/5" />
                       <p className="text-[9px] text-slate-400 leading-relaxed italic">
                          <strong>Formula:</strong> (Base Cost × {((overheadAbsorptionFactor + profitAbsorptionFactor) * 100).toFixed(2)}%) + Direct Metric Charges.
                          <br /><br />
                          This ensures indirect costs are absorbed based on the relative value of each product.
                       </p>
                    </div>
                   
                   <div className="bg-slate-800/50 p-4 rounded-xl space-y-2">
                      <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2"><Briefcase className="w-3 h-3" /> Costing Meta</h4>
                      <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-white/10">
                        <div className="space-y-2">
                           <Label className="text-[10px] uppercase font-black opacity-50 text-slate-400">Target Currency</Label>
                           <Select 
                              value={sheet.target_currency || 'USD'} 
                              onValueChange={(v: any) => setSheet({...sheet, target_currency: v})}
                           >
                              <SelectTrigger className="h-10 border-white/10 bg-white/5 font-bold text-indigo-400">
                                 <SelectValue/>
                              </SelectTrigger>
                              <SelectContent className="dark:bg-slate-900 border-none">
                                 <SelectItem value="USD">USD ($)</SelectItem>
                                 <SelectItem value="EUR">EUR (€)</SelectItem>
                                 <SelectItem value="GBP">GBP (£)</SelectItem>
                                 <SelectItem value="AUD">AUD (A$)</SelectItem>
                                 <SelectItem value="LKR">LKR (Rs)</SelectItem>
                              </SelectContent>
                           </Select>
                        </div>
                        <div className="space-y-2">
                           <Label className="text-[10px] uppercase font-black opacity-50 text-slate-400">Ex. Rate (1 {sheet.target_currency} = ? LKR)</Label>
                           <Input 
                              type="number" 
                              value={sheet.exchange_rate} 
                              onChange={(e) => setSheet({...sheet, exchange_rate: parseFloat(e.target.value) || 1})} 
                              className="h-10 border-white/10 bg-white/5 font-bold text-white" 
                           />
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                         <div><p className="text-[9px] text-slate-500 font-bold uppercase">Total Quantity</p><p className="font-bold">{totalQuantity} Units/Kg</p></div>
                         <div><p className="text-[9px] text-slate-500 font-bold uppercase">Base Cost Share</p><p className="font-bold">{grandTotal > 0 ? ((baseProductCost / grandTotal) * 100).toFixed(1) : 0}%</p></div>
                      </div>
                   </div>
                </CardContent>
             </Card>
          </div>
        </div>
      </div>

      <Dialog open={isFactorDialogOpen} onOpenChange={setIsFactorDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[450px] dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Logistics Factor</DialogTitle>
            <DialogDescription>Define a new cost factor for logistics or customs.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="factor-name">Factor Name</Label>
              <Input 
                id="factor-name" 
                placeholder="e.g. Documentation Fee" 
                value={newFactor.name}
                onChange={(e) => setNewFactor({...newFactor, name: e.target.value})}
                className="dark:bg-slate-800 dark:border-slate-700"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="factor-type">Category</Label>
              <Select value={newFactor.type} onValueChange={(val) => setNewFactor({...newFactor, type: val})}>
                <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {logisticsCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="factor-method">Absorption Method</Label>
              <Select value={newFactor.absorption_method} onValueChange={(val: any) => setNewFactor({...newFactor, absorption_method: val})}>
                <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Value">Absorb by Value (%)</SelectItem>
                  <SelectItem value="Quantity">Absorb by Quantity (Per Unit)</SelectItem>
                  <SelectItem value="Net Weight">Absorb by Net Weight (kg)</SelectItem>
                  <SelectItem value="Gross Weight">Absorb by Gross Weight (kg)</SelectItem>
                  <SelectItem value="Volume">Absorb by Volume (cbm)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-[10px] uppercase font-black opacity-50">Auto-Apply for Terms</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {Object.keys(INCOTERM_DESCRIPTIONS).map(term => (
                  <Button 
                    key={term} 
                    type="button"
                    variant={newFactor.default_terms?.includes(term) ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-[10px] px-2 font-bold"
                    onClick={() => toggleTermForFactor(term, true)}
                  >
                    {term}
                  </Button>
                ))}
              </div>
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

      <Dialog open={isManageFactorsOpen} onOpenChange={setIsManageFactorsOpen}>
         <DialogContent className="w-[95vw] sm:max-w-2xl dark:bg-slate-900 max-h-[90vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader>
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 pb-0">
                  <div>
                     <DialogTitle className="text-xl font-black">Manage Logistics Factors</DialogTitle>
                     <DialogDescription className="text-xs">Pre-define and manage your standard cost items.</DialogDescription>
                  </div>
                  <div className="flex gap-2">
                     <Button variant="outline" size="sm" onClick={() => setIsManageCategoriesOpen(true)} className="font-bold">
                        Categories
                     </Button>
                     <Button size="sm" onClick={() => setIsFactorDialogOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 font-bold">
                        <Plus className="w-4 h-4 mr-2" /> New Item
                     </Button>
                  </div>
               </div>
            </DialogHeader>
            <div className="p-6 flex-1 overflow-hidden flex flex-col">
               <div className="border dark:border-slate-800 rounded-xl overflow-hidden flex-1 flex flex-col">
                  <div className="overflow-x-auto overflow-y-auto max-h-[400px]">
                  <Table>
                     <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-800 border-none">
                           <TableHead className="text-[10px] font-black uppercase pl-6 py-4">Name</TableHead>
                           <TableHead className="text-[10px] font-black uppercase py-4">Type</TableHead>
                           <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {logisticsFactors.length === 0 ? (
                          <TableRow><TableCell colSpan={3} className="py-10 text-center text-slate-400 italic">No factors defined.</TableCell></TableRow>
                        ) : logisticsFactors.map(f => (
                          <TableRow key={f.id} className="border-slate-100 dark:border-slate-800/50">
                             <TableCell className="pl-6 font-bold py-4">
                                {f.name}
                                {f.default_terms && (
                                   <div className="flex gap-1 mt-1">
                                      {f.default_terms.split(',').map(t => (
                                         <span key={t} className="text-[8px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-black uppercase">{t}</span>
                                      ))}
                                   </div>
                                )}
                             </TableCell>
                             <TableCell>
                                <Badge variant="outline" className="text-[9px] uppercase font-black">{f.type}</Badge>
                             </TableCell>
                             <TableCell className="pr-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                   <Button variant="ghost" size="icon" className="w-8 h-8 text-slate-400 hover:text-indigo-600" onClick={() => handleEditFactor(f)}>
                                      <Edit className="w-3.5 h-3.5" />
                                   </Button>
                                   <Button variant="ghost" size="icon" className="w-8 h-8 text-slate-400 hover:text-red-500" onClick={() => handleDeleteFactor(f.id)}>
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
         </div>
         <DialogFooter className="p-6 pt-2">
            <Button variant="outline" onClick={() => setIsManageFactorsOpen(false)} className="font-bold">Close</Button>
         </DialogFooter>
      </DialogContent>
      </Dialog>

      <Dialog open={isEditFactorDialogOpen} onOpenChange={setIsEditFactorDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[450px] dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Logistics Factor</DialogTitle>
            <DialogDescription>Update global factor definition.</DialogDescription>
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
              <Select value={editingFactor?.type || ""} onValueChange={(val) => setEditingFactor(prev => prev ? {...prev, type: val} : null)}>
                <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {logisticsCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-factor-method">Absorption Method</Label>
              <Select value={editingFactor?.absorption_method || "Value"} onValueChange={(val: any) => setEditingFactor(prev => prev ? {...prev, absorption_method: val} : null)}>
                <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Value">Absorb by Value (%)</SelectItem>
                  <SelectItem value="Quantity">Absorb by Quantity (Per Unit)</SelectItem>
                  <SelectItem value="Net Weight">Absorb by Net Weight (kg)</SelectItem>
                  <SelectItem value="Gross Weight">Absorb by Gross Weight (kg)</SelectItem>
                  <SelectItem value="Volume">Absorb by Volume (cbm)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-[10px] uppercase font-black opacity-50">Auto-Apply for Terms</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {Object.keys(INCOTERM_DESCRIPTIONS).map(term => (
                  <Button 
                    key={term} 
                    type="button"
                    variant={editingFactor?.default_terms_array?.includes(term) ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-[10px] px-2 font-bold"
                    onClick={() => toggleTermForFactor(term, false)}
                  >
                    {term}
                  </Button>
                ))}
              </div>
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

      <Dialog open={isManageCategoriesOpen} onOpenChange={setIsManageCategoriesOpen}>
         <DialogContent className="w-[95vw] sm:max-w-md dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
               <div className="flex items-center justify-between pr-6">
                  <DialogTitle>Manage Categories</DialogTitle>
                  <Button size="sm" onClick={() => setIsCategoryDialogOpen(true)}>
                     <Plus className="w-4 h-4 mr-2" /> Add
                  </Button>
               </div>
            </DialogHeader>
            <div className="py-4">
               <div className="border dark:border-slate-800 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                  <Table>
                     <TableBody>
                        {logisticsCategories.map(cat => (
                           <TableRow key={cat.id} className="border-slate-100 dark:border-slate-800/50">
                              <TableCell className="pl-6 font-bold">{cat.name}</TableCell>
                              <TableCell className="pr-4 text-right">
                                 <Button variant="ghost" size="icon" className="w-8 h-8 text-slate-400 hover:text-red-500" onClick={() => handleDeleteCategory(cat.id)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                 </Button>
                              </TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </div>
            </div>
            <DialogFooter>
               <Button variant="outline" onClick={() => setIsManageCategoriesOpen(false)}>Back</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
         <DialogContent className="w-[95vw] sm:max-w-[400px] dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
               <DialogTitle>Add Category</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
               <div className="grid gap-2">
                  <Label>Category Name</Label>
                  <Input value={newCategory.name} onChange={(e) => setNewCategory({...newCategory, name: e.target.value})} placeholder="e.g. Documentation" />
               </div>
            </div>
            <DialogFooter>
               <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>Cancel</Button>
               <Button onClick={handleAddCategory} disabled={submitting || !newCategory.name}>Save</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
      <Dialog open={isManagePackagingOpen} onOpenChange={setIsManagePackagingOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl dark:bg-slate-900 max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <DialogTitle className="text-xl font-black">Manage Packaging Types</DialogTitle>
                <DialogDescription className="text-xs">Define standard boxes, crates, or bags for export.</DialogDescription>
              </div>
              <Button size="sm" onClick={() => setIsPackagingDialogOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 font-bold">
                <Plus className="w-4 h-4 mr-2" /> New Packaging
              </Button>
            </div>
          </DialogHeader>
          <div className="p-6 flex-1 overflow-hidden flex flex-col">
            <div className="border dark:border-slate-800 rounded-xl overflow-hidden flex-1 flex flex-col">
              <div className="overflow-x-auto overflow-y-auto max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800 border-none">
                      <TableHead className="text-[10px] font-black uppercase pl-6 py-4">Name</TableHead>
                      <TableHead className="text-[10px] font-black uppercase py-4">Dimensions (cm)</TableHead>
                      <TableHead className="text-[10px] font-black uppercase py-4">Tare (kg)</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {packagingTypes.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="py-10 text-center text-slate-400 italic">No packaging types defined.</TableCell></TableRow>
                    ) : packagingTypes.map(pt => (
                      <TableRow key={pt.id} className="border-slate-100 dark:border-slate-800/50">
                        <TableCell className="pl-6 font-bold py-4">
                          <div className="flex flex-col">
                            <span>{pt.name}</span>
                            <span className="text-[9px] text-slate-500 uppercase">{pt.type}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {pt.length_cm} × {pt.width_cm} × {pt.height_cm}
                          <div className="text-[9px] text-slate-400">{(Number(pt.length_cm) * Number(pt.width_cm) * Number(pt.height_cm) / 1000000).toFixed(4)} cbm</div>
                        </TableCell>
                        <TableCell className="text-xs font-bold">{pt.tare_weight_kg} kg</TableCell>
                        <TableCell className="pr-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="w-8 h-8 text-slate-400 hover:text-indigo-600" onClick={() => handleEditPackaging(pt)}>
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="w-8 h-8 text-slate-400 hover:text-red-500" onClick={() => handleDeletePackaging(pt.id)}>
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
          </div>
          <DialogFooter className="p-6 pt-2">
            <Button variant="outline" onClick={() => setIsManagePackagingOpen(false)} className="font-bold">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPackagingDialogOpen} onOpenChange={setIsPackagingDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[450px] dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Packaging Type</DialogTitle>
            <DialogDescription>Create a new reusable packaging option.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={newPackaging.name} onChange={(e) => setNewPackaging({...newPackaging, name: e.target.value})} placeholder="e.g. Standard Export Carton" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={newPackaging.type} onValueChange={(v) => setNewPackaging({...newPackaging, type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Carton">Carton</SelectItem>
                    <SelectItem value="Bag">Bag</SelectItem>
                    <SelectItem value="Drum">Drum</SelectItem>
                    <SelectItem value="Crate">Crate</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Tare Wt (kg)</Label>
                <Input type="number" value={newPackaging.tare_weight_kg} onChange={(e) => setNewPackaging({...newPackaging, tare_weight_kg: parseFloat(e.target.value) || 0})} />
              </div>
            </div>
            <Label className="text-[10px] uppercase font-black opacity-50 mt-2">External Dimensions (cm)</Label>
            <div className="grid grid-cols-3 gap-2">
              <div className="grid gap-2">
                <Label className="text-[9px]">Length</Label>
                <Input type="number" value={newPackaging.length_cm} onChange={(e) => setNewPackaging({...newPackaging, length_cm: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="grid gap-2">
                <Label className="text-[9px]">Width</Label>
                <Input type="number" value={newPackaging.width_cm} onChange={(e) => setNewPackaging({...newPackaging, width_cm: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="grid gap-2">
                <Label className="text-[9px]">Height</Label>
                <Input type="number" value={newPackaging.height_cm} onChange={(e) => setNewPackaging({...newPackaging, height_cm: parseFloat(e.target.value) || 0})} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Max Capacity (kg)</Label>
              <Input type="number" value={newPackaging.max_weight_capacity_kg} onChange={(e) => setNewPackaging({...newPackaging, max_weight_capacity_kg: parseFloat(e.target.value) || 0})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPackagingDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddPackaging} disabled={submitting || !newPackaging.name}>Save Packaging</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditPackagingDialogOpen} onOpenChange={setIsEditPackagingDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[450px] dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Packaging Type</DialogTitle>
            <DialogDescription>Update the specifications for this packaging.</DialogDescription>
          </DialogHeader>
          {editingPackaging && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input value={editingPackaging.name} onChange={(e) => setEditingPackaging({...editingPackaging, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Type</Label>
                  <Select value={editingPackaging.type} onValueChange={(v) => setEditingPackaging({...editingPackaging, type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Carton">Carton</SelectItem>
                      <SelectItem value="Bag">Bag</SelectItem>
                      <SelectItem value="Drum">Drum</SelectItem>
                      <SelectItem value="Crate">Crate</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Tare Wt (kg)</Label>
                  <Input type="number" value={editingPackaging.tare_weight_kg} onChange={(e) => setEditingPackaging({...editingPackaging, tare_weight_kg: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
              <Label className="text-[10px] uppercase font-black opacity-50 mt-2">External Dimensions (cm)</Label>
              <div className="grid grid-cols-3 gap-2">
                <div className="grid gap-2">
                  <Label className="text-[9px]">Length</Label>
                  <Input type="number" value={editingPackaging.length_cm} onChange={(e) => setEditingPackaging({...editingPackaging, length_cm: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="grid gap-2">
                  <Label className="text-[9px]">Width</Label>
                  <Input type="number" value={editingPackaging.width_cm} onChange={(e) => setEditingPackaging({...editingPackaging, width_cm: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="grid gap-2">
                  <Label className="text-[9px]">Height</Label>
                  <Input type="number" value={editingPackaging.height_cm} onChange={(e) => setEditingPackaging({...editingPackaging, height_cm: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Max Capacity (kg)</Label>
                <Input type="number" value={editingPackaging.max_weight_capacity_kg} onChange={(e) => setEditingPackaging({...editingPackaging, max_weight_capacity_kg: parseFloat(e.target.value) || 0})} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditPackagingDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdatePackaging} disabled={submitting || !editingPackaging?.name}>Update Packaging</Button>
          </DialogFooter>
        </DialogContent>
        </Dialog>
        <Dialog open={isManagePalletsOpen} onOpenChange={setIsManagePalletsOpen}>
          <DialogContent className="w-[95vw] sm:max-w-2xl dark:bg-slate-900 max-h-[90vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-6 pb-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <DialogTitle className="text-xl font-black">Manage Pallet Types</DialogTitle>
                  <DialogDescription className="text-xs">Define standard pallet sizes and load capacities.</DialogDescription>
                </div>
                <Button size="sm" onClick={() => setIsPalletDialogOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 font-bold">
                  <Plus className="w-4 h-4 mr-2" /> New Pallet
                </Button>
              </div>
            </DialogHeader>
            <div className="p-6 flex-1 overflow-hidden flex flex-col">
              <div className="border dark:border-slate-800 rounded-xl overflow-hidden flex-1 flex flex-col">
                <div className="overflow-x-auto overflow-y-auto max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-800 border-none">
                        <TableHead className="text-[10px] font-black uppercase pl-6 py-4">Name</TableHead>
                        <TableHead className="text-[10px] font-black uppercase py-4">Dim (cm)</TableHead>
                        <TableHead className="text-[10px] font-black uppercase py-4">Max Ht (cm)</TableHead>
                        <TableHead className="text-[10px] font-black uppercase py-4">Capacity (kg)</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {palletTypes.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="py-10 text-center text-slate-400 italic">No pallet types defined.</TableCell></TableRow>
                      ) : palletTypes.map(p => (
                        <TableRow key={p.id} className="border-slate-100 dark:border-slate-800/50">
                          <TableCell className="pl-6 font-bold py-4">{p.name}</TableCell>
                          <TableCell className="text-xs">{p.length_cm} × {p.width_cm}</TableCell>
                          <TableCell className="text-xs">{p.max_load_height_cm} cm</TableCell>
                          <TableCell className="text-xs font-bold text-indigo-600">{p.max_weight_capacity_kg} kg</TableCell>
                          <TableCell className="pr-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="w-8 h-8 text-slate-400 hover:text-indigo-600" onClick={() => handleEditPallet(p)}>
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="w-8 h-8 text-slate-400 hover:text-red-500" onClick={() => handleDeletePallet(p.id)}>
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
            </div>
            <DialogFooter className="p-6 pt-2">
              <Button variant="outline" onClick={() => setIsManagePalletsOpen(false)} className="font-bold">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isPalletDialogOpen} onOpenChange={setIsPalletDialogOpen}>
          <DialogContent className="w-[95vw] sm:max-w-[450px] dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Pallet Type</DialogTitle>
              <DialogDescription>Create a new pallet specification.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Pallet Name</Label>
                <Input value={newPallet.name} onChange={(e) => setNewPallet({...newPallet, name: e.target.value})} placeholder="e.g. Euro Pallet" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Length (cm)</Label>
                  <Input type="number" value={newPallet.length_cm} onChange={(e) => setNewPallet({...newPallet, length_cm: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="grid gap-2">
                  <Label>Width (cm)</Label>
                  <Input type="number" value={newPallet.width_cm} onChange={(e) => setNewPallet({...newPallet, width_cm: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Max Load Ht (cm)</Label>
                  <Input type="number" value={newPallet.max_load_height_cm} onChange={(e) => setNewPallet({...newPallet, max_load_height_cm: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="grid gap-2">
                  <Label>Tare Wt (kg)</Label>
                  <Input type="number" value={newPallet.tare_weight_kg} onChange={(e) => setNewPallet({...newPallet, tare_weight_kg: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Max Weight Capacity (kg)</Label>
                <Input type="number" value={newPallet.max_weight_capacity_kg} onChange={(e) => setNewPallet({...newPallet, max_weight_capacity_kg: parseFloat(e.target.value) || 0})} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPalletDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddPallet} disabled={submitting || !newPallet.name}>Save Pallet</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditPalletDialogOpen} onOpenChange={setIsEditPalletDialogOpen}>
          <DialogContent className="w-[95vw] sm:max-w-[450px] dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Pallet Type</DialogTitle>
              <DialogDescription>Update pallet specifications.</DialogDescription>
            </DialogHeader>
            {editingPallet && (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Pallet Name</Label>
                  <Input value={editingPallet.name} onChange={(e) => setEditingPallet({...editingPallet, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Length (cm)</Label>
                    <Input type="number" value={editingPallet.length_cm} onChange={(e) => setEditingPallet({...editingPallet, length_cm: parseFloat(e.target.value) || 0})} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Width (cm)</Label>
                    <Input type="number" value={editingPallet.width_cm} onChange={(e) => setEditingPallet({...editingPallet, width_cm: parseFloat(e.target.value) || 0})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Max Load Ht (cm)</Label>
                    <Input type="number" value={editingPallet.max_load_height_cm} onChange={(e) => setEditingPallet({...editingPallet, max_load_height_cm: parseFloat(e.target.value) || 0})} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Tare Wt (kg)</Label>
                    <Input type="number" value={editingPallet.tare_weight_kg} onChange={(e) => setEditingPallet({...editingPallet, tare_weight_kg: parseFloat(e.target.value) || 0})} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Max Weight Capacity (kg)</Label>
                  <Input type="number" value={editingPallet.max_weight_capacity_kg} onChange={(e) => setEditingPallet({...editingPallet, max_weight_capacity_kg: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditPalletDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdatePallet} disabled={submitting || !editingPallet?.name}>Update Pallet</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <ProductionBOMDialog 
          open={bomDialogOpen} 
          onOpenChange={setBomDialogOpen} 
          onSuccess={handleBomSuccess} 
          bom={selectedBom} 
        />
      </DashboardLayout>
  );
}
