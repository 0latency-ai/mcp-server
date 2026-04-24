/**
 * server-sse.ts — HTTP/SSE transport entry point
 * Imports unified tools and registers them with StreamableHTTP transport
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
//# sourceMappingURL=server-sse.d.ts.map