export type Priority = 'Emergency' | 'High' | 'Medium' | 'Low';
export type RepairStatus = 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
export type BayLocation = 'Bay 1' | 'Bay 2' | 'Bay 3' | 'Bay 4' | 'Bay 5' | 'Bay 6' | 'Bay 7' | 'Bay 8' | 'Bay 9' | 'Outside';

export type UserRole = 'Admin' | 'Workshop Officer' | 'Factory Officer';

export interface CategoryCompletion {
  name: string;
  comment?: string;
}

export interface RepairOrder {
  id: string;
  vehicleId: string;
  mileage: number;
  priority: Priority;
  expectedTime: string;
  problemDescription: string;
  checklist: string[];
  categories: string[];
  attachments?: string[];
  comments: string;
  status: RepairStatus;
  createdAt: string;
  location?: BayLocation;
  technician?: string;
  proposedTime?: string;
  completedAt?: string;
  completionComments?: string;
  completedCategories?: CategoryCompletion[];
}

export const REPAIR_CATEGORIES = [
  'Engine System',
  'Brake System',
  'Suspension',
  'Electrical',
  'Transmission',
  'Cooling System',
  'Exhaust',
  'Tires & Wheels',
  'Oil & Filter',
  'Interior/AC'
];
export interface Vehicle {
  id: number;
  department_id?: number | null;
  make: string;
  model: string;
  year: number;
  vin: string;
  image_filename?: string | null;
  created_at: string;
}

export interface VehicleMake {
  id: number;
  name: string;
  created_at: string;
}

export interface VehicleModel {
  id: number;
  make_id: number;
  make_name: string;
  name: string;
  created_at: string;
}
