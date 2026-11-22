'use server';

import { suggestRepairDetails } from '@/ai/flows/suggest-repair-details-flow';

// Business Intelligence moved to the ERP server: see getBizFlowAiInsight in lib/api/intelligence.ts.

export async function getRepairSuggestions(problemDescription: string) {
    try {
        const result = await suggestRepairDetails({ problemDescription });
        return { success: true, data: result };
    } catch (error: any) {
        console.error('Repair Suggestion Error:', error);
        return { success: false, error: error.message || 'Failed to get repair suggestions' };
    }
}
