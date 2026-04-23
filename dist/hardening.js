/**
 * hardening.ts — Transport-agnostic hardening layers
 *
 * Includes:
 * - Rate limiting (30/min for memory_write)
 * - Content dedup (60s window)
 * - Active profiling (first 5 conversations — full pattern library)
 * - Sentinel DLP (format warnings for detected secrets)
 */
import * as crypto from "crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { api } from "./api.js";
const rateLimitMap = new Map();
const dedupMap = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap.entries()) {
        if (now > entry.resetTime)
            rateLimitMap.delete(key);
    }
    for (const [hash, entry] of dedupMap.entries()) {
        if (now > entry.expiresAt)
            dedupMap.delete(hash);
    }
}, 60000);
export function checkRateLimit(key) {
    const now = Date.now();
    const entry = rateLimitMap.get(key);
    if (!entry || now > entry.resetTime) {
        rateLimitMap.set(key, { count: 1, resetTime: now + 60000 });
        return true;
    }
    if (entry.count >= 30)
        return false;
    entry.count++;
    return true;
}
// ─────────────────────────────────────────────────────────────────────────────
// Content Dedup
// ─────────────────────────────────────────────────────────────────────────────
export function checkDedup(content, agentId) {
    const hash = crypto.createHash("sha256").update(content + agentId).digest("hex");
    const now = Date.now();
    const entry = dedupMap.get(hash);
    if (entry && now < entry.expiresAt)
        return entry.memoryId;
    return null;
}
export function recordDedup(content, agentId, memoryId) {
    const hash = crypto.createHash("sha256").update(content + agentId).digest("hex");
    dedupMap.set(hash, { memoryId, expiresAt: Date.now() + 60000 });
}
// ─────────────────────────────────────────────────────────────────────────────
// Active Profiling — Full Pattern Library
// Ported verbatim from /root/.openclaw/workspace/memory-product/mcp-server/src/index.ts
// ─────────────────────────────────────────────────────────────────────────────
const PROFILE_STATE_DIR = path.join(os.homedir(), ".0latency");
const PROFILE_STATE_FILE = path.join(PROFILE_STATE_DIR, "profile_state.json");
const PROFILE_CONVERSATIONS_THRESHOLD = 5;
function loadProfileState() {
    try {
        const raw = fs.readFileSync(PROFILE_STATE_FILE, "utf-8");
        return JSON.parse(raw);
    }
    catch {
        return { conversations_processed: 0, profiling_complete: false, session_keys_seen: [], facts: [] };
    }
}
function saveProfileState(state) {
    try {
        fs.mkdirSync(PROFILE_STATE_DIR, { recursive: true });
        fs.writeFileSync(PROFILE_STATE_FILE, JSON.stringify(state, null, 2));
    }
    catch (err) {
        console.error("Failed to save profile state:", err);
    }
}
// Pattern-based signal extraction from text
const PROFILE_PATTERNS = [
    // Programming languages
    ...[
        "Python", "JavaScript", "TypeScript", "Rust", "Go", "Java", "C\\+\\+",
        "C#", "Ruby", "PHP", "Swift", "Kotlin", "Scala", "Elixir", "Clojure",
        "Haskell", "Lua", "R", "Julia", "Dart", "Zig",
    ].map((lang) => ({
        category: "programming_language",
        key: lang.replace("\\+\\+", "++").replace("\\#", "#"),
        patterns: [
            new RegExp(`\\b(?:I (?:use|write|code|program|develop|work) (?:in|with) )${lang}\\b`, "i"),
            new RegExp(`\\b(?:my|our) ${lang} (?:project|code|app|service|codebase)\\b`, "i"),
            new RegExp(`\\b${lang} (?:developer|engineer|programmer)\\b`, "i"),
        ],
    })),
    // Frameworks / tools
    ...[
        "React", "Next\\.?js", "Vue", "Angular", "Svelte", "Django", "Flask",
        "FastAPI", "Express", "NestJS", "Rails", "Laravel", "Spring Boot",
        "Tailwind", "PostgreSQL", "MongoDB", "Redis", "Docker", "Kubernetes",
        "AWS", "GCP", "Azure", "Vercel", "Supabase", "Firebase", "Terraform",
        "Node\\.?js", "Deno", "Bun",
    ].map((fw) => ({
        category: "tech_stack",
        key: fw.replace(/\\\.\?/g, "").replace(/\\/, ""),
        patterns: [
            new RegExp(`\\b(?:I (?:use|work with|deploy (?:on|to)|build with) )${fw}\\b`, "i"),
            new RegExp(`\\b(?:my|our) ${fw}\\b`, "i"),
            new RegExp(`\\b(?:using|running|deployed on|built (?:with|in|on)) ${fw}\\b`, "i"),
        ],
    })),
    // Role / title
    {
        category: "role",
        key: "role",
        patterns: [
            /\bI(?:'m| am) (?:a |an |the )?((?:senior |junior |lead |staff |principal |chief )?(?:software |backend |frontend |full[- ]?stack |data |ML |AI |dev ?ops |platform |mobile |cloud |site reliability )?(?:engineer|developer|architect|scientist|analyst|designer|manager|director|CTO|CEO|founder|co-founder|freelancer|consultant|contractor))\b/i,
        ],
    },
    // Communication style signals
    {
        category: "communication_style",
        key: "prefers_concise",
        patterns: [
            /\b(?:keep it (?:short|brief|concise)|(?:don't|do not) (?:be )?verbose|tl;?dr|just the (?:answer|facts|code))\b/i,
        ],
    },
    {
        category: "communication_style",
        key: "prefers_detailed",
        patterns: [
            /\b(?:explain (?:in detail|thoroughly|step by step)|walk me through|I want to understand|give me the full)\b/i,
        ],
    },
    {
        category: "communication_style",
        key: "prefers_code_examples",
        patterns: [
            /\b(?:show me (?:the |some )?code|code example|give me (?:a |an )?(?:example|snippet)|show (?:an? )?example)\b/i,
        ],
    },
    // Project names — "my project X" / "working on X"
    {
        category: "project",
        key: "project_name",
        patterns: [
            /\b(?:my (?:project|app|product|service|startup|company|tool|platform) (?:called |named |is )?["']?)([A-Z][A-Za-z0-9_-]+)/,
            /\b(?:working on|building|developing|launching) ["']?([A-Z][A-Za-z0-9_-]+)["']?/,
        ],
    },
];
function extractProfileSignals(text) {
    const facts = [];
    const seen = new Set();
    const now = new Date().toISOString();
    for (const { category, key, patterns } of PROFILE_PATTERNS) {
        for (const pattern of patterns) {
            const match = pattern.exec(text);
            if (match) {
                // For role and project, use the captured group; otherwise use the key
                let value = key;
                if (category === "role" && match[1]) {
                    value = match[1].trim();
                }
                else if (category === "project" && match[1]) {
                    value = match[1].trim();
                }
                const dedup = `${category}:${value.toLowerCase()}`;
                if (!seen.has(dedup)) {
                    seen.add(dedup);
                    facts.push({ category, key: value, value, extracted_at: now });
                }
                break; // one match per pattern group is enough
            }
        }
    }
    return facts;
}
function formatProfileFact(fact) {
    switch (fact.category) {
        case "programming_language":
            return `User works with ${fact.value}`;
        case "tech_stack":
            return `User uses ${fact.value} in their tech stack`;
        case "role":
            return `User's role: ${fact.value}`;
        case "communication_style":
            return `User communication preference: ${fact.key.replace(/_/g, " ")}`;
        case "project":
            return `User is working on a project called ${fact.value}`;
        default:
            return `User profile: ${fact.key} = ${fact.value}`;
    }
}
/**
 * Run active profiling on a conversation turn. Called after memory_add.
 * Non-blocking, fire-and-forget — errors are silently logged.
 * Adapted for unified codebase: takes apiKey for API auth.
 */
export async function runActiveProfiler(apiKey, agentId, humanMessage, sessionKey) {
    try {
        const state = loadProfileState();
        // Already done profiling
        if (state.profiling_complete)
            return;
        // Track unique conversations by session_key (or count each call if no key)
        const convKey = sessionKey || `auto_${Date.now()}`;
        const isNewConversation = !state.session_keys_seen.includes(convKey);
        if (isNewConversation) {
            state.session_keys_seen.push(convKey);
            state.conversations_processed = state.session_keys_seen.length;
        }
        // Extract signals from the human message
        const newFacts = extractProfileSignals(humanMessage);
        // Filter out facts we've already stored
        const existingKeys = new Set(state.facts.map((f) => `${f.category}:${f.value.toLowerCase()}`));
        const novelFacts = newFacts.filter((f) => !existingKeys.has(`${f.category}:${f.value.toLowerCase()}`));
        // If we found new facts, seed them via the API (piggyback — only when we have something)
        if (novelFacts.length > 0) {
            const seedFacts = novelFacts.map((f) => ({
                text: formatProfileFact(f),
                category: "profile",
                importance: 0.8,
            }));
            try {
                await api({
                    apiKey,
                    method: "POST",
                    path: "/memories/seed",
                    body: { agent_id: agentId, facts: seedFacts },
                });
            }
            catch (seedErr) {
                // Silently log — profiling should never break the main flow
                console.error("Profile seed failed (non-fatal):", seedErr);
            }
            state.facts.push(...novelFacts);
        }
        // Check if we've hit the threshold
        if (state.conversations_processed >= PROFILE_CONVERSATIONS_THRESHOLD) {
            state.profiling_complete = true;
        }
        saveProfileState(state);
    }
    catch (err) {
        // Never let profiling errors affect the main tool response
        console.error("Active profiler error (non-fatal):", err);
    }
}
export function formatSentinelWarning(sentinel) {
    if (!sentinel?.detected?.length)
        return "";
    const lines = [
        "",
        "\u26a0\ufe0f  SENTINEL WARNING: Credentials/secrets detected!",
        `   Found ${sentinel.secrets_found} secret(s):`,
    ];
    for (const f of sentinel.detected) {
        lines.push(`   \u2022 [${f.confidence?.toUpperCase()}] ${f.pattern_name}: ${f.redacted}`);
    }
    lines.push("", `   Action: ${sentinel.action?.toUpperCase()}`, "");
    return lines.join("\n");
}
export function appendSentinelWarning(baseText, apiResult) {
    if (apiResult?.sentinel) {
        const warning = formatSentinelWarning(apiResult.sentinel);
        if (warning)
            return baseText + warning;
    }
    return baseText;
}
//# sourceMappingURL=hardening.js.map