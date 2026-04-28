'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

import fs from 'fs';
import path from 'path';

// Helper to log from server-side Next.js
const logToFile = (msg: string) => {
    const logPath = 'c:\\xampp\\htdocs\\rapair-management\\front-end\\ai_debug.log';
    const timestamp = new Date().toISOString();
    try {
        fs.appendFileSync(logPath, `[${timestamp}] ${msg}\n`);
    } catch (e) {
        console.error("LOGGING FAILED", e);
    }
};

// Secure Server-side API for PHP Backend
const serverApi = async (urlPath: string, options: any = {}) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1/rapair-management/server/public';
    const fullUrl = `${baseUrl}${urlPath}`;
    logToFile(`API REQUEST: ${fullUrl}`);
    
    const response = await fetch(fullUrl, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'X-AI-SECRET': 'super-secret-ai-token-123',
            ...options.headers
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        logToFile(`API ERROR [${response.status}]: ${errorText.substring(0, 200)}`);
        throw new Error(`PHP Server Error: ${errorText.replace(/<[^>]*>?/gm, '').substring(0, 500)}`);
    }

    const data = await response.json();
    logToFile(`API RESPONSE [SUCCESS]: ${JSON.stringify(data).substring(0, 200)}`);
    return data;
};

// OpenRouter API Call
async function callOpenRouter(messages: any[]) {
    if (!OPENROUTER_API_KEY) {
        throw new Error("OPENROUTER_API_KEY is missing in .env file.");
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3000', // Required by OpenRouter
            'X-Title': 'BizFlow AI' // Required by OpenRouter
        },
        body: JSON.stringify({
            model: 'openai/gpt-oss-120b',
            messages,
            temperature: 0.1
        })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    return data.choices[0].message.content;
}

const InsightsInputSchema = z.object({
    question: z.string().describe('The user question about company data.'),
});

const InsightsOutputSchema = z.object({
    answer: z.string().describe('The natural language answer based on data.'),
});

export const bizflowInsightsFlow = ai.defineFlow(
    {
        name: 'bizflowInsightsFlow',
        inputSchema: InsightsInputSchema,
        outputSchema: InsightsOutputSchema,
    },
    async (input) => {
        // Step 1: Get Schema
        const schemaRes = await serverApi('/api/intelligence/schema');
        const schemaInfo = JSON.stringify(schemaRes.data);
        console.log(`[AI-INSIGHT] Schema Context: ${schemaInfo}`);

        // Step 2: Ask Groq to generate Reasoning + SQL
        const sqlPrompt = [
            {
                role: 'system',
                content: `You are a Senior SQL Analyst. You MUST follow this EXACT protocol:
                STEP 1: Identify the tables needed for the question.
                STEP 2: For each table, LIST every column you intend to use from the SCHEMA below.
                STEP 3: If a column (like 'date') is not in the schema, look for the correct one (like 'issue_date').
                STEP 4: Explain your join logic if multiple tables are used.
                STEP 5: Write the final MySQL query.

                Guidelines:
                - CRITICAL: This is a READ-ONLY system. NEVER attempt to 'INSERT', 'UPDATE', or 'DELETE' data.
                - NEVER try to 'test' the connection by inserting data.
                - If a query returns no results, it just means no records match. Do NOT assume the table is empty.
                - The database currently HAS data (invoices, customers, parts are populated).
                - Use BACKTICKS (\`).
                - Process: LOOKUP -> VERIFY -> REASON -> SQL.

                Output format:
                THOUGHTS: 
                - Tables Needed: [names]
                - Column Lookup Checklist: [List of verified columns from schema]
                - Reasoning: [Explanation]
                SQL: [The SQL query here]`
            },
            {
                role: 'user',
                content: `DATABASE SCHEMA:
                ${schemaInfo}

                USER QUESTION: ${input.question}`
            }
        ];

        // --- SELF-HEALING SQL LOOP ---
        let currentSql = "";
        let currentThoughts = "";
        let dataResult = "No data found.";
        let retryCount = 0;
        const maxRetries = 3; // Limited to 3 attempts per user request
        const history = [...sqlPrompt];

        while (retryCount <= maxRetries) {
            const rawAiOutput = await callOpenRouter(history);
            
            // Parsing logic
            const thoughtsMatch = rawAiOutput.match(/THOUGHTS:([\s\S]*?)SQL:/i);
            const sqlMatch = rawAiOutput.match(/SQL:([\s\S]*)/i);

            currentThoughts = thoughtsMatch ? thoughtsMatch[1].trim() : "Analyzing schema and generating query...";
            const generatedSql = sqlMatch ? sqlMatch[1].trim() : rawAiOutput;
            
            // Aggressive cleaning of markdown artifacts (like ** at the start)
            currentSql = generatedSql
                .replace(/```sql/gi, '')
                .replace(/```/gi, '')
                .replace(/^\*\*+/g, '') // Remove leading **
                .replace(/\*\*+$/g, '') // Remove trailing **
                .trim();
            
            console.log(`[AI-INSIGHT] Attempt ${retryCount + 1} SQL: ${currentSql}`);

            // Execute SQL via PHP Backend
            try {
                const queryRes = await serverApi('/api/intelligence/query', {
                    method: 'POST',
                    body: JSON.stringify({ sql: currentSql })
                });
                
                if (queryRes.status === 'success') {
                    console.log(`[AI-INSIGHT] Backend Success:`, JSON.stringify(queryRes.data));
                    dataResult = JSON.stringify(queryRes.data);
                    if (queryRes.data && (Array.isArray(queryRes.data) ? queryRes.data.length > 0 : true)) {
                        break; // EXIT LOOP ON ACTUAL DATA
                    } else {
                        console.warn(`[AI-INSIGHT] Query returned empty results.`);
                        error = "Empty results returned by the database.";
                    }
                } else {
                    const errorMsg = queryRes.message || "Query failed.";
                    console.warn(`[AI-INSIGHT] Attempt ${retryCount + 1} Failed: ${errorMsg}`);
                    
                    if (retryCount < maxRetries) {
                        history.push({ role: 'assistant', content: rawAiOutput });
                        history.push({ 
                            role: 'user', 
                            content: `ERROR: The previous SQL failed with this message: "${errorMsg}". Please correct the SQL query using the correct column names from the schema provided earlier and try again.` 
                        });
                    } else {
                        dataResult = errorMsg;
                    }
                }
            } catch (e) {
                console.error(`[AI-INSIGHT] Connection Error: ${e}`);
                dataResult = "Error connecting to the database.";
                break;
            }
            retryCount++;
        }

        // Step 4: Ask Groq to summarize the data
        const summaryPrompt = [
            {
                role: "system",
                content: `You are BizFlow AI, a professional business analyst for an ERP system. 
                Summarize the data results provided below to answer the user's question.
                
                FORMATTING RULES:
                1. Use professional Markdown with SINGLE pipes for tables.
                2. Use TABLES for lists. Ensure each row is on a new line.
                3. Use BOLD for key metrics. Always use LKR for currency (e.g., LKR 50,000).
                4. Be friendly and professional. Use emojis like 📊 or ✅ where appropriate.
                
                CHART SUGGESTION:
                If the data has 2+ numeric values that compare categories, add a JSON chart block at the very end of your response:
                \`\`\`chart
                {"type":"bar","title":"Chart Title (LKR)","data":[{"name":"Label A","value":100},{"name":"Label B","value":200}]}
                \`\`\`
                Valid types: "bar", "line", "pie". Always use LKR for money values in charts.`
            },
            {
                role: "user",
                content: `User Question: ${input.question}\n\nData Results from Database:\n${dataResult}`
            }
        ];

        const finalAnswer = await callOpenRouter(summaryPrompt);

        return {
            answer: finalAnswer,
            sql: currentSql,
            thoughts: currentThoughts,
            retryCount: retryCount
        };
    }
);
