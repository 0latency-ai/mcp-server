#!/usr/bin/env node
/**
 * server-stdio.ts — stdio transport entry point
 * Imports unified tools and registers them with stdio transport
 */
import { z } from "zod";
export declare const configSchema: z.ZodObject<{
    apiKey: z.ZodString;
    agentId: z.ZodOptional<z.ZodString>;
    budgetTokens: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    dynamicBudget: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    apiKey: string;
    agentId?: string | undefined;
    budgetTokens?: number | undefined;
    dynamicBudget?: boolean | undefined;
}, {
    apiKey: string;
    agentId?: string | undefined;
    budgetTokens?: number | undefined;
    dynamicBudget?: boolean | undefined;
}>;
//# sourceMappingURL=server-stdio.d.ts.map