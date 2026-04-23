#!/usr/bin/env node

/**
 * server-stdio.ts — stdio transport entry point
 * Imports unified tools and registers them with stdio transport
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as tools from "./tools.js";

const API_KEY = process.env.ZERO_LATENCY_API_KEY ?? "";

if (!API_KEY) {
  console.error(
    "\u26a0\ufe0f  ZERO_LATENCY_API_KEY is not set. All API calls will fail."
  );
}

const server = new McpServer({
  name: "0latency",
  version: "0.2.0",
});

const ctx: tools.ToolContext = { apiKey: API_KEY };

// Register all 14 tools
server.tool(
  "memory_add",
  "Extract and store memories from a conversation turn. Provide the human message, agent response, and an agent_id to namespace the memories.",
  tools.memoryAddSchema,
  async (input) => tools.memoryAdd(ctx, input)
);

server.tool(
  "memory_write",
  "Directly write a memory to storage (seed API). Bypasses extraction. Use for explicit facts, preferences, or instructions.",
  tools.memoryWriteSchema,
  async (input) => tools.memoryWrite(ctx, input)
);

server.tool(
  "memory_recall",
  "Recall relevant memories given a conversation context. Returns a formatted context block ready to inject into a prompt.",
  tools.memoryRecallSchema,
  async (input) => tools.memoryRecall(ctx, input)
);

server.tool(
  "memory_search",
  "Search memories by text query. Returns matching memories ranked by relevance.",
  tools.memorySearchSchema,
  async (input) => tools.memorySearch(ctx, input)
);

server.tool(
  "memory_list",
  "List stored memories with optional filters. Supports pagination via limit/offset.",
  tools.memoryListSchema,
  async (input) => tools.memoryList(ctx, input)
);

server.tool(
  "memory_delete",
  "Delete a specific memory by its ID.",
  tools.memoryDeleteSchema,
  async (input) => tools.memoryDelete(ctx, input)
);

server.tool(
  "list_agents",
  "List all agent namespaces for this tenant with memory counts. Useful for discovering available agents.",
  tools.listAgentsSchema,
  async () => tools.listAgents(ctx)
);

server.tool(
  "memory_history",
  "Get the full version history for a specific memory. Shows how the memory evolved over time, including what changed and why.",
  tools.memoryHistorySchema,
  async (input) => tools.memoryHistory(ctx, input)
);

server.tool(
  "memory_graph_traverse",
  "Query the knowledge graph. Explore an entity's relationships and connections to other entities.",
  tools.memoryGraphTraverseSchema,
  async (input) => tools.memoryGraphTraverse(ctx, input)
);

server.tool(
  "memory_entities",
  "List entities in the knowledge graph. Optionally filter by entity type.",
  tools.memoryEntitiesSchema,
  async (input) => tools.memoryEntities(ctx, input)
);

server.tool(
  "memory_by_entity",
  "Get memories associated with a specific entity in the knowledge graph.",
  tools.memoryByEntitySchema,
  async (input) => tools.memoryByEntity(ctx, input)
);

server.tool(
  "import_document",
  "Import a large text document (project brief, wiki page, documentation, etc.) and extract memories from it. Content is automatically chunked and processed through the extraction pipeline.",
  tools.importDocumentSchema,
  async (input) => tools.importDocument(ctx, input)
);

server.tool(
  "import_conversation",
  "Import a conversation export (e.g. from Claude Desktop or ChatGPT) and extract memories from each turn pair. Provide the conversation as an array of {role, content} objects.",
  tools.importConversationSchema,
  async (input) => tools.importConversation(ctx, input)
);

server.tool(
  "memory_feedback",
  "Submit feedback on recalled memories. Helps 0Latency learn which memories are useful vs ignored. This powers self-improving importance scores.",
  tools.memoryFeedbackSchema,
  async (input) => tools.memoryFeedback(ctx, input)
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("0Latency MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
