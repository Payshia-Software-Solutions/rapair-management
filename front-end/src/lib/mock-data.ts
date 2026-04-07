import { RepairOrder, UserRole } from './types';

export const INITIAL_REPAIR_ORDERS: RepairOrder[] = [
  {
    id: 'RO-1001',
    vehicleId: 'CAR-1234',
    mileage: 45000,
    priority: 'High',
    expectedTime: '2024-05-20T14:00',
    problemDescription: 'Brake squeaking and soft pedal feel.',
    checklist: ['Check brake fluid', 'Inspect brake pads', 'Check rotors'],
    categories: ['Brake System'],
    comments: 'Customer reported long stopping distance.',
    status: 'Pending',
    createdAt: '2024-05-19T09:00',
  },
  {
    id: 'RO-1002',
    vehicleId: 'TRK-5678',
    mileage: 120000,
    priority: 'Emergency',
    expectedTime: '2024-05-19T17:00',
    problemDescription: 'Engine overheating on highways.',
    checklist: ['Check coolant level', 'Inspect radiator', 'Check thermostat'],
    categories: ['Engine System', 'Cooling System'],
    comments: 'Sudden breakdown on I-95.',
    status: 'In Progress',
    createdAt: '2024-05-19T08:30',
    location: 'Bay 1',
    technician: 'John Smith',
    proposedTime: '2024-05-19T18:00',
  },
  {
    id: 'RO-1003',
    vehicleId: 'VAN-9012',
    mileage: 85000,
    priority: 'Low',
    expectedTime: '2024-05-21T10:00',
    problemDescription: 'Annual maintenance and oil change.',
    checklist: ['Change oil', 'Rotate tires', 'Top up fluids'],
    categories: ['General Service'],
    comments: 'Planned maintenance.',
    status: 'Pending',
    createdAt: '2024-05-19T10:00',
  }
];

export const TECHNICIANS = [
  'John Smith',
  'Sarah Johnson',
  'Mike Ross',
  'Emily Davis',
  'David Wilson'
];

export const BAYS: string[] = [
  'Bay 1', 'Bay 2', 'Bay 3', 'Bay 4', 'Bay 5', 'Bay 6', 'Bay 7', 'Bay 8', 'Bay 9', 'Outside'
];

// Mock current user session for prototype
export const MOCK_USER = {
  name: 'First Officer',
  role: 'Admin' as UserRole,
  email: 'officer@servicebay.com'
};
