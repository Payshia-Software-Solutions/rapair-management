'use server';

import { bizflowInsightsFlow } from '@/ai/flows/bizflow-insights-flow';
import { suggestRepairDetails } from '@/ai/flows/suggest-repair-details-flow';

export async function getBizFlowAiInsight(question: string) {
    try {
        const result = await bizflowInsightsFlow({ question });
        return { 
            success: true, 
            answer: result.answer, 
            sql: result.sql, 
            thoughts: result.thoughts,
            retryCount: result.retryCount
        };
    } catch (error: any) {
        console.error('AI Insight Error:', error);
        return { success: false, error: error.message || 'Failed to get AI insight' };
    }
}

export async function getRepairSuggestions(problemDescription: string) {
    try {
        const result = await suggestRepairDetails({ problemDescription });
        return { success: true, data: result };
    } catch (error: any) {
        console.error('Repair Suggestion Error:', error);
        return { success: false, error: error.message || 'Failed to get repair suggestions' };
    }
}
