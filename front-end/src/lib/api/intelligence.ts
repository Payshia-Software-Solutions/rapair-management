import { api } from './client';

export interface BusinessSnapshot {
    month_revenue: number;
    month_expenses: number;
    net_profit_margin: number;
    active_repairs: number;
    low_stock_alerts: number;
    currency: string;
}

export interface ForecastData {
    historical: { x: number; y: number; month: string }[];
    predicted_next_month: number;
    trend: 'Upward' | 'Downward';
    growth_rate: number;
}

export const fetchBusinessSnapshot = async () => {
    const res = await api('/api/intelligence/snapshot');
    const data = await res.json();
    return data.data as BusinessSnapshot;
};

export const fetchRevenueForecast = async () => {
    const res = await api('/api/intelligence/forecast');
    const data = await res.json();
    return data.data as ForecastData;
};

export const fetchInventoryIntelligence = async () => {
    const res = await api('/api/intelligence/inventory');
    const data = await res.json();
    return data.data as any;
};

export const fetchSalesAnalysis = async () => {
    const res = await api('/api/intelligence/sales_analysis');
    const data = await res.json();
    return data.data as any;
};

export const fetchCustomerInsights = async () => {
    const res = await api('/api/intelligence/customers');
    const data = await res.json();
    return data.data as any;
};

export const fetchFinancialHealth = async () => {
    const res = await api('/api/intelligence/financial_health');
    const data = await res.json();
    return data.data as any;
};

export const askAiAssistant = async (query: string) => {
    // Simulated natural language processing for now
    // In production, this would hit an LLM endpoint
    const res = await api('/api/intelligence/query', {
        method: 'POST',
        body: JSON.stringify({ query })
    });
    return res.json();
};
