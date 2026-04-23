/**
 * hardening.ts — Transport-agnostic hardening layers
 *
 * Includes:
 * - Rate limiting (30/min for memory_write)
 * - Content dedup (60s window)
 * - Active profiling (first 5 conversations — full pattern library)
 * - Sentinel DLP (format warnings for detected secrets)
 */
export declare function checkRateLimit(key: string): boolean;
export declare function checkDedup(content: string, agentId: string): string | null;
export declare function recordDedup(content: string, agentId: string, memoryId: string): void;
/**
 * Run active profiling on a conversation turn. Called after memory_add.
 * Non-blocking, fire-and-forget — errors are silently logged.
 * Adapted for unified codebase: takes apiKey for API auth.
 */
export declare function runActiveProfiler(apiKey: string, agentId: string, humanMessage: string, sessionKey?: string): Promise<void>;
export interface SentinelFinding {
    pattern_name: string;
    pattern_category: string;
    confidence: string;
    redacted: string;
}
export interface SentinelResponse {
    detected?: SentinelFinding[];
    action?: string;
    secrets_found?: number;
}
export declare function formatSentinelWarning(sentinel: SentinelResponse): string;
export declare function appendSentinelWarning(baseText: string, apiResult: any): string;
//# sourceMappingURL=hardening.d.ts.map