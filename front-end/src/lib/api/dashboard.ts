import { api } from './client';

export interface DashboardOverview {
  ordersByStatus: Record<string, number>;
  completedToday: number;
  avgRepairHours: number;
  serviceBaysByStatus: Record<string, number>;
  serviceBaysTotal: number;
  throughputLast7Days: Array<{ date: string; received: number; completed: number }>;
  urgentAttention: Array<any>;
  recentCompletions: Array<any>;
}

export interface SalesDashboardData {
  metrics?: any;
  chartData?: any;
  topSellers?: any;
  recentTransactions?: any;
  kpis?: {
    totalRevenue: number;
    orderCount: number;
    avgOrderValue: number;
    grossProfit: number;
    today?: { totalRevenue: number; orderCount: number; revenue?: number; count?: number };
    month?: { totalRevenue: number; orderCount: number; revenue?: number; collection?: number };
    outstanding?: number;
  };
  revenueTrend?: Array<{ date: string; amount: number; revenue?: number }>;
  paymentMethods?: Array<{ method: string; amount: number }>;
  topItems?: Array<{ name: string; qty: number; revenue: number }>;
  recentSales?: Array<any>;
}

export const fetchDashboardOverview = async () => {
  const res = await api('/api/dashboard/overview');
  if (!res.ok) throw new Error('Failed to load dashboard overview');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};

export const fetchSalesDashboard = async () => {
  const res = await api('/api/dashboard/sales');
  if (!res.ok) throw new Error('Failed to load sales dashboard data');
  const data = await res.json();
  return data.status === 'success' ? data.data : data;
};
