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
export interface ToolContext {
    apiKey: string;
}
export declare const memoryAddSchema: {
    agent_id: z.ZodOptional<z.ZodString>;
    human_message: z.ZodString;
    agent_message: z.ZodString;
    session_key: z.ZodOptional<z.ZodString>;
    turn_id: z.ZodOptional<z.ZodString>;
};
export declare const memoryWriteSchema: {
    content: z.ZodString;
    memory_type: z.ZodString;
    agent_id: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    importance: z.ZodDefault<z.ZodNumber>;
};
export declare const memoryRecallSchema: {
    agent_id: z.ZodOptional<z.ZodString>;
    conversation_context: z.ZodString;
    budget_tokens: z.ZodDefault<z.ZodNumber>;
    dynamic_budget: z.ZodDefault<z.ZodBoolean>;
};
export declare const memorySearchSchema: {
    agent_id: z.ZodOptional<z.ZodString>;
    q: z.ZodString;
    limit: z.ZodDefault<z.ZodNumber>;
};
export declare const memoryListSchema: {
    agent_id: z.ZodOptional<z.ZodString>;
    memory_type: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodDefault<z.ZodNumber>;
};
export declare const memoryDeleteSchema: {
    memory_id: z.ZodString;
};
export declare const listAgentsSchema: {};
export declare const memoryHistorySchema: {
    memory_id: z.ZodString;
};
export declare const memoryGraphTraverseSchema: {
    agent_id: z.ZodOptional<z.ZodString>;
    entity: z.ZodString;
    depth: z.ZodDefault<z.ZodNumber>;
};
export declare const memoryEntitiesSchema: {
    agent_id: z.ZodOptional<z.ZodString>;
    entity_type: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
};
export declare const memoryByEntitySchema: {
    agent_id: z.ZodOptional<z.ZodString>;
    entity: z.ZodString;
    limit: z.ZodDefault<z.ZodNumber>;
};
export declare const importDocumentSchema: {
    agent_id: z.ZodOptional<z.ZodString>;
    content: z.ZodString;
    source: z.ZodOptional<z.ZodString>;
};
export declare const importConversationSchema: {
    agent_id: z.ZodOptional<z.ZodString>;
    conversation: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["human", "assistant", "user", "system"]>;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        role: "human" | "assistant" | "user" | "system";
        content: string;
    }, {
        role: "human" | "assistant" | "user" | "system";
        content: string;
    }>, "many">;
    source: z.ZodOptional<z.ZodString>;
};
export declare const memoryFeedbackSchema: {
    agent_id: z.ZodOptional<z.ZodString>;
    memory_id: z.ZodOptional<z.ZodString>;
    feedback_type: z.ZodEnum<["used", "ignored", "contradicted", "miss"]>;
    context: z.ZodOptional<z.ZodString>;
};
export declare function memoryAdd(ctx: ToolContext, input: any): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
export declare function memoryWrite(ctx: ToolContext, input: any): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
export declare function memoryRecall(ctx: ToolContext, input: any): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
export declare function memorySearch(ctx: ToolContext, input: any): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
export declare function memoryList(ctx: ToolContext, input: any): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
export declare function memoryDelete(ctx: ToolContext, input: any): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
export declare function listAgents(ctx: ToolContext): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
export declare function memoryHistory(ctx: ToolContext, input: any): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
export declare function memoryGraphTraverse(ctx: ToolContext, input: any): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
export declare function memoryEntities(ctx: ToolContext, input: any): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
export declare function memoryByEntity(ctx: ToolContext, input: any): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
export declare function importDocument(ctx: ToolContext, input: any): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
export declare function importConversation(ctx: ToolContext, input: any): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
export declare function memoryFeedback(ctx: ToolContext, input: any): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
//# sourceMappingURL=tools.d.ts.map