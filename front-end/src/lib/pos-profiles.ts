/**
 * POS profiles: one POS engine, a different setup per kind of business.
 * Chosen per location (service_locations.pos_profile). Locations without a value use "classic",
 * the POS as it always was. The server keeps the same list (PosFloorSchema::PROFILES).
 */
export type PosProfileKey =
  | "classic" | "restaurant" | "supermarket" | "mini" | "pharmacy" | "hardware" | "phone" | "workshop";

/** A detail the cashier fills in for the whole bill; saved in the invoice notes and printed. */
export interface BillField {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}

export interface PosProfile {
  key: PosProfileKey;
  label: string;
  description: string;
  /** Dine-in tables are picked on the floor plan (or as cards) */
  floorPlan: boolean;
  /** Start every bill in this order type, without the order-type popup */
  defaultOrderType?: "retail";
  /** Scanning a barcode adds the item straight to the cart (unless the cashier changed it) */
  scanFirst?: boolean;
  /** Use the compact screen layout unless the cashier picked one */
  forceCompact?: boolean;
  /** Each item line needs an IMEI / serial number (one per unit) and can carry a warranty */
  serials?: boolean;
  billFields: BillField[];
}

export const POS_PROFILES: PosProfile[] = [
  {
    key: "classic", label: "Classic", description: "The standard POS: item grid and cart, for any business.",
    floorPlan: false, billFields: [],
  },
  {
    key: "restaurant", label: "Restaurant / Hotel", description: "Dine-in on a floor plan or table cards, with take-away and KOT.",
    floorPlan: true, billFields: [],
  },
  {
    key: "supermarket", label: "Supermarket", description: "Scan-first checkout: every bill starts as a retail sale and scans go straight to the cart.",
    floorPlan: false, defaultOrderType: "retail", scanFirst: true, billFields: [],
  },
  {
    key: "mini", label: "Mini POS", description: "Small shops and tablets: compact screen, no order-type step, quick cash sales.",
    floorPlan: false, defaultOrderType: "retail", scanFirst: true, forceCompact: true, billFields: [],
  },
  {
    key: "pharmacy", label: "Pharmacy", description: "Patient, doctor and prescription number on the bill; batch and expiry are picked per item.",
    floorPlan: false, defaultOrderType: "retail", scanFirst: true,
    billFields: [
      { key: "patient", label: "Patient", placeholder: "Patient name" },
      { key: "doctor", label: "Doctor", placeholder: "Prescribing doctor" },
      { key: "rx", label: "Prescription no", placeholder: "Rx number" },
    ],
  },
  {
    key: "hardware", label: "Hardware", description: "Site / project, customer PO and vehicle for delivery on the bill.",
    floorPlan: false, defaultOrderType: "retail",
    billFields: [
      { key: "site", label: "Site / Project", placeholder: "Where it's going" },
      { key: "po", label: "Customer PO", placeholder: "PO number" },
      { key: "delivery", label: "Delivery vehicle", placeholder: "Vehicle no" },
    ],
  },
  {
    key: "phone", label: "Phone shop", description: "IMEI / serial number for every handset sold, with warranty on the bill.",
    floorPlan: false, defaultOrderType: "retail", scanFirst: true, serials: true, billFields: [],
  },
  {
    key: "workshop", label: "Workshop / Automotive", description: "Vehicle number, mileage and job number on every bill; parts and labour together.",
    floorPlan: false, defaultOrderType: "retail",
    billFields: [
      { key: "vehicle", label: "Vehicle no", placeholder: "e.g. CAB-1234", required: true },
      { key: "mileage", label: "Mileage (km)", placeholder: "Odometer" },
      { key: "job", label: "Job no", placeholder: "Repair order / job card" },
    ],
  },
];

export const WARRANTY_OPTIONS = ["", "No warranty", "3 months", "6 months", "1 year", "2 years"];

export function posProfileOf(location: { pos_profile?: string | null } | null | undefined): PosProfile {
  return POS_PROFILES.find((p) => p.key === location?.pos_profile) || POS_PROFILES[0];
}

/** "Patient: A. Silva · Doctor: Dr. Perera" from the bill details that were filled in. */
export function billFieldsText(profile: PosProfile, values: Record<string, string>): string {
  return profile.billFields
    .map((f) => (values[f.key]?.trim() ? `${f.label}: ${values[f.key].trim()}` : ""))
    .filter(Boolean)
    .join(" · ");
}

/** Line note sent with the invoice: cashier's note + IMEI/serials + warranty. */
export function lineNotesWithSerials(line: { item_notes?: string; serials?: string; warranty?: string }): string | null {
  const parts = [
    line.item_notes?.trim(),
    line.serials?.trim() ? `IMEI/SN: ${line.serials.trim()}` : "",
    line.warranty && line.warranty !== "No warranty" ? `Warranty: ${line.warranty}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" | ") : null;
}

/** How many serial numbers a line has (comma, space or new line separated). */
export function serialCount(serials?: string): number {
  return (serials || "").split(/[\s,;]+/).filter(Boolean).length;
}
