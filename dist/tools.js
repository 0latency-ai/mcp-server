/**
 * tools.ts — All 14 MCP tool definitions (unified from HTTP/SSE + stdio)
 *
 * Tool list:
 * 1. memory_add
 * 2. memory_write (CP7a - rate limited + dedup)
 * 3. memory_recall
 * 4. memory_search
 * 5. memory_list
 * 6. memory_delete
 * 7. list_agents
 * 8. memory_history
 * 9. memory_graph_traverse → GET /graph/entity
 * 10. memory_entities → GET /graph/entities
 * 11. memory_by_entity → GET /graph/entity/memories
 * 12. import_document
 * 13. import_conversation
 * 14. memory_feedback
 *
 * REMOVED (per brief): remember, seed_memories, memory_sentiment_summary, load_memory_pack
 *
 * Graph path fixes applied (stdio old paths → actual API endpoints):
 * - memory_graph_traverse: /memories/graph → /graph/entity
 * - memory_entities: /memories/entities → /graph/entities
 * - memory_by_entity: /memories/by-entity → /graph/entity/memories
 *
 * NOTE: /graph/path endpoint exists on the API but is NOT exposed as a tool
 *       (not in locked 14-tool list — flagged for user decision).
 */
import { z } from "zod";
import { api, checkCrossAgentHint } from "./api.js";
import { checkRateLimit, checkDedup, recordDedup, runActiveProfiler, appendSentinelWarning, } from "./hardening.js";
// Helper: Pass agent_id through to API (let API handle auto-resolution)
function resolveAgentId(providedAgentId) {
    return providedAgentId;
}
// ─────────────────────────────────────────────────────────────────────────────
// Tool Schemas
// ─────────────────────────────────────────────────────────────────────────────
export const memoryAddSchema = {
    agent_id: z.string().min(1).max(128).optional().describe("Optional. Auto-resolved from tenant default or single-agent account if omitted."),
    human_message: z.string().min(1).max(50000).describe("The human's message in this turn"),
    agent_message: z.string().min(1).max(50000).describe("The agent's response in this turn"),
    session_key: z.string().max(256).optional().describe("Optional session key for grouping conversation turns"),
    turn_id: z.string().max(256).optional().describe("Optional unique turn identifier"),
};
export const memoryWriteSchema = {
    content: z.string().min(1).max(5000).describe("The memory content to store"),
    memory_type: z.string().min(1).max(64).describe("Memory type (fact, preference, event, instruction, etc.)"),
    agent_id: z.string().min(1).max(128).optional().describe("Optional. Auto-resolved from tenant default or single-agent account if omitted."),
    metadata: z.record(z.unknown()).optional().describe("Optional metadata as JSONB object"),
    importance: z.number().min(0).max(1).default(0.5).describe("Importance score (0.0-1.0)"),
};
export const memoryRecallSchema = {
    agent_id: z.string().min(1).max(128).optional().describe("Optional. Auto-resolved from tenant default or single-agent account if omitted."),
    conversation_context: z.string().min(1).max(50000).describe("Current conversation context to match against stored memories"),
    budget_tokens: z.number().int().min(500).max(16000).default(4000).describe("Maximum tokens for the returned context block"),
    dynamic_budget: z.boolean().default(false).describe("Let the API auto-size the budget based on relevance"),
};
export const memorySearchSchema = {
    agent_id: z.string().min(1).max(128).optional().describe("Optional. Auto-resolved from tenant default or single-agent account if omitted."),
    q: z.string().min(1).max(500).describe("Search query"),
    limit: z.number().int().min(1).max(100).default(20).describe("Max results to return"),
};
export const memoryListSchema = {
    agent_id: z.string().min(1).max(128).optional().describe("Optional. Auto-resolved from tenant default or single-agent account if omitted."),
    memory_type: z.string().max(32).optional().describe("Filter by memory type (e.g. fact, preference, event)"),
    limit: z.number().int().min(1).max(200).default(50).describe("Max results to return"),
    offset: z.number().int().min(0).default(0).describe("Pagination offset"),
};
export const memoryDeleteSchema = {
    memory_id: z.string().min(1).describe("The UUID of the memory to delete"),
};
export const listAgentsSchema = {};
export const memoryHistorySchema = {
    memory_id: z.string().uuid().describe("The UUID of the memory to get history for"),
};
// --- Three separate graph tool schemas (not consolidated) ---
export const memoryGraphTraverseSchema = {
    agent_id: z.string().min(1).max(128).optional().describe("Optional. Auto-resolved from tenant default or single-agent account if omitted."),
    entity: z.string().min(1).max(256).describe("Entity name to explore relationships for"),
    depth: z.number().int().min(1).max(4).default(2).describe("Relationship traversal depth"),
};
export const memoryEntitiesSchema = {
    agent_id: z.string().min(1).max(128).optional().describe("Optional. Auto-resolved from tenant default or single-agent account if omitted."),
    entity_type: z.string().max(32).optional().describe("Filter entities by type (e.g. person, technology, project)"),
    limit: z.number().int().min(1).max(200).default(50).describe("Max results to return"),
};
export const memoryByEntitySchema = {
    agent_id: z.string().min(1).max(128).optional().describe("Optional. Auto-resolved from tenant default or single-agent account if omitted."),
    entity: z.string().min(1).max(256).describe("Entity name to retrieve memories for"),
    limit: z.number().int().min(1).max(100).default(20).describe("Max results to return"),
};
export const importDocumentSchema = {
    agent_id: z.string().min(1).max(128).optional().describe("Optional. Auto-resolved from tenant default or single-agent account if omitted."),
    content: z.string().min(1).max(204800).describe("The document text to import (up to 200KB)"),
    source: z.string().max(256).optional().describe("Source label (e.g. 'project-brief', 'wiki', 'manual')"),
};
export const importConversationSchema = {
    agent_id: z.string().min(1).max(128).optional().describe("Optional. Auto-resolved from tenant default or single-agent account if omitted."),
    conversation: z.array(z.object({
        role: z.enum(["human", "assistant", "user", "system"]).describe("Message role"),
        content: z.string().min(1).max(100000).describe("Message content"),
    })).min(1).max(500).describe("Array of conversation messages in [{role, content}] format"),
    source: z.string().max(256).optional().describe("Source label (e.g. 'claude-desktop', 'chatgpt')"),
};
export const memoryFeedbackSchema = {
    agent_id: z.string().min(1).max(128).optional().describe("Optional. Auto-resolved from tenant default or single-agent account if omitted."),
    memory_id: z.string().uuid().optional().describe("UUID of specific memory (required for used/ignored/contradicted feedback)"),
    feedback_type: z.enum(["used", "ignored", "contradicted", "miss"]).describe("Feedback type: used (helpful), ignored (not helpful), contradicted (wrong), miss (needed info not found)"),
    context: z.string().max(1000).optional().describe("Context for why memory was used/ignored, or what was missing (required for miss type)"),
};
// ─────────────────────────────────────────────────────────────────────────────
// Tool Implementations
// ─────────────────────────────────────────────────────────────────────────────
export async function memoryAdd(ctx, input) {
    const resolvedAgentId = resolveAgentId(input.agent_id);
    const content = `Human: ${input.human_message}\n\nAgent: ${input.agent_message}`;
    const result = await api({
        apiKey: ctx.apiKey,
        method: "POST",
        path: "/memories/extract",
        body: {
            ...(resolvedAgentId && { agent_id: resolvedAgentId }),
            content,
            ...(input.session_key && { session_key: input.session_key }),
            ...(input.turn_id && { turn_id: input.turn_id }),
        },
    });
    runActiveProfiler(ctx.apiKey, resolvedAgentId || "default", input.human_message, input.session_key).catch(() => { });
    const baseText = JSON.stringify(result, null, 2);
    const outputText = appendSentinelWarning(baseText, result);
    // CP9 Phase 2 Track B3: Check for next_action (first-recall demo flow)
    const contentBlocks = [{ type: "text", text: outputText }];
    if (result && typeof result === 'object' && 'next_action' in result) {
        const nextAction = result.next_action;
        if (nextAction && typeof nextAction === 'object' && nextAction.suggested_query) {
            contentBlocks.push({
                type: "text",
                text: `\n\n💡 Try recalling: Use the memory_recall tool with query: '${nextAction.suggested_query}'`
            });
        }
    }
    return {
        content: contentBlocks,
    };
}
export async function memoryWrite(ctx, input) {
    if (!checkRateLimit(ctx.apiKey)) {
        throw new Error("Rate limit exceeded: maximum 30 memory_write calls per minute per API key");
    }
    const resolvedAgentId = resolveAgentId(input.agent_id);
    const dupMemoryId = checkDedup(input.content, resolvedAgentId || ctx.apiKey);
    if (dupMemoryId) {
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        status: "deduplicated",
                        message: "Duplicate content detected within 60-second window",
                        memory_id: dupMemoryId,
                        deduplicated: true
                    }, null, 2)
                }],
        };
    }
    const mergedMetadata = {
        ...(input.metadata || {}),
        source: (input.metadata && input.metadata.source) || "mcp_memory_write"
    };
    const result = await api({
        apiKey: ctx.apiKey,
        method: "POST",
        path: "/memories/seed",
        body: {
            ...(resolvedAgentId && { agent_id: resolvedAgentId }),
            facts: [
                {
                    text: input.content,
                    memory_type: input.memory_type,
                    importance: input.importance,
                    metadata: mergedMetadata
                }
            ]
        },
    });
    if (result && typeof result === 'object' && 'memory_ids' in result && Array.isArray(result.memory_ids) && result.memory_ids.length > 0) {
        recordDedup(input.content, resolvedAgentId || ctx.apiKey, result.memory_ids[0]);
    }
    // CP9 Phase 2 Track B3: Check for next_action (first-recall demo flow)
    const contentBlocks = [{ type: "text", text: JSON.stringify(result, null, 2) }];
    if (result && typeof result === 'object' && 'next_action' in result) {
        const nextAction = result.next_action;
        if (nextAction && typeof nextAction === 'object' && nextAction.suggested_query) {
            contentBlocks.push({
                type: "text",
                text: `\n\n💡 Try recalling: Use the memory_recall tool with query: '${nextAction.suggested_query}'`
            });
        }
    }
    return {
        content: contentBlocks,
    };
}
export async function memoryRecall(ctx, input) {
    const resolvedAgentId = resolveAgentId(input.agent_id);
    const result = await api({
        apiKey: ctx.apiKey,
        method: "POST",
        path: "/recall",
        body: {
            ...(resolvedAgentId && { agent_id: resolvedAgentId }),
            conversation_context: input.conversation_context,
            budget_tokens: input.budget_tokens,
            dynamic_budget: input.dynamic_budget
        },
    });
    if (resolvedAgentId && result && typeof result === 'object' && 'memories' in result) {
        const memories = result.memories;
        if (!memories || memories.length === 0) {
            const hint = await checkCrossAgentHint(ctx.apiKey, resolvedAgentId);
            if (hint) {
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) + hint }],
                };
            }
        }
    }
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
}
export async function memorySearch(ctx, input) {
    const resolvedAgentId = resolveAgentId(input.agent_id);
    const result = await api({
        apiKey: ctx.apiKey,
        path: "/memories/search",
        query: {
            ...(resolvedAgentId && { agent_id: resolvedAgentId }),
            q: input.q,
            limit: input.limit
        },
    });
    if (resolvedAgentId && result && typeof result === 'object' && 'memories' in result) {
        const memories = result.memories;
        if (!memories || memories.length === 0) {
            const hint = await checkCrossAgentHint(ctx.apiKey, resolvedAgentId);
            if (hint) {
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) + hint }],
                };
            }
        }
    }
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
}
export async function memoryList(ctx, input) {
    const resolvedAgentId = resolveAgentId(input.agent_id);
    const result = await api({
        apiKey: ctx.apiKey,
        path: "/memories",
        query: {
            ...(resolvedAgentId && { agent_id: resolvedAgentId }),
            memory_type: input.memory_type,
            limit: input.limit,
            offset: input.offset
        },
    });
    if (resolvedAgentId && result && typeof result === 'object' && 'memories' in result) {
        const memories = result.memories;
        if (!memories || memories.length === 0) {
            const hint = await checkCrossAgentHint(ctx.apiKey, resolvedAgentId);
            if (hint) {
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) + hint }],
                };
            }
        }
    }
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
}
export async function memoryDelete(ctx, input) {
    const result = await api({
        apiKey: ctx.apiKey,
        method: "DELETE",
        path: `/memories/${encodeURIComponent(input.memory_id)}`,
    });
    return {
        content: [{
                type: "text",
                text: typeof result === "string" && result === ""
                    ? "Memory deleted successfully."
                    : JSON.stringify(result, null, 2),
            }],
    };
}
export async function listAgents(ctx) {
    const result = await api({
        apiKey: ctx.apiKey,
        method: "GET",
        path: "/agents",
    });
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
}
export async function memoryHistory(ctx, input) {
    const result = await api({
        apiKey: ctx.apiKey,
        path: `/memories/${encodeURIComponent(input.memory_id)}/history`,
    });
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
}
// --- Three separate graph tools ---
export async function memoryGraphTraverse(ctx, input) {
    const resolvedAgentId = resolveAgentId(input.agent_id);
    if (!resolvedAgentId)
        throw new Error("agent_id is required for memory_graph_traverse");
    const result = await api({
        apiKey: ctx.apiKey,
        path: "/graph/entity",
        query: {
            agent_id: resolvedAgentId,
            entity: input.entity,
            depth: input.depth,
        },
    });
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
}
export async function memoryEntities(ctx, input) {
    const resolvedAgentId = resolveAgentId(input.agent_id);
    if (!resolvedAgentId)
        throw new Error("agent_id is required for memory_entities");
    const result = await api({
        apiKey: ctx.apiKey,
        path: "/graph/entities",
        query: {
            agent_id: resolvedAgentId,
            ...(input.entity_type && { entity_type: input.entity_type }),
            limit: input.limit,
        },
    });
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
}
export async function memoryByEntity(ctx, input) {
    const resolvedAgentId = resolveAgentId(input.agent_id);
    if (!resolvedAgentId)
        throw new Error("agent_id is required for memory_by_entity");
    const result = await api({
        apiKey: ctx.apiKey,
        path: "/graph/entity/memories",
        query: {
            agent_id: resolvedAgentId,
            entity: input.entity,
            limit: input.limit,
        },
    });
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
}
export async function importDocument(ctx, input) {
    const resolvedAgentId = resolveAgentId(input.agent_id);
    const result = await api({
        apiKey: ctx.apiKey,
        method: "POST",
        path: "/memories/import",
        body: {
            ...(resolvedAgentId && { agent_id: resolvedAgentId }),
            content: input.content,
            ...(input.source && { source: input.source })
        },
    });
    return {
        content: [{
                type: "text",
                text: `Imported document: ${result.chunks_processed} chunks processed, ${result.memories_stored} memories stored.\n\n${JSON.stringify(result, null, 2)}`,
            }],
    };
}
export async function importConversation(ctx, input) {
    const resolvedAgentId = resolveAgentId(input.agent_id);
    const result = await api({
        apiKey: ctx.apiKey,
        method: "POST",
        path: "/memories/import-thread",
        body: {
            ...(resolvedAgentId && { agent_id: resolvedAgentId }),
            conversation: input.conversation,
            ...(input.source && { source: input.source })
        },
    });
    return {
        content: [{
                type: "text",
                text: `Imported conversation: ${result.turns_processed} turns processed, ${result.memories_stored} memories stored.\n\n${JSON.stringify(result, null, 2)}`,
            }],
    };
}
export async function memoryFeedback(ctx, input) {
    const resolvedAgentId = resolveAgentId(input.agent_id);
    const result = await api({
        apiKey: ctx.apiKey,
        method: "POST",
        path: "/feedback",
        body: {
            ...(resolvedAgentId && { agent_id: resolvedAgentId }),
            memory_id: input.memory_id,
            feedback_type: input.feedback_type,
            context: input.context
        },
    });
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
}
//# sourceMappingURL=tools.js.map