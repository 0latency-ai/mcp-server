/**
 * api.ts — Unified HTTP client for 0Latency Memory API
 *
 * Handles both authentication models:
 * - HTTP/SSE: API key from per-request context
 * - stdio: API key from environment variable
 */
export interface ApiOptions {
    method?: string;
    path: string;
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
    apiKey?: string;
}
/**
 * Make an HTTP request to the 0Latency API
 * Auth: Uses apiKey parameter if provided, otherwise falls back to env var
 */
export declare function api<T = unknown>(opts: ApiOptions): Promise<T>;
/**
 * Get tenant_id from API key (used for SSE subscription routing)
 */
export declare function getTenantId(apiKey: string): Promise<string | null>;
/**
 * Helper: Check if memories exist under other agent_ids (cross-agent hint)
 */
export declare function checkCrossAgentHint(apiKey: string, usedAgentId: string): Promise<string | null>;
//# sourceMappingURL=api.d.ts.map