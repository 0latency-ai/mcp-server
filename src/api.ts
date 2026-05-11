/**
 * api.ts — Unified HTTP client for 0Latency Memory API
 *
 * Handles both authentication models:
 * - HTTP/SSE: API key from per-request context
 * - stdio: API key from environment variable
 *
 * CP9 Phase 2 Track B2: Error envelope parsing support
 */

const BASE_URL = (
  process.env.ZERO_LATENCY_API_URL ?? "https://api.0latency.ai"
).replace(/\/+$/, "");

export interface ApiOptions {
  method?: string;
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  apiKey?: string; // Optional for stdio (uses env), required for SSE
}

/**
 * CP9 Phase 2 Track B2: Standardized error envelope structure
 */
export interface APIError {
  code: string;
  message: string;
  hint: string;
  docs_url: string;
}

export interface ErrorEnvelope {
  detail: {
    error: APIError;
  };
}

/**
 * Format API error from envelope or legacy format
 * Returns formatted error message with hint and docs link
 */
function formatAPIError(errorData: any): string {
  // Handle legacy plain string format
  if (typeof errorData === 'string') {
    return errorData;
  }

  // Try parsing new error envelope format
  try {
    const error = errorData?.detail?.error;
    if (error && typeof error === 'object') {
      let msg = `Error: ${error.message}`;

      if (error.hint) {
        msg += `\n💡 ${error.hint}`;
      }

      if (error.docs_url) {
        msg += `\n📖 ${error.docs_url}`;
      }

      return msg;
    }
  } catch {
    // Fallback to JSON stringification
  }

  // Fallback: stringify the error data
  return JSON.stringify(errorData);
}

/**
 * Make an HTTP request to the 0Latency API
 * Auth: Uses apiKey parameter if provided, otherwise falls back to env var
 */
export async function api<T = unknown>(opts: ApiOptions): Promise<T> {
  // Determine API key: explicit param > environment variable
  const apiKey = opts.apiKey ?? process.env.ZERO_LATENCY_API_KEY ?? "";
  
  if (!apiKey) {
    throw new Error("API key required: provide via apiKey parameter or ZERO_LATENCY_API_KEY env var");
  }

  const url = new URL(opts.path, BASE_URL);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }

  const res = await fetch(url.toString(), {
    method: opts.method ?? "GET",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();

  if (!res.ok) {
    // Try to parse error envelope (CP9 Phase 2 Track B2)
    let errorData: any;
    try {
      errorData = JSON.parse(text);
    } catch {
      errorData = text;
    }

    throw new Error(`0Latency API ${res.status}: ${formatAPIError(errorData)}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

/**
 * Get tenant_id from API key (used for SSE subscription routing)
 */
export async function getTenantId(apiKey: string): Promise<string | null> {
  try {
    const result = await api<{ id: string }>({
      apiKey,
      path: "/tenant-info",
    });
    return result?.id || null;
  } catch (err) {
    console.error("[Tenant fetch] Failed:", err);
    return null;
  }
}

/**
 * Helper: Check if memories exist under other agent_ids (cross-agent hint)
 */
export async function checkCrossAgentHint(
  apiKey: string,
  usedAgentId: string
): Promise<string | null> {
  try {
    const agentsResp = await api<{ agents?: Array<{ agent_id: string; memory_count: number }> }>({
      apiKey,
      method: "GET",
      path: "/agents",
    });

    if (agentsResp?.agents && agentsResp.agents.length > 1) {
      const otherAgents = agentsResp.agents.filter(
        (a) => a.agent_id !== usedAgentId && a.memory_count > 0
      );

      if (otherAgents.length > 0) {
        const topAgent = otherAgents[0];
        const totalOtherMemories = otherAgents.reduce(
          (sum, a) => sum + a.memory_count,
          0
        );

        return `

⚠️  No memories found for agent_id '${usedAgentId}'. This tenant has ${totalOtherMemories} memories under other agent_ids, with ${topAgent.memory_count} under '${topAgent.agent_id}'. To access those memories, either pass agent_id='${topAgent.agent_id}' explicitly, or set it as default via the API.`;
      }
    }

    return null;
  } catch (err) {
    console.error("Failed to check cross-agent hint:", err);
    return null;
  }
}
