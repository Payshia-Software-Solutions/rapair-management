'use server';
/**
 * @fileOverview An AI agent that suggests relevant repair categories and checklist items for vehicle repair orders.
 *
 * - suggestRepairDetails - A function that handles the suggestion process.
 * - SuggestRepairDetailsInput - The input type for the suggestRepairDetails function.
 * - SuggestRepairDetailsOutput - The return type for the suggestRepairDetails function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestRepairDetailsInputSchema = z.object({
  problemDescription: z
    .string()
    .describe('A detailed description of the vehicle\'s problem.'),
});
export type SuggestRepairDetailsInput = z.infer<
  typeof SuggestRepairDetailsInputSchema
>;

const SuggestRepairDetailsOutputSchema = z.object({
  categories: z
    .array(z.string())
    .describe('Suggested repair categories (e.g., Engine System, Brake, Suspension).'),
  checklistItems: z
    .array(z.string())
    .describe(
      'Suggested checklist items for the repair (e.g., Check fluid levels, Inspect brake pads, Test battery).'
    ),
});
export type SuggestRepairDetailsOutput = z.infer<
  typeof SuggestRepairDetailsOutputSchema
>;

export async function suggestRepairDetails(
  input: SuggestRepairDetailsInput
): Promise<SuggestRepairDetailsOutput> {
  return suggestRepairDetailsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestRepairDetailsPrompt',
  input: {schema: SuggestRepairDetailsInputSchema},
  output: {schema: SuggestRepairDetailsOutputSchema},
  prompt: `You are an expert vehicle repair technician and helpful assistant.

Based on the following problem description, suggest relevant repair categories and specific checklist items that a mechanic should inspect or perform.

Problem Description: {{{problemDescription}}}`,
});

const suggestRepairDetailsFlow = ai.defineFlow(
  {
    name: 'suggestRepairDetailsFlow',
    inputSchema: SuggestRepairDetailsInputSchema,
    outputSchema: SuggestRepairDetailsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
