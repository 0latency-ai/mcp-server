/**
 * server-sse.ts — HTTP/SSE transport entry point
 * Imports unified tools and registers them with StreamableHTTP transport
 */

import express from "express";
import crypto from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import { createClient } from "redis";
import { z } from "zod";
import { getTenantId } from "./api.js";
import * as tools from "./tools.js";

// Config schema with optional fields for Smithery
export const configSchema = z.object({
  apiKey: z.string().describe("Your 0Latency API key"),
  agentId: z.string()
    .optional()
    .describe("Default agent namespace for memory operations (e.g. 'user-justin')"),
  budgetTokens: z.number()
    .default(4000)
    .optional()
    .describe("Default token budget for memory recall responses (500–16000)"),
  dynamicBudget: z.boolean()
    .default(false)
    .optional()
    .describe("Let the API auto-size recall budget based on relevance"),
});

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT || "3100", 10);

// ---------------------------------------------------------------------------
// Redis Subscriber for SSE Memory Updates
// ---------------------------------------------------------------------------

const redisSubscriber = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379"
});

redisSubscriber.on("error", (err) => {
  console.error("[Redis Subscriber] Error:", err);
});

(async () => {
  try {
    await redisSubscriber.connect();
    console.log("✓ Redis subscriber connected");
  } catch (err) {
    console.error("✗ Redis subscriber connection failed:", err);
  }
})();

// ---------------------------------------------------------------------------
// API Key extraction
// ---------------------------------------------------------------------------

function extractApiKey(req: express.Request): string | null {
  if (req.headers["x-api-key"]) return req.headers["x-api-key"] as string;
  if (req.query?.Key) return req.query.Key as string;
  if (req.query?.key) return req.query.key as string;

  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    try {
      const decoded = jwt.verify(
        auth.replace("Bearer ", ""),
        process.env.JWT_SECRET || "changeme",
        { issuer: "https://mcp.0latency.ai" }
      ) as any;
      return decoded.api_key;
    } catch {
      return null;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// OAuth client storage
// ---------------------------------------------------------------------------

const clients = new Map<string, { client_id: string; client_secret: string; redirect_uris: string[] }>();
const authCodes = new Map<string, { client_id: string; api_key: string; code_challenge: string; redirect_uri: string }>();

// ---------------------------------------------------------------------------
// Create MCP Server with unified tools
// ---------------------------------------------------------------------------

function createMcpServer(apiKey: string): McpServer {
  const server = new McpServer({
    name: "0latency",
    version: "0.2.0",
  });

  const ctx: tools.ToolContext = { apiKey };

  // Register all 14 tools with annotations
  server.registerTool(
    "memory_add",
    {
      description: "Extract and store memories from a conversation turn. Provide the human message, agent response, and an agent_id to namespace the memories.",
      inputSchema: tools.memoryAddSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    async (input) => tools.memoryAdd(ctx, input)
  );

  server.registerTool(
    "memory_write",
    {
      description: "Directly write a memory to storage (seed API). Bypasses extraction. Use for explicit facts, preferences, or instructions.",
      inputSchema: tools.memoryWriteSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    async (input) => tools.memoryWrite(ctx, input)
  );

  server.registerTool(
    "memory_recall",
    {
      description: "Recall relevant memories given a conversation context. Returns a formatted context block ready to inject into a prompt.",
      inputSchema: tools.memoryRecallSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (input) => tools.memoryRecall(ctx, input)
  );

  server.registerTool(
    "memory_search",
    {
      description: "Search memories by text query. Returns matching memories ranked by relevance.",
      inputSchema: tools.memorySearchSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (input) => tools.memorySearch(ctx, input)
  );

  server.registerTool(
    "memory_list",
    {
      description: "List stored memories with optional filters. Supports pagination via limit/offset.",
      inputSchema: tools.memoryListSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (input) => tools.memoryList(ctx, input)
  );

  server.registerTool(
    "memory_delete",
    {
      description: "Delete a specific memory by its ID.",
      inputSchema: tools.memoryDeleteSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      },
    },
    async (input) => tools.memoryDelete(ctx, input)
  );

  server.registerTool(
    "list_agents",
    {
      description: "List all agent namespaces for this tenant with memory counts. Useful for discovering available agents.",
      inputSchema: tools.listAgentsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async () => tools.listAgents(ctx)
  );

  server.registerTool(
    "memory_history",
    {
      description: "Get the full version history for a specific memory. Shows how the memory evolved over time, including what changed and why.",
      inputSchema: tools.memoryHistorySchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (input) => tools.memoryHistory(ctx, input)
  );

  server.registerTool(
    "memory_graph_traverse",
    {
      description: "Query the knowledge graph. Explore an entity's relationships and connections to other entities.",
      inputSchema: tools.memoryGraphTraverseSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (input) => tools.memoryGraphTraverse(ctx, input)
  );

  server.registerTool(
    "memory_entities",
    {
      description: "List entities in the knowledge graph. Optionally filter by entity type.",
      inputSchema: tools.memoryEntitiesSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (input) => tools.memoryEntities(ctx, input)
  );

  server.registerTool(
    "memory_by_entity",
    {
      description: "Get memories associated with a specific entity in the knowledge graph.",
      inputSchema: tools.memoryByEntitySchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (input) => tools.memoryByEntity(ctx, input)
  );

  server.registerTool(
    "import_document",
    {
      description: "Import a large text document (project brief, wiki page, documentation, etc.) and extract memories from it. Content is automatically chunked and processed through the extraction pipeline.",
      inputSchema: tools.importDocumentSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    async (input) => tools.importDocument(ctx, input)
  );

  server.registerTool(
    "import_conversation",
    {
      description: "Import a conversation export (e.g. from Claude Desktop or ChatGPT) and extract memories from each turn pair. Provide the conversation as an array of {role, content} objects.",
      inputSchema: tools.importConversationSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    async (input) => tools.importConversation(ctx, input)
  );

  server.registerTool(
    "memory_feedback",
    {
      description: "Submit feedback on recalled memories. Helps 0Latency learn which memories are useful vs ignored. This powers self-improving importance scores.",
      inputSchema: tools.memoryFeedbackSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    async (input) => tools.memoryFeedback(ctx, input)
  );

  return server;
}

// ---------------------------------------------------------------------------
// Express + StreamableHTTP Transport
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "0latency-mcp-sse", version: "0.2.0" });
});

// OAuth metadata endpoints
app.get("/.well-known/oauth-protected-resource", (req, res) => {
  res.json({
    resource: "https://mcp.0latency.ai/mcp",
    authorization_servers: ["https://mcp.0latency.ai"],
    scopes_supported: ["mcp:tools"],
    bearer_methods_supported: ["header"],
  });
});

app.get("/.well-known/oauth-authorization-server", (req, res) => {
  res.json({
    issuer: "https://mcp.0latency.ai",
    authorization_endpoint: "https://mcp.0latency.ai/authorize",
    token_endpoint: "https://mcp.0latency.ai/token",
    registration_endpoint: "https://mcp.0latency.ai/register",
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
  });
});

app.post("/register", (req, res) => {
  const client_id = uuidv4();
  const client_secret = uuidv4();
  const redirect_uris = req.body.redirect_uris || [];

  clients.set(client_id, { client_id, client_secret, redirect_uris });

  res.json({
    client_id,
    client_secret,
    redirect_uris,
    grant_types: ["authorization_code"],
    response_types: ["code"],
  });
});

app.get("/authorize", (req, res) => {
  const { client_id, redirect_uri, state, code_challenge } = req.query;

  res.send(`
    <html>
      <body>
        <h2>0Latency MCP Authorization</h2>
        <p>Client ID: ${client_id}</p>
        <form method="POST" action="/authorize">
          <input type="hidden" name="client_id" value="${client_id}" />
          <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
          <input type="hidden" name="state" value="${state}" />
          <input type="hidden" name="code_challenge" value="${code_challenge}" />
          <label>API Key: <input type="password" name="api_key" required /></label><br/>
          <button type="submit">Authorize</button>
        </form>
      </body>
    </html>
  `);
});

app.post("/authorize", express.urlencoded({ extended: true }), (req, res) => {
  const { client_id, redirect_uri, state, code_challenge, api_key } = req.body;

  const code = uuidv4();
  authCodes.set(code, { client_id, api_key, code_challenge, redirect_uri });

  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set("code", code);
  if (state) redirectUrl.searchParams.set("state", state);

  res.redirect(redirectUrl.toString());
});

app.post("/token", express.urlencoded({ extended: true }), (req, res) => {
  const { grant_type, code, code_verifier, client_id, client_secret } = req.body;

  if (grant_type !== "authorization_code") {
    res.status(400).json({ error: "unsupported_grant_type" });
    return;
  }

  const authCode = authCodes.get(code);
  if (!authCode) {
    res.status(400).json({ error: "invalid_grant" });
    return;
  }

  const client = clients.get(client_id);
  if (!client || client.client_secret !== client_secret) {
    res.status(401).json({ error: "invalid_client" });
    return;
  }

  const hash = crypto.createHash("sha256").update(code_verifier).digest("base64url");
  if (hash !== authCode.code_challenge) {
    res.status(400).json({ error: "invalid_grant", error_description: "PKCE verification failed" });
    return;
  }

  const access_token = jwt.sign(
    { api_key: authCode.api_key },
    process.env.JWT_SECRET || "changeme",
    { expiresIn: "1h", issuer: "https://mcp.0latency.ai" }
  );

  authCodes.delete(code);

  res.json({
    access_token,
    token_type: "Bearer",
    expires_in: 3600,
  });
});

// MCP POST endpoint
app.post("/mcp", async (req, res) => {
  const apiKey = extractApiKey(req);
  console.log(`[MCP POST] Request from ${req.ip}`, apiKey ? "with valid API key" : "MISSING API KEY");

  if (!apiKey || !apiKey.startsWith("zl_")) {
    res.status(401).json({ error: "Invalid or missing API key. Use x-api-key header" });
    return;
  }

  const mcpServer = createMcpServer(apiKey);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body);

  console.log(`[MCP POST] Request handled for ${req.ip}`);
});

// MCP GET endpoint (SSE)
app.get("/mcp", async (req, res) => {
  const apiKey = extractApiKey(req);
  console.log(`[MCP GET] Request from ${req.ip}`, apiKey ? "with valid API key" : "MISSING API KEY");

  if (!apiKey || !apiKey.startsWith("zl_")) {
    res.status(401).json({ error: "Invalid or missing API key. Use x-api-key header" });
    return;
  }

  const tenantId = await getTenantId(apiKey);
  console.log(`[MCP GET] Tenant: ${tenantId || "unknown"}`);

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setTimeout(300000);

  // Heartbeat
  let heartbeatInterval = setInterval(() => {
    try {
      res.write(':keepalive\n\n');
    } catch (err) {
      console.error('[SSE] Heartbeat write failed:', err);
      clearInterval(heartbeatInterval);
    }
  }, 30000);

  req.on('close', () => clearInterval(heartbeatInterval));
  res.on('error', (err) => {
    console.error('[SSE] Connection error:', err);
    clearInterval(heartbeatInterval);
  });

  const mcpServer = createMcpServer(apiKey);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await mcpServer.connect(transport);

  // Redis SSE push setup
  if (tenantId) {
    const channel = `memory_update:${tenantId}`;
    const subscriberDup = redisSubscriber.duplicate();

    try {
      await subscriberDup.connect();
      console.log(`[SSE Push] Subscribed to ${channel}`);

      await subscriberDup.subscribe(channel, (message) => {
        try {
          res.write(`event: memory_update\n`);
          res.write(`data: ${message}\n\n`);
        } catch (err) {
          console.error('[SSE Push] Failed to send event:', err);
        }
      });

      req.on('close', async () => {
        try {
          await subscriberDup.unsubscribe(channel);
          await subscriberDup.quit();
          clearInterval(heartbeatInterval);
        } catch (err) {
          console.error('[SSE Push] Cleanup error:', err);
        }
      });
    } catch (err) {
      console.error(`[SSE Push] Failed to setup subscription:`, err);
      clearInterval(heartbeatInterval);
    }
  }

  await transport.handleRequest(req, res);
  console.log(`[MCP GET] Request handled for ${req.ip}`);
});

app.listen(PORT, () => {
  console.log(`✓ 0Latency MCP SSE server listening on http://localhost:${PORT}`);
  console.log(`✓ MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);
});
