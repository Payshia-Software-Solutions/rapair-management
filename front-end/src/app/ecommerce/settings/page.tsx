"use client";

import React from "react";
import NextLink from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { 
  Settings, 
  Globe, 
  CreditCard, 
  Mail, 
  Truck, 
  ShieldCheck, 
  Bell, 
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Star,
  Database,
  Store,
  Layout,
  Link,
  User,
  ExternalLink,
  Lock,
  Save,
  AlertTriangle,
  Zap,
  Plus,
  Trash2,
  Package,
  Bot,
  Copy,
  RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { fetchLocations, type ServiceLocation, fetchStorefrontSettings, updateStorefrontSettings, testSmtpSettings, uploadStorefrontIcon } from "@/lib/api/admin";
import { fetchItemCategories, fetchParts, type ItemCategory, type PartRow } from "@/lib/api/inventory";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Info } from "lucide-react";

const BEST_SELLERS_LIMIT = 10;

function parseProductIds(value: string | undefined): string[] {
  const ids = (value ?? "").split(",").map((id) => id.trim()).filter((id) => /^[1-9]\d*$/.test(id));
  return [...new Set(ids)].slice(0, BEST_SELLERS_LIMIT);
}

const formatPackagingPrice = new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR" });

function parseComplimentaryIds(value: unknown): number[] {
  if (typeof value !== "string") return [];
  try {
    const ids = JSON.parse(value);
    return Array.isArray(ids) ? ids.filter((id) => Number.isInteger(id) && id > 0) : [];
  } catch {
    return [];
  }
}

export default function EcommerceSettingsPage() {
  const [loading, setLoading] = React.useState(false);
  const [locations, setLocations] = React.useState<ServiceLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = React.useState<string>("");
  const [loadedLocationId, setLoadedLocationId] = React.useState("");
  const [settingsLoadFailed, setSettingsLoadFailed] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<string>("identity");
  const [testingSmtp, setTestingSmtp] = React.useState(false);

  const CONTENT_BASE_URL = (process.env.NEXT_PUBLIC_CONTENT_BASE_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

  // Dialog State
  const [showDialog, setShowDialog] = React.useState(false);
  const [dialogStatus, setDialogStatus] = React.useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ title: '', message: '', type: 'info' });

  const triggerDialog = (title: string, message: string, type: 'success' | 'error' | 'info') => {
    setDialogStatus({ title, message, type });
    setShowDialog(true);
  };

  // Test Email Dialog State
  const [showTestEmailDialog, setShowTestEmailDialog] = React.useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = React.useState("");

  // Settings State
  const [emailServer, setEmailServer] = React.useState<"default" | "custom">("default");
  const [storeName, setStoreName] = React.useState("Official Repair Store");
  const [supportEmail, setSupportEmail] = React.useState("support@repairmgmt.com");
  const [description, setDescription] = React.useState("The leading provider of authentic spare parts and expert repair services.");
  const [smtpHost, setSmtpHost] = React.useState("");
  const [smtpPort, setSmtpPort] = React.useState("587");
  const [encryption, setEncryption] = React.useState("tls");
  const [smtpUser, setSmtpUser] = React.useState("");
  const [smtpPass, setSmtpPass] = React.useState("");
  const [fromEmail, setFromEmail] = React.useState("");
  const [fromName, setFromName] = React.useState("");
  const [ccEmail, setCcEmail] = React.useState("");
  const [bccEmail, setBccEmail] = React.useState("");
  const [domain, setDomain] = React.useState("shop.payshia.com");
  const [storefrontUrl, setStorefrontUrl] = React.useState("");
  const [showRelatedProducts, setShowRelatedProducts] = React.useState(true);
  const [featuredProductIds, setFeaturedProductIds] = React.useState("");
  const [homepageBestSellerOverride, setHomepageBestSellerOverride] = React.useState<string[] | null>(null);
  const homepageBestSellerIds = homepageBestSellerOverride ?? parseProductIds(featuredProductIds);
  const [homepageBestSellersEdited, setHomepageBestSellersEdited] = React.useState(false);
  const [productLinkPrefix, setProductLinkPrefix] = React.useState("/product/");
  const [deliveryNote, setDeliveryNote] = React.useState("");
  const [announcementText, setAnnouncementText] = React.useState("");
  // AI assistant (TeaAI on the website)
  const [aiEnabled, setAiEnabled] = React.useState(true);
  const [aiProvider, setAiProvider] = React.useState<"gemini" | "claude" | "openai">("gemini");
  const [aiKeys, setAiKeys] = React.useState({ gemini: "", claude: "", openai: "" });
  const [aiModels, setAiModels] = React.useState({ gemini: "", claude: "", openai: "" });
  const [aiServerSecret, setAiServerSecret] = React.useState("");

  const [fetchingParts, setFetchingParts] = React.useState(false);
  const [allParts, setAllParts] = React.useState<PartRow[]>([]);
  
  // Payments State
  const [payhereEnabled, setPayhereEnabled] = React.useState(false);
  const [codEnabled, setCodEnabled] = React.useState(false);
  const [mintpayEnabled, setMintpayEnabled] = React.useState(false);
  const [bankTransferEnabled, setBankTransferEnabled] = React.useState(false);
  const [stripeEnabled, setStripeEnabled] = React.useState(false);
  const [kokoEnabled, setKokoEnabled] = React.useState(false);
  const [stripeIcon, setStripeIcon] = React.useState("");
  const [kokoIcon, setKokoIcon] = React.useState("");

  const [payhereIcon, setPayhereIcon] = React.useState("");
  const [codIcon, setCodIcon] = React.useState("");
  const [mintpayIcon, setMintpayIcon] = React.useState("");
  const [bankTransferIcon, setBankTransferIcon] = React.useState("");

  const [bankName, setBankName] = React.useState("");
  const [bankAccountName, setBankAccountName] = React.useState("");
  const [bankAccountNumber, setBankAccountNumber] = React.useState("");
  const [bankBranch, setBankBranch] = React.useState("");

  // SEO & Social State
  const [metaTitlePrefix, setMetaTitlePrefix] = React.useState("Tea Jar Ceylon | ");
  const [fbPixelId, setFbPixelId] = React.useState("");
  const [gaId, setGaId] = React.useState("");

  // Legal State
  const [termsOfService, setTermsOfService] = React.useState("Enter your terms and conditions here...");
  const [privacyPolicy, setPrivacyPolicy] = React.useState("Enter your privacy policy here...");

  const [packagingCategoryId, setPackagingCategoryId] = React.useState("");
  const [complimentaryPackagingIds, setComplimentaryPackagingIds] = React.useState<number[]>([]);
  const [giftCardItemId, setGiftCardItemId] = React.useState("");
  const [storefrontParts, setStorefrontParts] = React.useState<{ locationId: string; items: PartRow[] } | null>(null);
  const [storefrontPartsError, setStorefrontPartsError] = React.useState(false);
  const packagingItems = storefrontParts?.locationId === selectedLocationId && packagingCategoryId
    ? storefrontParts.items.filter((part) =>
        Number(part.item_category_id) === Number(packagingCategoryId) &&
        Number(part.is_active) === 1 && Number(part.is_online) === 1
      )
    : [];
  const [itemCategories, setItemCategories] = React.useState<ItemCategory[] | null>(null);
  const [itemCategoriesLoadFailed, setItemCategoriesLoadFailed] = React.useState(false);
  const settingsReady = !!selectedLocationId && selectedLocationId === loadedLocationId;

  // Shipping State
  const [shippingEnabled, setShippingEnabled] = React.useState(false);
  const [shippingFlatRate, setShippingFlatRate] = React.useState("0");

  // Pricing State
  const [taxInclusive, setTaxInclusive] = React.useState(false);

  React.useEffect(() => {
    async function loadLocations() {
      try {
        const data = await fetchLocations();
        const onlineLocations = data.filter((l: ServiceLocation) => l.allow_online);
        setLocations(onlineLocations);
        if (onlineLocations.length > 0) {
          setSelectedLocationId(String(onlineLocations[0].id));
        }
      } catch (error) {
        console.error("Failed to load locations", error);
      }
    }
    loadLocations();
  }, []);

  React.useEffect(() => {
    async function loadAllParts() {
      setFetchingParts(true);
      try {
        const data = await fetchParts();
        setAllParts(data);
      } catch (error) {
        console.error("Failed to load parts", error);
      } finally {
        setFetchingParts(false);
      }
    }
    loadAllParts();
  }, []);

  React.useEffect(() => {
    if (activeTab !== "packaging") return;
    let ignore = false;
    setItemCategoriesLoadFailed(false);
    fetchItemCategories()
      .then((categories) => {
        if (!ignore) setItemCategories(categories);
      })
      .catch(() => {
        if (!ignore) setItemCategoriesLoadFailed(true);
      });
    return () => { ignore = true; };
  }, [activeTab]);

  React.useEffect(() => {
    if ((activeTab !== "packaging" && activeTab !== "best-sellers") || !selectedLocationId) return;
    let ignore = false;
    setStorefrontPartsError(false);
    fetchParts("", selectedLocationId)
      .then((items) => {
        if (!Array.isArray(items)) throw new Error("Packaging items are unavailable");
        if (!ignore) setStorefrontParts({ locationId: selectedLocationId, items });
      })
      .catch(() => {
        if (!ignore) setStorefrontPartsError(true);
      });
    return () => { ignore = true; };
  }, [activeTab, selectedLocationId]);

  React.useEffect(() => {
    if (!selectedLocationId) return;
    let ignore = false;
    setLoadedLocationId("");
    setSettingsLoadFailed(false);
    async function loadSettings() {
      try {
        const settings = await fetchStorefrontSettings(selectedLocationId);
        if (ignore) return;
        if (!settings) throw new Error("Storefront settings are missing");
        setEmailServer(settings.email_server_type === 'custom' ? 'custom' : 'default');
        setStoreName(settings.store_name || "");
        setSupportEmail(settings.support_email || "");
        setDescription(settings.store_description || "");
        setSmtpHost(settings.mail_host || "");
        setSmtpPort(settings.mail_port || "587");
        setEncryption(settings.mail_encryption || "tls");
        setSmtpUser(settings.mail_user || "");
        setSmtpPass(settings.mail_pass || "");
        setFromEmail(settings.mail_from_addr || "");
        setFromName(settings.mail_from_name || "");
        setCcEmail(settings.cc_email || "");
        setBccEmail(settings.bcc_email || "");
        setDomain(settings.domain || "shop.payshia.com");
        setStorefrontUrl(settings.storefront_url || "");
        setShowRelatedProducts(settings.show_related_products !== "0");
        setFeaturedProductIds(settings.featured_product_ids || "");
        setHomepageBestSellerOverride(parseProductIds(settings.effective_homepage_best_seller_ids ?? settings.homepage_best_seller_ids ?? settings.featured_product_ids));
        setHomepageBestSellersEdited(false);
        setProductLinkPrefix(settings.storefront_product_prefix || "/product/");
        setMetaTitlePrefix(settings.meta_title_prefix || "");
        setFbPixelId(settings.facebook_pixel_id || "");
        setGaId(settings.google_analytics_id || "");
        setTermsOfService(settings.terms_of_service || "");
        setPrivacyPolicy(settings.privacy_policy || "");

        setPackagingCategoryId(Number(settings.packaging_category_id) > 0 ? String(settings.packaging_category_id) : "");
        setComplimentaryPackagingIds(parseComplimentaryIds(settings.packaging_complimentary_item_ids));
        setGiftCardItemId(Number(settings.gift_message_item_id) > 0 && settings.gift_message_enabled !== "0"
          ? String(settings.gift_message_item_id)
          : "");

        setShippingEnabled(settings.shipping_enabled === "1");
        setShippingFlatRate(settings.shipping_flat_rate || "0");

        setPayhereEnabled(settings.payment_payhere_enabled === "1");
        setCodEnabled(settings.payment_cod_enabled === "1");
        setMintpayEnabled(settings.payment_mintpay_enabled === "1");
        setBankTransferEnabled(settings.payment_bank_transfer_enabled === "1");

        setPayhereIcon(settings.payment_payhere_icon || "");
        setCodIcon(settings.payment_cod_icon || "");
        setMintpayIcon(settings.payment_mintpay_icon || "");
        setBankTransferIcon(settings.payment_bank_transfer_icon || "");
        setStripeEnabled(settings.payment_stripe_enabled === "1");
        setKokoEnabled(settings.payment_koko_enabled === "1");
        setStripeIcon(settings.payment_stripe_icon || "");
        setKokoIcon(settings.payment_koko_icon || "");

        setBankName(settings.bank_name || "");
        setBankAccountName(settings.bank_account_name || "");
        setBankAccountNumber(settings.bank_account_number || "");
        setBankBranch(settings.bank_branch || "");

        setTaxInclusive(settings.ecom_tax_inclusive === "1");
        setDeliveryNote(settings.delivery_note || "");
        setAnnouncementText(settings.announcement_text || "");
        setAiEnabled(settings.ai_enabled !== "0");
        setAiProvider((["gemini", "claude", "openai"].includes(settings.ai_provider) ? settings.ai_provider : "gemini") as "gemini" | "claude" | "openai");
        setAiKeys({ gemini: settings.ai_gemini_key || "", claude: settings.ai_claude_key || "", openai: settings.ai_openai_key || "" });
        setAiModels({ gemini: settings.ai_gemini_model || "", claude: settings.ai_claude_model || "", openai: settings.ai_openai_model || "" });
        setAiServerSecret(settings.ai_server_secret || "");
        setLoadedLocationId(selectedLocationId);
      } catch (error) {
        if (ignore) return;
        setSettingsLoadFailed(true);
        console.error("Failed to load storefront settings", error);
      }
    }
    loadSettings();
    return () => { ignore = true; };
  }, [selectedLocationId]);

  React.useEffect(() => {
    if (fromEmail && !testEmailRecipient) {
        setTestEmailRecipient(fromEmail);
    }
  }, [fromEmail]);

  const updateHomepageBestSellers = (ids: string[]) => {
    setHomepageBestSellerOverride(parseProductIds(ids.join(",")));
    setHomepageBestSellersEdited(true);
  };

  const moveHomepageBestSeller = (index: number, direction: -1 | 1) => {
    const reordered = [...homepageBestSellerIds];
    const [productId] = reordered.splice(index, 1);
    reordered.splice(index + direction, 0, productId);
    updateHomepageBestSellers(reordered);
  };

  const handleSave = async () => {
    if (!settingsReady) return;
    setLoading(true);
    try {
      const payload = {
        location_id: selectedLocationId,
        email_server_type: emailServer,
        store_name: storeName,
        support_email: supportEmail,
        store_description: description,
        mail_host: smtpHost,
        mail_port: smtpPort,
        mail_encryption: encryption,
        mail_user: smtpUser,
        mail_pass: smtpPass,
        mail_from_addr: fromEmail,
        mail_from_name: fromName,
        cc_email: ccEmail,
        bcc_email: bccEmail,
        domain: domain,
        storefront_url: storefrontUrl,
        storefront_product_prefix: productLinkPrefix,
        show_related_products: showRelatedProducts ? "1" : "0",
        featured_product_ids: featuredProductIds,
        meta_title_prefix: metaTitlePrefix,
        facebook_pixel_id: fbPixelId,
        google_analytics_id: gaId,
        terms_of_service: termsOfService,
        privacy_policy: privacyPolicy,
        payment_payhere_enabled: payhereEnabled ? "1" : "0",
        payment_cod_enabled: codEnabled ? "1" : "0",
        payment_mintpay_enabled: mintpayEnabled ? "1" : "0",
        payment_bank_transfer_enabled: bankTransferEnabled ? "1" : "0",
        payment_payhere_icon: payhereIcon,
        payment_cod_icon: codIcon,
        payment_mintpay_icon: mintpayIcon,
        payment_bank_transfer_icon: bankTransferIcon,
        payment_stripe_enabled: stripeEnabled ? "1" : "0",
        payment_koko_enabled: kokoEnabled ? "1" : "0",
        payment_stripe_icon: stripeIcon,
        payment_koko_icon: kokoIcon,
        bank_name: bankName,
        bank_account_name: bankAccountName,
        bank_account_number: bankAccountNumber,
        bank_branch: bankBranch,
        shipping_enabled: shippingEnabled ? "1" : "0",
        shipping_flat_rate: shippingFlatRate,
        packaging_category_id: packagingCategoryId,
        packaging_complimentary_item_ids: JSON.stringify(complimentaryPackagingIds),
        gift_message_item_id: giftCardItemId,
        ...(giftCardItemId ? { gift_message_enabled: "1" } : {}),
        ecom_tax_inclusive: taxInclusive ? "1" : "0",
        delivery_note: deliveryNote,
        announcement_text: announcementText,
        ai_enabled: aiEnabled ? "1" : "0",
        ai_provider: aiProvider,
        ai_gemini_key: aiKeys.gemini,
        ai_claude_key: aiKeys.claude,
        ai_openai_key: aiKeys.openai,
        ai_gemini_model: aiModels.gemini,
        ai_claude_model: aiModels.claude,
        ai_openai_model: aiModels.openai,
        ai_server_secret: aiServerSecret
      };
      await updateStorefrontSettings(payload);
      triggerDialog("Settings Saved", "Your storefront settings have been updated successfully.", "success");
    } catch (error: any) {
      triggerDialog("Save Failed", error.message || "An error occurred while saving settings.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleTestSmtp = () => {
    if (!smtpHost || !smtpUser) {
        triggerDialog("Missing Configuration", "Please fill in the SMTP Host and Authentication details before testing.", "info");
        return;
    }
    setShowTestEmailDialog(true);
  };

  const runSmtpTest = async () => {
    if (!testEmailRecipient) return;
    setTestingSmtp(true);
    setShowTestEmailDialog(false);
    
    try {
      const payload = {
        mail_host: smtpHost,
        mail_port: smtpPort,
        mail_encryption: encryption,
        mail_user: smtpUser,
        mail_pass: smtpPass,
        mail_from_addr: fromEmail,
        mail_from_name: fromName,
        test_email: testEmailRecipient
      };
      await testSmtpSettings(payload);
      triggerDialog("Connection Successful", `The SMTP test email was sent successfully to ${testEmailRecipient}.`, "success");
    } catch (error: any) {
      triggerDialog("Connection Failed", error.message || "Could not establish connection with the SMTP server.", "error");
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleIconUpload = async (key: string, file: File) => {
    if (!selectedLocationId) return;
    const formData = new FormData();
    formData.append('location_id', selectedLocationId);
    formData.append('key', key);
    formData.append('icon', file);

    try {
        const res = await uploadStorefrontIcon(formData);
        if (res.status === 'success') {
            const path = res.data.path;
            if (key === 'payment_payhere_icon') setPayhereIcon(path);
            if (key === 'payment_cod_icon') setCodIcon(path);
            if (key === 'payment_mintpay_icon') setMintpayIcon(path);
            if (key === 'payment_bank_transfer_icon') setBankTransferIcon(path);
            if (key === 'payment_stripe_icon') setStripeIcon(path);
            if (key === 'payment_koko_icon') setKokoIcon(path);
            triggerDialog("Icon Uploaded", "The payment method icon has been updated successfully.", "success");
        }
    } catch (error: any) {
        triggerDialog("Upload Failed", error.message || "Could not upload icon.", "error");
    }
  };

  const selectedLocation = locations.find(l => String(l.id) === selectedLocationId);

  return (
    <DashboardLayout title="Storefront Settings">
      <div className="flex flex-col gap-8 w-full animate-in fade-in slide-in-from-right-4 duration-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
              <Store className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">E-commerce Module</h1>
              <p className="text-muted-foreground text-sm">Manage location-specific storefronts and communication settings.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="w-64">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block ml-0.5">Selected Storefront</Label>
                <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                   <SelectTrigger className="h-10 rounded-lg bg-background border-muted font-medium">
                      <SelectValue placeholder="Select Location" />
                   </SelectTrigger>
                   <SelectContent>
                      {locations.map(loc => (
                         <SelectItem key={loc.id} value={String(loc.id)}>{loc.name}</SelectItem>
                      ))}
                   </SelectContent>
                </Select>
             </div>
             <Button 
                onClick={handleSave}
                disabled={loading || !settingsReady}
                className="h-10 px-6 rounded-lg font-bold uppercase text-[11px] tracking-widest gap-2 mt-5 shadow-sm"
              >
               {loading ? <Database className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
               {loading ? 'Saving...' : 'Save Changes'}
             </Button>
          </div>
        </div>

        {settingsLoadFailed && (
          <p role="alert" className="text-sm text-destructive">
            Storefront settings could not be loaded. Refresh the page or select another storefront.
          </p>
        )}

        {!selectedLocationId ? (
            <div className="flex flex-col items-center justify-center py-20 bg-muted/5 rounded-xl border border-dashed">
                <AlertTriangle className="w-10 h-10 text-amber-500/40 mb-4" />
                <p className="text-muted-foreground font-semibold">No online-enabled locations found.</p>
                <p className="text-xs text-muted-foreground/60 mt-1 uppercase tracking-widest font-bold">Enable 'Allow Online' in Location Settings first.</p>
            </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-3 space-y-1.5">
               {[
                  { id: "identity", icon: Store, label: "Identity" },
                  { id: "email", icon: Mail, label: "Email Server" },
                  { id: "promotions", icon: Zap, label: "Promotions" },
                  { id: "payments", icon: CreditCard, label: "Payments" },
                  { id: "pricing", icon: Database, label: "Pricing & Taxes" },
                  { id: "seo", icon: Globe, label: "SEO & Social" },
                  { id: "shipping", icon: Truck, label: "Shipping" },
                  { id: "packaging", icon: Package, label: "Packaging" },
                  { id: "legals", icon: ShieldCheck, label: "Legals" },
                  { id: "ai", icon: Bot, label: "AI Assistant" },
               ].map((item) => (
                  <Button 
                    key={item.id} 
                    variant={activeTab === item.id ? "secondary" : "ghost"} 
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full justify-between h-11 rounded-lg px-4 group transition-all ${activeTab === item.id ? 'bg-primary/10 text-primary' : ''}`}
                  >
                     <div className="flex items-center gap-3">
                        <item.icon className={`w-4 h-4 ${activeTab === item.id ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="font-semibold text-sm">{item.label}</span>
                     </div>
                     <ChevronRight className={`w-3.5 h-3.5 transition-transform ${activeTab === item.id ? 'rotate-90' : ''}`} />
                  </Button>
               ))}
               
               <div className="mt-6 p-5 bg-muted/5 rounded-xl border border-muted space-y-3">
                  <div className="flex items-center gap-2 text-primary font-bold text-[10px] uppercase tracking-widest">
                     <Database className="w-3 h-3" /> Sync Status
                  </div>
                  <div className="flex items-center justify-between">
                     <span className="text-xs font-semibold text-muted-foreground">Store Status</span>
                     <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </div>
                  <p className="text-[10px] text-muted-foreground/70 font-medium leading-relaxed">
                     Syncing live with central ERP database.
                  </p>
               </div>
            </div>

            <div className="lg:col-span-9 space-y-6">
               {activeTab === 'pricing' && (
                  <Card className="shadow-sm border-muted animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <CardHeader className="bg-muted/5 border-b py-5 px-6">
                        <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                          <Database className="w-5 h-5 text-primary" /> Pricing & Tax Settings
                        </CardTitle>
                        <CardDescription className="text-xs font-medium">Configure how taxes are handled and displayed on your storefront.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-8">
                        <div className="flex items-center justify-between p-6 rounded-2xl border-2 border-primary/10 bg-primary/5">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary/10 rounded-xl">
                                    <ShieldCheck className="w-6 h-6 text-primary" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="font-bold text-base">Tax Inclusive Pricing</h3>
                                    <p className="text-xs text-muted-foreground font-medium max-w-md leading-relaxed">
                                        When enabled, product prices displayed on the store already include taxes. Taxes will be extracted at checkout for reporting.
                                    </p>
                                </div>
                            </div>
                            <Switch 
                                checked={taxInclusive} 
                                onCheckedChange={setTaxInclusive}
                                className="scale-110 data-[state=checked]:bg-primary"
                            />
                        </div>

                        <div className="p-5 rounded-xl border border-dashed bg-muted/5 space-y-4">
                            <div className="flex items-center gap-2">
                                <Info className="w-4 h-4 text-primary" />
                                <h4 className="text-xs font-bold uppercase tracking-widest text-foreground">Important Information</h4>
                            </div>
                            <ul className="space-y-2 ml-1">
                                <li className="text-[11px] text-muted-foreground font-medium flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-primary" />
                                    Taxes are fetched from the <strong>{selectedLocation?.name}</strong> configuration in Location Settings.
                                </li>
                                <li className="text-[11px] text-muted-foreground font-medium flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-primary" />
                                    The ERP always stores <strong>Base Prices</strong> (exclusive of tax) in the database for accurate accounting.
                                </li>
                                <li className="text-[11px] text-muted-foreground font-medium flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-primary" />
                                    Tax breakdown will be visible in the order summary and confirmation emails.
                                </li>
                            </ul>
                        </div>
                    </CardContent>
                  </Card>
               )}

               {activeTab === 'identity' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Card className="shadow-sm border-muted">
                        <CardHeader className="bg-muted/5 border-b py-5 px-6">
                          <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                              <Store className="w-5 h-5 text-primary" /> Storefront: {selectedLocation?.name}
                          </CardTitle>
                          <CardDescription className="text-xs font-medium">Configure identity and public settings for this branch.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-0.5">Store Name</Label>
                                <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} className="h-11 rounded-lg" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-0.5">Public Support Email</Label>
                                <Input value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} className="h-11 rounded-lg" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-0.5">Store Description (SEO)</Label>
                            <textarea 
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              className="w-full h-28 rounded-xl border bg-background text-sm font-medium p-4 focus:ring-1 focus:ring-primary focus:outline-none resize-none" 
                            />
                          </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border-muted">
                        <CardHeader className="bg-muted/5 border-b py-5 px-6">
                          <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                              <Globe className="w-5 h-5 text-primary" /> Domain Configuration
                          </CardTitle>
                          <CardDescription className="text-xs font-medium">Link your custom domain to your storefront.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6">
                          <div className="flex flex-col md:flex-row items-center gap-5 p-5 bg-muted/5 rounded-xl border border-muted">
                              <div className="p-3 bg-primary/10 rounded-lg">
                                <Globe className="w-6 h-6 text-primary" />
                              </div>
                               <div className="flex-1 space-y-2">
                                 <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Custom Domain</Label>
                                 <Input 
                                    value={domain} 
                                    onChange={(e) => setDomain(e.target.value)} 
                                    placeholder="shop.yourdomain.com"
                                    className="h-10 bg-background border-muted/20"
                                 />
                                 <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1.5 mt-0.5">
                                     <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> SSL will be automatically provisioned
                                 </p>
                               </div>
                               <Button variant="ghost" className="rounded-lg font-semibold gap-2 h-9 text-xs text-primary">
                                 Verify <ExternalLink className="w-3.5 h-3.5" />
                               </Button>
                           </div>
                        </CardContent>
                    </Card>
                  </div>
               )}

               {activeTab === 'email' && (
                  <Card className="shadow-sm border-muted animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <CardHeader className="bg-muted/5 border-b py-5 px-6">
                        <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                          <Mail className="w-5 h-5 text-primary" /> Email Server
                        </CardTitle>
                        <CardDescription className="text-xs font-medium">Manage transactional email settings.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="space-y-3">
                          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-0.5">Server Selection</Label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div 
                                onClick={() => setEmailServer('default')}
                                className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col gap-1 ${emailServer === 'default' ? 'border-primary bg-primary/5' : 'border-muted bg-background hover:bg-muted/5'}`}
                              >
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-sm">System Default</span>
                                    {emailServer === 'default' && <div className="w-3 h-3 rounded-full bg-primary" />}
                                </div>
                                <p className="text-[11px] text-muted-foreground font-medium">Use global ERP server.</p>
                              </div>
                              <div 
                                onClick={() => setEmailServer('custom')}
                                className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col gap-1 ${emailServer === 'custom' ? 'border-primary bg-primary/5' : 'border-muted bg-background hover:bg-muted/5'}`}
                              >
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-sm">Custom SMTP</span>
                                    {emailServer === 'custom' && <div className="w-3 h-3 rounded-full bg-primary" />}
                                </div>
                                <p className="text-[11px] text-muted-foreground font-medium">Dedicated configuration.</p>
                              </div>
                          </div>
                        </div>

                        {emailServer === 'custom' && (
                          <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-500">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                   <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] border-b pb-2">
                                      <Link className="w-3 h-3" /> Connection Details
                                   </div>
                                   <div className="space-y-4">
                                      <div className="space-y-1.5">
                                         <Label className="text-[11px] font-semibold text-muted-foreground">SMTP Host</Label>
                                         <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="mail.payshia.com" className="h-10 rounded-lg text-sm bg-muted/5 border-muted/20" />
                                      </div>
                                      <div className="grid grid-cols-2 gap-4">
                                         <div className="space-y-1.5">
                                            <Label className="text-[11px] font-semibold text-muted-foreground">SMTP Port</Label>
                                            <Input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="465" className="h-10 rounded-lg text-sm bg-muted/5 border-muted/20" />
                                         </div>
                                         <div className="space-y-1.5">
                                            <Label className="text-[11px] font-semibold text-muted-foreground">Encryption</Label>
                                            <Select value={encryption} onValueChange={setEncryption}>
                                               <SelectTrigger className="h-10 rounded-lg text-sm bg-muted/5 border-muted/20">
                                                  <SelectValue placeholder="Select Encryption" />
                                               </SelectTrigger>
                                               <SelectContent>
                                                  <SelectItem value="ssl">SSL / Implicit TLS</SelectItem>
                                                  <SelectItem value="tls">STARTTLS</SelectItem>
                                                  <SelectItem value="none">None</SelectItem>
                                               </SelectContent>
                                            </Select>
                                         </div>
                                      </div>
                                   </div>
                                </div>

                                <div className="space-y-4">
                                   <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] border-b pb-2">
                                      <ShieldCheck className="w-3 h-3" /> Authentication
                                   </div>
                                   <div className="space-y-4">
                                      <div className="space-y-1.5">
                                         <Label className="text-[11px] font-semibold text-muted-foreground">Username</Label>
                                         <Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="no-reply@payshia.com" className="h-10 rounded-lg text-sm bg-muted/5 border-muted/20" />
                                      </div>
                                      <div className="space-y-1.5">
                                         <Label className="text-[11px] font-semibold text-muted-foreground">Password</Label>
                                         <Input type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder="••••••••••••" className="h-10 rounded-lg text-sm bg-muted/5 border-muted/20" />
                                      </div>
                                   </div>
                                </div>
                             </div>

                             <div className="space-y-4 pt-2">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] border-b pb-2">
                                   <User className="w-3 h-3" /> Sender Identity
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                   <div className="space-y-1.5">
                                      <Label className="text-[11px] font-semibold text-muted-foreground">From Email Address</Label>
                                      <Input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="no-reply@payshia.com" className="h-10 rounded-lg text-sm bg-muted/5 border-muted/20" />
                                   </div>
                                   <div className="space-y-1.5">
                                      <Label className="text-[11px] font-semibold text-muted-foreground">From Name</Label>
                                      <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Payshia Software Solutions" className="h-10 rounded-lg text-sm bg-muted/5 border-muted/20" />
                                   </div>
                                   <div className="space-y-1.5">
                                      <Label className="text-[11px] font-semibold text-muted-foreground">CC Email Addresses (Comma separated)</Label>
                                      <Input value={ccEmail} onChange={(e) => setCcEmail(e.target.value)} placeholder="admin@payshia.com, manager@payshia.com" className="h-10 rounded-lg text-sm bg-muted/5 border-muted/20" />
                                   </div>
                                   <div className="space-y-1.5">
                                      <Label className="text-[11px] font-semibold text-muted-foreground">BCC Email Addresses (Comma separated)</Label>
                                      <Input value={bccEmail} onChange={(e) => setBccEmail(e.target.value)} placeholder="archive@payshia.com" className="h-10 rounded-lg text-sm bg-muted/5 border-muted/20" />
                                   </div>
                                   <div className="space-y-1.5">
                                      <Label className="text-[11px] font-semibold text-muted-foreground">Storefront URL (Used for "Shop More" button in emails)</Label>
                                      <Input value={storefrontUrl} onChange={(e) => setStorefrontUrl(e.target.value)} placeholder="https://teajarceylon.com" className="h-10 rounded-lg text-sm bg-muted/5 border-muted/20" />
                                   </div>
                                </div>
                             </div>

                             <div className="flex justify-end pt-4">
                                <Button 
                                    variant="outline" 
                                    onClick={handleTestSmtp}
                                    disabled={testingSmtp}
                                    className="rounded-lg font-bold text-[10px] uppercase tracking-widest px-8 h-10 gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary transition-all"
                                >
                                   {testingSmtp ? <Database className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                                   {testingSmtp ? 'Testing...' : 'Test SMTP Connection'}
                                </Button>
                             </div>
                          </div>
                        )}
                    </CardContent>
                  </Card>
               )}

               {activeTab === 'promotions' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                     <Card className="shadow-sm border-muted">
                        <CardHeader className="bg-muted/5 border-b py-5 px-6">
                            <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                              <Zap className="w-5 h-5 text-primary" /> Email Promotions
                            </CardTitle>
                            <CardDescription className="text-xs font-medium">Drive more sales by promoting products in your order emails.</CardDescription>
                        </CardHeader>
                         <CardContent className="p-6 space-y-8">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                 <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-0.5">Product Route Prefix</Label>
                                 <div className="flex items-center gap-2">
                                    <Input 
                                       value={productLinkPrefix} 
                                       onChange={(e) => setProductLinkPrefix(e.target.value)} 
                                       placeholder="/product/" 
                                       className="h-10 rounded-lg bg-muted/5 font-mono text-xs" 
                                    />
                                    <div className="p-2 rounded bg-primary/5 text-primary">
                                       <Info className="w-3.5 h-3.5" />
                                    </div>
                                 </div>
                                 <p className="text-[10px] text-muted-foreground font-medium italic">Example: /product/ or /tea/ or /view/</p>
                              </div>
                              <div className="flex items-center justify-between p-4 rounded-xl border border-primary/10 bg-primary/5">
                                 <div className="space-y-0.5">
                                    <Label className="text-xs font-bold">Show Recommendations</Label>
                                    <p className="text-[10px] text-muted-foreground font-medium">Enable "You Might Also Like" in emails.</p>
                                 </div>
                                 <Switch checked={showRelatedProducts} onCheckedChange={setShowRelatedProducts} />
                              </div>
                           </div>

                           <Separator className="opacity-50" />

                           {showRelatedProducts && (
                              <div className="space-y-6">
                                 <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                       <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Featured Products Selection</Label>
                                       <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded uppercase">Limit: 3 Products</span>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                       <div className="space-y-2">
                                          <Label className="text-[11px] font-semibold text-muted-foreground">Search & Add Product</Label>
                                          <SearchableSelect 
                                             value={null}
                                             options={allParts.map(p => ({ label: `${p.part_name} (${p.sku || 'No SKU'})`, value: String(p.id) }))}
                                             onValueChange={(val) => {
                                                const currentIds = featuredProductIds ? featuredProductIds.split(',').map(i => i.trim()).filter(Boolean) : [];
                                                if (currentIds.length >= 3) {
                                                   triggerDialog("Limit Reached", "You can only select up to 3 featured products.", "info");
                                                   return;
                                                }
                                                if (!currentIds.includes(val)) {
                                                   setFeaturedProductIds([...currentIds, val].join(', '));
                                                }
                                             }}
                                             placeholder="Search ERP Inventory..."
                                          />
                                       </div>
                                       <div className="p-4 rounded-xl border border-dashed border-muted bg-muted/5 flex flex-col justify-center items-center text-center">
                                          <Package className="w-5 h-5 text-muted-foreground/40 mb-2" />
                                          <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">
                                             Search products from your inventory to manually feature them. <br/>
                                             If none selected, we'll show items from the same category automatically.
                                          </p>
                                       </div>
                                    </div>
                                 </div>

                                 <div className="space-y-3">
                                    <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight ml-0.5">Currently Selected</Label>
                                    <div className="grid grid-cols-1 gap-2">
                                       {featuredProductIds ? featuredProductIds.split(',').map(i => i.trim()).filter(Boolean).map(id => {
                                          const part = allParts.find(p => String(p.id) === id);
                                          return (
                                             <div key={id} className="flex items-center justify-between p-3 bg-background border rounded-lg group hover:border-primary/30 transition-colors">
                                                <div className="flex items-center gap-3">
                                                   <div className="w-10 h-10 rounded bg-muted/30 flex items-center justify-center overflow-hidden">
                                                      {part?.image_filename ? (
                                                         <img src={`${CONTENT_BASE_URL}/items/${part.image_filename}`} className="w-full h-full object-cover" />
                                                      ) : (
                                                         <Package className="w-4 h-4 text-muted-foreground/30" />
                                                      )}
                                                   </div>
                                                   <div>
                                                      <p className="text-sm font-bold text-foreground">{part?.part_name || `Unknown Product (ID: ${id})`}</p>
                                                      <div className="flex items-center gap-2">
                                                         <p className="text-[10px] text-muted-foreground font-medium">{part?.sku || 'NO SKU'}</p>
                                                         {part?.slug && storefrontUrl && (
                                                            <span className="text-[9px] text-primary/60 font-mono bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10 truncate max-w-[180px]">
                                                               {storefrontUrl.replace(/\/$/, '')}{productLinkPrefix.startsWith('/') ? '' : '/'}{productLinkPrefix}{productLinkPrefix.endsWith('/') ? '' : '/'}{part.slug}
                                                            </span>
                                                         )}
                                                      </div>
                                                   </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                   <Button 
                                                      variant="ghost" 
                                                      size="icon" 
                                                      className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                                                      onClick={() => window.open(`/inventory/items/${id}`, '_blank')}
                                                      title="Edit in ERP"
                                                   >
                                                      <Settings className="w-3.5 h-3.5" />
                                                   </Button>
                                                   {part?.slug && storefrontUrl && (
                                                      <Button 
                                                         variant="ghost" 
                                                         size="icon" 
                                                         className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                         onClick={() => {
                                                            const base = storefrontUrl.replace(/\/$/, '');
                                                            const prefix = productLinkPrefix.startsWith('/') ? productLinkPrefix : `/${productLinkPrefix}`;
                                                            const finalPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
                                                            window.open(`${base}${finalPrefix}${part.slug}`, '_blank');
                                                         }}
                                                         title="View on Store"
                                                      >
                                                         <ExternalLink className="w-3.5 h-3.5" />
                                                      </Button>
                                                   )}
                                                   <Button 
                                                      variant="ghost" 
                                                      size="icon" 
                                                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                      onClick={() => {
                                                         const newIds = featuredProductIds.split(',').map(i => i.trim()).filter(i => i !== id).join(', ');
                                                         setFeaturedProductIds(newIds);
                                                      }}
                                                   >
                                                      <Trash2 className="w-3.5 h-3.5" />
                                                   </Button>
                                                </div>
                                             </div>
                                          );
                                       }) : (
                                          <div className="py-8 flex flex-col items-center justify-center border border-dashed rounded-lg bg-muted/5 opacity-60">
                                             <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">No manual products selected</p>
                                             <p className="text-[10px] text-muted-foreground mt-1">System will use automatic category matching.</p>
                                          </div>
                                       )}
                                    </div>
                                 </div>
                              </div>
                           )}
                        </CardContent>
                     </Card>
                  </div>
               )}

               {activeTab === 'payments' && (
                  <Card className="shadow-sm border-muted animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <CardHeader className="bg-muted/5 border-b py-5 px-6">
                        <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                          <CreditCard className="w-5 h-5 text-primary" /> Payment Methods
                        </CardTitle>
                        <CardDescription className="text-xs font-medium">Configure customer payment options for this storefront.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-3">
                        {[
                           { 
                              id: "bank",
                              key: "payment_bank_transfer_icon",
                              name: "Direct Bank Transfer", 
                              desc: "Allow customers to pay via manual bank deposit/transfer.", 
                              active: bankTransferEnabled,
                              onToggle: setBankTransferEnabled,
                              icon: bankTransferIcon
                           },
                           { 
                              id: "payhere",
                              key: "payment_payhere_icon",
                              name: "Online Card Payment (PayHere)", 
                              desc: "Integrated payment gateway for Visa, Mastercard, and Genie.", 
                              active: payhereEnabled,
                              onToggle: setPayhereEnabled,
                              icon: payhereIcon
                           },
                           { 
                              id: "cod",
                              key: "payment_cod_icon",
                              name: "Cash on Delivery", 
                              desc: "Collect payment at the customer's doorstep.", 
                              active: codEnabled,
                              onToggle: setCodEnabled,
                              icon: codIcon
                           },
                           { 
                              id: "mintpay",
                              key: "payment_mintpay_icon",
                              name: "Pay with Mintpay (BNPL)", 
                              desc: "Let customers buy now and pay in 3 interest-free installments.", 
                              active: mintpayEnabled,
                              onToggle: setMintpayEnabled,
                              icon: mintpayIcon
                           },
                           {
                              id: "stripe",
                              key: "payment_stripe_icon",
                              name: "Stripe (International Cards)",
                              desc: "Card payments for overseas customers. Shown as Coming Soon on the website until enabled.",
                              active: stripeEnabled,
                              onToggle: setStripeEnabled,
                              icon: stripeIcon
                           },
                           {
                              id: "koko",
                              key: "payment_koko_icon",
                              name: "Pay with Koko (BNPL)",
                              desc: "Buy now, pay later in 3 installments. Shown as Coming Soon on the website until enabled.",
                              active: kokoEnabled,
                              onToggle: setKokoEnabled,
                              icon: kokoIcon
                           },
                         ].map((method) => (
                           <div key={method.id} className={`flex flex-col gap-4 p-4 rounded-xl border transition-all ${method.active ? 'border-primary/20 bg-primary/5' : 'border-muted bg-background hover:bg-muted/5'}`}>
                               <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-background border flex items-center justify-center overflow-hidden">
                                       {method.icon ? (
                                          <img src={`${CONTENT_BASE_URL}/${method.icon}`} className="w-full h-full object-contain p-1" alt={method.name} />
                                       ) : (
                                          <CreditCard className="w-5 h-5 text-muted-foreground/30" />
                                       )}
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                       <span className={`text-sm font-bold ${method.active ? 'text-primary' : ''}`}>{method.name}</span>
                                       <span className="text-[11px] text-muted-foreground font-medium">{method.desc}</span>
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-4">
                                    <Switch 
                                       checked={method.active} 
                                       onCheckedChange={method.onToggle}
                                       className="data-[state=checked]:bg-primary"
                                    />
                                 </div>
                               </div>
                               
                               {method.id === 'bank' && method.active && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 p-4 bg-muted/20 rounded-xl border border-dashed animate-in fade-in slide-in-from-top-2 duration-300">
                                     <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Bank Name</Label>
                                        <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Commercial Bank" className="h-9 text-xs rounded-lg" />
                                     </div>
                                     <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Account Name</Label>
                                        <Input value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} placeholder="e.g. Tea Jar (Pvt) Ltd" className="h-9 text-xs rounded-lg" />
                                     </div>
                                     <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Account Number</Label>
                                        <Input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} placeholder="e.g. 1000234567" className="h-9 text-xs rounded-lg" />
                                     </div>
                                     <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Branch</Label>
                                        <Input value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} placeholder="e.g. Colombo 07" className="h-9 text-xs rounded-lg" />
                                     </div>
                                  </div>
                               )}

                               <div className="flex items-center justify-between pt-2 border-t border-muted/50">
                                  <div className="flex items-center gap-2">
                                     <input 
                                        type="file" 
                                        id={`icon-${method.id}`} 
                                        className="hidden" 
                                        accept="image/*"
                                        onChange={(e) => {
                                           const file = e.target.files?.[0];
                                           if (file) handleIconUpload(method.key, file);
                                        }}
                                     />
                                     <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="h-8 rounded-lg text-[10px] font-bold uppercase tracking-wider gap-2"
                                        onClick={() => document.getElementById(`icon-${method.id}`)?.click()}
                                     >
                                        <Plus className="w-3.5 h-3.5" /> {method.icon ? 'Change Icon' : 'Upload Icon'}
                                     </Button>
                                     {method.icon && (
                                        <Button 
                                           variant="ghost" 
                                           size="sm" 
                                           className="h-8 rounded-lg text-[10px] font-bold uppercase tracking-wider text-destructive hover:bg-destructive/10"
                                           onClick={() => {
                                              if (method.key === 'payment_payhere_icon') setPayhereIcon("");
                                              if (method.key === 'payment_cod_icon') setCodIcon("");
                                              if (method.key === 'payment_mintpay_icon') setMintpayIcon("");
                                              if (method.key === 'payment_bank_transfer_icon') setBankTransferIcon("");
                                              if (method.key === 'payment_stripe_icon') setStripeIcon("");
                                              if (method.key === 'payment_koko_icon') setKokoIcon("");
                                           }}
                                        >
                                           <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                     )}
                                  </div>
                                  <Button variant="ghost" size="sm" className="font-bold text-[10px] uppercase tracking-widest hover:bg-primary/10 hover:text-primary rounded-lg px-3 h-8">Configure</Button>
                               </div>
                           </div>
                         ))}
                    </CardContent>
                  </Card>
               )}

               {/* Homepage best sellers moved to E-commerce > Markets > Best sellers (per market). */}

               {activeTab === 'packaging' && (
                 <Card>
                   <CardHeader>
                     <CardTitle className="flex items-center gap-2">
                       <Package className="h-4 w-4 text-primary" />
                       Packaging
                     </CardTitle>
                     <CardDescription>Choose which items appear under Add Gift Box for this storefront.</CardDescription>
                   </CardHeader>
                   <CardContent className="space-y-2">
                     <Label htmlFor="packaging-category">Packaging item category</Label>
                     <Select
                       value={packagingCategoryId || "none"}
                       onValueChange={(value) => {
                         setPackagingCategoryId(value === "none" ? "" : value);
                         setComplimentaryPackagingIds([]);
                         setGiftCardItemId("");
                       }}
                       disabled={!settingsReady || !itemCategories || itemCategoriesLoadFailed || loading}
                     >
                       <SelectTrigger id="packaging-category" aria-describedby="packaging-category-help">
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="none">No packaging category</SelectItem>
                         {packagingCategoryId && !itemCategories?.some((category) => String(category.id) === packagingCategoryId) && (
                           <SelectItem value={packagingCategoryId}>Category #{packagingCategoryId}</SelectItem>
                         )}
                         {itemCategories?.map((category) => (
                           <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                     <p id="packaging-category-help" className="text-sm text-muted-foreground">
                       Create the category in Master Data → Item Categories and assign it to your web-enabled gift boxes and bags.
                     </p>
                     {itemCategoriesLoadFailed ? (
                       <p role="alert" className="text-sm text-destructive">Could not load item categories. Reopen the Packaging tab to retry.</p>
                     ) : !itemCategories && (
                       <p role="status" className="text-sm text-muted-foreground">Loading item categories…</p>
                     )}

                     {settingsReady && packagingCategoryId && (
                       <div className="space-y-4 pt-4">
                         <Separator />
                         <div>
                           <h3 className="text-sm font-semibold">Available packaging items</h3>
                           <p className="text-sm text-muted-foreground">Paid items use the selling price for the shopper’s market.</p>
                         </div>
                         {storefrontPartsError ? (
                           <p role="alert" className="text-sm text-destructive">Could not load items. Reopen the Packaging tab to retry.</p>
                         ) : storefrontParts?.locationId !== selectedLocationId ? (
                           <p role="status" className="text-sm text-muted-foreground">Loading packaging items…</p>
                         ) : packagingItems.length === 0 ? (
                           <p className="text-sm text-muted-foreground">This category has no active, web-enabled items for this storefront.</p>
                         ) : (
                           <ul className="divide-y rounded-lg border px-4">
                             {packagingItems.map((item) => {
                               const isComplimentary = complimentaryPackagingIds.includes(Number(item.id));
                               return (
                                 <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                                   <div>
                                     <NextLink href={`/inventory/items/${item.id}`} className="text-sm font-medium hover:underline">
                                       {item.part_name}
                                     </NextLink>
                                     <p className="text-sm text-muted-foreground">
                                       Base selling price {formatPackagingPrice.format(Number(item.price))}
                                     </p>
                                   </div>
                                   <div className="flex items-center gap-2">
                                     <Label htmlFor={`complimentary-${item.id}`}>Complimentary</Label>
                                     <Switch
                                       id={`complimentary-${item.id}`}
                                       aria-label={`Complimentary pricing for ${item.part_name}`}
                                       checked={isComplimentary}
                                       disabled={loading}
                                       onCheckedChange={(checked) => setComplimentaryPackagingIds((ids) => checked
                                         ? [...ids, Number(item.id)]
                                         : ids.filter((id) => id !== Number(item.id)))}
                                     />
                                   </div>
                                 </li>
                               );
                             })}
                           </ul>
                         )}

                         <div className="space-y-2">
                           <Label htmlFor="gift-card-item">Handwritten message card</Label>
                           <Select
                             value={giftCardItemId || "none"}
                             onValueChange={(value) => setGiftCardItemId(value === "none" ? "" : value)}
                             disabled={loading || storefrontPartsError || storefrontParts?.locationId !== selectedLocationId}
                           >
                             <SelectTrigger id="gift-card-item" aria-describedby="gift-card-item-help">
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="none">No message card</SelectItem>
                               {giftCardItemId && !packagingItems.some((item) => String(item.id) === giftCardItemId) && (
                                 <SelectItem value={giftCardItemId}>Unavailable item #{giftCardItemId}</SelectItem>
                               )}
                               {packagingItems.map((item) => (
                                 <SelectItem key={item.id} value={String(item.id)}>{item.part_name}</SelectItem>
                               ))}
                             </SelectContent>
                           </Select>
                           <p id="gift-card-item-help" className="text-sm text-muted-foreground">
                             Select the packaging item that shoppers add to enter a handwritten message.
                           </p>
                         </div>
                       </div>
                     )}
                   </CardContent>
                 </Card>
               )}

               {activeTab === 'shipping' && (
                  <Card className="shadow-sm border-muted animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <CardHeader className="bg-muted/5 border-b py-5 px-6">
                        <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                          <Truck className="w-5 h-5 text-primary" /> Shipping Charges
                        </CardTitle>
                        <CardDescription className="text-xs font-medium">Configure how you charge for delivery across your storefront.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-0.5">Delivery message</Label>
                                <Input value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} placeholder="Free island-wide delivery" className="h-11 rounded-lg" />
                                <p className="text-[11px] text-muted-foreground">Shown in the cart, on product pages and on the order confirmation. Leave empty to hide it.</p>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-0.5">Announcement bar</Label>
                                <Input value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} placeholder="Enjoy up to 30% off & free island-wide delivery" className="h-11 rounded-lg" />
                                <p className="text-[11px] text-muted-foreground">The line at the very top of every page. Leave empty to use the default.</p>
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-5 rounded-2xl border-2 border-primary/10 bg-primary/5">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary/10 rounded-xl">
                                    <Truck className="w-6 h-6 text-primary" />
                                </div>
                                <div className="space-y-0.5">
                                    <h3 className="font-bold text-sm">Enable Shipping Charges</h3>
                                    <p className="text-[11px] text-muted-foreground font-medium italic">Apply a flat rate shipping fee to all orders.</p>
                                </div>
                            </div>
                            <Switch 
                                checked={shippingEnabled} 
                                onCheckedChange={setShippingEnabled}
                                className="data-[state=checked]:bg-primary"
                            />
                        </div>

                        {shippingEnabled && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2 animate-in fade-in slide-in-from-top-2 duration-500">
                                <div className="space-y-3">
                                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-[0.15em] ml-0.5">Shipping Method</Label>
                                    <Select value="flat_rate" disabled>
                                        <SelectTrigger className="h-11 rounded-xl bg-muted/10 border-muted/20 font-semibold">
                                            <SelectValue placeholder="Select Method" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="flat_rate">Flat Rate per Order</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-3">
                                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-[0.15em] ml-0.5">Flat Rate Amount (LKR)</Label>
                                    <Input 
                                        type="number"
                                        value={shippingFlatRate} 
                                        onChange={(e) => setShippingFlatRate(e.target.value)} 
                                        placeholder="500" 
                                        className="h-11 rounded-xl bg-background border-muted font-bold text-lg" 
                                    />
                                </div>
                            </div>
                        )}

                        <div className="p-4 rounded-xl border border-dashed border-amber-200 bg-amber-50/50 flex items-start gap-4">
                            <Info className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                            <p className="text-[11px] text-amber-900/70 font-medium leading-relaxed">
                                Currently, we only support a <strong>Global Flat Rate</strong>. Advanced features like zone-based pricing or weight-based shipping are coming in a future update.
                            </p>
                        </div>
                    </CardContent>
                  </Card>
               )}

               {activeTab === 'seo' && (
                  <Card className="shadow-sm border-muted animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <CardHeader className="bg-muted/5 border-b py-5 px-6">
                        <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                          <Globe className="w-5 h-5 text-primary" /> SEO & Social
                        </CardTitle>
                        <CardDescription className="text-xs font-medium">Optimize your store for search engines and social media sharing.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-0.5">Meta Title Prefix</Label>
                          <Input value={metaTitlePrefix} onChange={(e) => setMetaTitlePrefix(e.target.value)} placeholder="Tea Jar Ceylon | " className="h-11 rounded-lg" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-0.5">Facebook Pixel ID</Label>
                          <Input value={fbPixelId} onChange={(e) => setFbPixelId(e.target.value)} placeholder="1234567890" className="h-11 rounded-lg" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-0.5">Google Analytics (G-ID)</Label>
                          <Input value={gaId} onChange={(e) => setGaId(e.target.value)} placeholder="G-XXXXXXXXXX" className="h-11 rounded-lg" />
                        </div>
                    </CardContent>
                  </Card>
               )}

               {activeTab === 'ai' && (
                  <Card className="shadow-sm border-muted animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <CardHeader className="bg-muted/5 border-b py-5 px-6">
                        <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                          <Bot className="w-5 h-5 text-primary" /> AI Assistant (TeaAI)
                        </CardTitle>
                        <CardDescription className="text-xs font-medium">Choose the AI model that answers customers on the website and add its API key.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-8">
                        <div className="flex items-center justify-between p-5 rounded-2xl border-2 border-primary/10 bg-primary/5">
                            <div className="space-y-0.5">
                                <h3 className="font-bold text-sm">Enable TeaAI</h3>
                                <p className="text-[11px] text-muted-foreground font-medium">When off, the website shows a friendly "unavailable" message.</p>
                            </div>
                            <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
                        </div>

                        <div className="space-y-3">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-0.5">Active provider</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {([
                                  { id: "gemini", name: "Google Gemini", hint: "aistudio.google.com/apikey" },
                                  { id: "claude", name: "Anthropic Claude", hint: "console.anthropic.com" },
                                  { id: "openai", name: "OpenAI ChatGPT", hint: "platform.openai.com/api-keys" },
                                ] as const).map((p) => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => setAiProvider(p.id)}
                                    className={`text-left rounded-xl border-2 p-4 transition-colors ${aiProvider === p.id ? "border-primary bg-primary/5" : "border-muted hover:border-primary/40"}`}
                                  >
                                    <span className="block font-bold text-sm">{p.name}</span>
                                    <span className="block text-[11px] text-muted-foreground mt-1">Key from {p.hint}</span>
                                    <span className={`mt-2 inline-block text-[10px] font-bold uppercase tracking-wider ${aiKeys[p.id] ? "text-emerald-600" : "text-muted-foreground"}`}>{aiKeys[p.id] ? "Key saved" : "No key"}</span>
                                  </button>
                                ))}
                            </div>
                        </div>

                        {([
                          { id: "gemini", name: "Gemini", placeholder: "gemini-3.5-flash-lite" },
                          { id: "claude", name: "Claude", placeholder: "claude-haiku-5-5" },
                          { id: "openai", name: "ChatGPT", placeholder: "gpt-5-mini" },
                        ] as const).map((p) => (
                          <div key={p.id} className={`grid grid-cols-1 md:grid-cols-2 gap-6 rounded-xl border p-5 ${aiProvider === p.id ? "border-primary/40" : "opacity-80"}`}>
                              <div className="space-y-2">
                                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-0.5">{p.name} API key</Label>
                                  <Input
                                    type="password"
                                    autoComplete="off"
                                    value={aiKeys[p.id]}
                                    onFocus={(e) => { if (e.target.value.startsWith("\u2022\u2022\u2022\u2022")) setAiKeys((k) => ({ ...k, [p.id]: "" })); }}
                                    onChange={(e) => setAiKeys((k) => ({ ...k, [p.id]: e.target.value }))}
                                    placeholder="Paste the API key"
                                    className="h-11 rounded-lg font-mono"
                                  />
                                  <p className="text-[11px] text-muted-foreground">Stored on the ERP only. A saved key shows as dots with its last 4 characters.</p>
                              </div>
                              <div className="space-y-2">
                                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-0.5">{p.name} model</Label>
                                  <Input value={aiModels[p.id]} onChange={(e) => setAiModels((m) => ({ ...m, [p.id]: e.target.value }))} placeholder={p.placeholder} className="h-11 rounded-lg font-mono" />
                                  <p className="text-[11px] text-muted-foreground">Leave empty to use {p.placeholder}.</p>
                              </div>
                          </div>
                        ))}

                        <div className="space-y-2 rounded-xl border border-dashed p-5">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-0.5">Website connection secret</Label>
                            <div className="flex gap-2">
                                <Input readOnly value={aiServerSecret} placeholder="Generate a secret" className="h-11 rounded-lg font-mono" />
                                <Button type="button" variant="outline" className="h-11" onClick={() => {
                                    const bytes = new Uint8Array(24);
                                    crypto.getRandomValues(bytes);
                                    setAiServerSecret(Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(""));
                                }}><RefreshCw className="w-4 h-4 mr-2" /> Generate</Button>
                                <Button type="button" variant="outline" className="h-11" aria-label="Copy secret" disabled={!aiServerSecret} onClick={() => navigator.clipboard?.writeText(aiServerSecret)}><Copy className="w-4 h-4" /></Button>
                            </div>
                            <p className="text-[11px] text-muted-foreground">Only the website server can read the AI key. Put this value in the website .env.local as <code>ERP_SERVER_SECRET=...</code> and save here.</p>
                        </div>
                    </CardContent>
                  </Card>
               )}

               {activeTab === 'legals' && (
                  <Card className="shadow-sm border-muted animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <CardHeader className="bg-muted/5 border-b py-5 px-6">
                        <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
                          <ShieldCheck className="w-5 h-5 text-primary" /> Legal Policies
                        </CardTitle>
                        <CardDescription className="text-xs font-medium">Manage your storefront's legal agreements and privacy terms.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-0.5">Terms of Service</Label>
                          <textarea 
                            value={termsOfService}
                            onChange={(e) => setTermsOfService(e.target.value)}
                            className="w-full h-32 rounded-xl border bg-background text-sm font-medium p-4 focus:ring-1 focus:ring-primary focus:outline-none resize-none" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-0.5">Privacy Policy</Label>
                          <textarea 
                            value={privacyPolicy}
                            onChange={(e) => setPrivacyPolicy(e.target.value)}
                            className="w-full h-32 rounded-xl border bg-background text-sm font-medium p-4 focus:ring-1 focus:ring-primary focus:outline-none resize-none" 
                          />
                        </div>
                    </CardContent>
                  </Card>
               )}

               <div className="flex items-center justify-center gap-4 py-6 border-t border-dashed">
                  <p className="text-xs font-semibold text-muted-foreground">Admin Actions:</p>
                  <Button variant="ghost" className="text-destructive font-bold text-[10px] uppercase tracking-widest hover:bg-destructive/10 rounded-lg px-4 h-9">Reset Storefront Data</Button>
               </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
            <div className={`p-8 flex flex-col items-center text-center gap-4 ${
                dialogStatus.type === 'success' ? 'bg-emerald-50' : 
                dialogStatus.type === 'error' ? 'bg-red-50' : 'bg-blue-50'
            }`}>
                <div className={`p-4 rounded-full ${
                    dialogStatus.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 
                    dialogStatus.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                }`}>
                    {dialogStatus.type === 'success' && <CheckCircle2 className="w-8 h-8" />}
                    {dialogStatus.type === 'error' && <XCircle className="w-8 h-8" />}
                    {dialogStatus.type === 'info' && <Info className="w-8 h-8" />}
                </div>
                <div className="space-y-2">
                    <DialogTitle className={`text-xl font-bold tracking-tight ${
                        dialogStatus.type === 'success' ? 'text-emerald-900' : 
                        dialogStatus.type === 'error' ? 'text-red-900' : 'text-blue-900'
                    }`}>
                        {dialogStatus.title}
                    </DialogTitle>
                    <DialogDescription className="text-sm font-medium text-muted-foreground leading-relaxed">
                        {dialogStatus.message}
                    </DialogDescription>
                </div>
            </div>
            <div className="p-4 bg-white flex justify-center">
                <Button 
                    onClick={() => setShowDialog(false)}
                    className={`w-full max-w-[200px] h-11 rounded-xl font-bold uppercase text-[11px] tracking-widest shadow-sm ${
                        dialogStatus.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 
                        dialogStatus.type === 'error' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                >
                    Dismiss
                </Button>
            </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showTestEmailDialog} onOpenChange={setShowTestEmailDialog}>
        <DialogContent className="sm:max-w-[400px] p-6 rounded-2xl">
            <DialogHeader className="mb-4">
                <DialogTitle className="text-xl font-bold tracking-tight">Test SMTP Connection</DialogTitle>
                <DialogDescription className="text-sm font-medium">
                    Enter the recipient email address where you want to send the test message.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Recipient Email Address</Label>
                    <Input 
                        value={testEmailRecipient} 
                        onChange={(e) => setTestEmailRecipient(e.target.value)} 
                        placeholder="your-email@example.com"
                        className="h-11 rounded-lg border-muted/20"
                        autoFocus
                    />
                </div>
                <div className="flex gap-3 pt-2">
                    <Button 
                        variant="ghost" 
                        onClick={() => setShowTestEmailDialog(false)}
                        className="flex-1 h-11 rounded-xl font-bold uppercase text-[10px] tracking-widest"
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={runSmtpTest}
                        disabled={!testEmailRecipient}
                        className="flex-1 h-11 rounded-xl font-bold uppercase text-[10px] tracking-widest"
                    >
                        Send Test Email
                    </Button>
                </div>
            </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
