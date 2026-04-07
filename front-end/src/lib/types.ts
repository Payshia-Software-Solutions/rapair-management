export type Priority = 'Emergency' | 'High' | 'Medium' | 'Low';
export type RepairStatus = 'Pending' | 'In Progress' | 'Completed';
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
