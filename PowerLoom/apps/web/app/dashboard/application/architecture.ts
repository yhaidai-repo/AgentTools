// The architecture scheme, hand-maintained (user decision 2026-10-11): a node per service, module and component, each
// inside its parent, and the links between them. Grid positions (`x`, `y`) lay out a level by hand; nodes without one
// fall into a grid. Ids of the nodes the status colors are the component names of PowerLoom's attention rules.

export type NodeKind = "service" | "external" | "module" | "component";

export interface SchemeNode {
  id: string;
  label: string;
  kind: NodeKind;
  parent?: string;
  detail?: string;
  x?: number;
  y?: number;
}

export interface SchemeLink {
  from: string;
  to: string;
  label?: string;
}

const node = (id: string, label: string, kind: NodeKind, parent?: string, detail?: string, x?: number, y?: number): SchemeNode => ({ id, label, kind, parent, detail, x, y });
const link = (from: string, to: string, label?: string): SchemeLink => ({ from, to, label });

// The top level as a hub: agent-runner in the middle with what only the agents read around it, what both services use
// (web, Confluence, Azure DevOps, the vaults) in the row below it, and PowerLoom under that, so no two links cross and
// no link runs through a node; mcp and the chat apps it serves sit left of PowerLoom, below web. schemeLayout.test.ts
// checks every hand-placed level for overlaps, links through nodes and crossing links.
const topLevel: SchemeNode[] = [
  node("ado", "Azure DevOps", "external", undefined, "work items, pull requests, repositories", 3.5, 2),
  node("confluence", "Confluence", "external", undefined, "linked pages", 2.5, 2),
  node("ai-providers", "AI providers", "external", undefined, "the agents' models: Claude, Codex on your ChatGPT plan", 2.5, 0),
  node("vaults", "Obsidian vaults", "external", undefined, "docs vaults and the backlog vault on disk", 4.5, 2),
  node("repos", "Repositories", "external", undefined, "git checkouts on disk", 4.5, 0),
  node("web", "web", "service", undefined, "Next.js UI and CLI", 1.5, 2),
  node("powerloom", "PowerLoom", "service", undefined, ".NET backend: Wolverine, Postgres", 3, 3),
  node("agent-runner", "agent-runner", "service", undefined, "runs one agent task at a time", 3, 1),
  node("database", "Postgres", "service", undefined, "state, queues, usage, config", 0, 2),
  node("otel-lgtm", "otel-lgtm", "service", undefined, "Grafana, Tempo, Loki, Prometheus", 4.5, 3),
  node("backup", "backup", "service", undefined, "daily pg_dump", 0, 1),
  // Desktop chats: "Continue with …" opens one in the chosen app; it reaches PowerLoom through the MCP server.
  node("mcp", "mcp", "service", undefined, "PowerLoom's tools for desktop chats (port 3110)", 1.5, 3),
  node("chat-apps", "Chat apps", "external", undefined, "Claude Desktop or Codex on this PC", 1.5, 4),
  // What the agents read outside on their own (per-agent switches), around agent-runner; their colors come from the
  // agents' recent reads and open access requests.
  node("mongo", "Mongo", "external", undefined, "Cosmos DB for MongoDB, and servers by connection string (Read Azure)", 1.5, 1),
  node("sql-server", "SQL Server", "external", undefined, "Read SQL connections, read only", 4.5, 1),
  node("azure", "Azure", "external", undefined, "App Insights, logs, metrics, Service Bus, Cosmos DB, with your sign-in (Read Azure)", 3.5, 0),
  node("devhub", "DevHub", "external", undefined, "DevSecrets: services on the Windows host", 1.5, 0),
];

const aiProviders: SchemeNode[] = [
  node("claude", "Claude", "component", "ai-providers", "a claude setup-token token (Settings, or .env as the fallback)", 0, 0),
  node("codex", "Codex", "component", "ai-providers", "ChatGPT plan, signed in to PowerLoom's own agent-homes/codex", 1, 0),
];

const powerloomModules: SchemeNode[] = [
  node("pl-features", "Features", "module", "powerloom", "vertical slices", 0, 0),
  node("ado-integration", "ADO library", "module", "powerloom", "PowerLoom.AdoIntegration", 1, 0),
  node("confluence-integration", "Confluence library", "module", "powerloom", "PowerLoom.ConfluenceIntegration", 2, 0),
  node("messaging", "Messaging", "module", "powerloom", "Wolverine: queues, sagas, dead letters", 0, 1),
  node("schedule-ticker", "Schedule ticker", "module", "powerloom", "every minute: the cron sources", 1, 1),
  node("pl-infrastructure", "Infrastructure", "module", "powerloom", "persistence, vaults, capture, attachments", 2, 1),
  node("pl-http", "HTTP API", "module", "powerloom", "Wolverine.Http endpoints, OpenAPI, health", 1, 2),
];

const powerloomFeatures: SchemeNode[] = [
  node("pbis", "Pbis", "component", "pl-features", "prepare, notes, user notes, create, finish, delete, repos, skills, attachments"),
  node("tasks", "Tasks", "component", "pl-features", "items, schedules, close, rerun, bugs"),
  node("agents-dispatch", "Agents: dispatch", "component", "pl-features", "schedules, Run now, the validator, claims"),
  node("agent-runs", "Agents: run saga", "component", "pl-features", "StartAgentRun → runner, the callback, timeout"),
  node("reviews", "Reviews", "component", "pl-features", "queue, close, answers"),
  node("docs", "Docs / Records", "component", "pl-features", "www log, registers, chat notes"),
  node("continue", "Continue", "component", "pl-features", "chats in the chosen app: Claude or Codex"),
  node("ai-providers-feature", "AI providers", "component", "pl-features", "Claude token, Connect Codex, chat app"),
  node("drafts", "Drafts", "component", "pl-features", "the drafts scan every 10 minutes"),
  node("import-sources", "Import sources", "component", "pl-features", "Outlook, inbox, meeting recordings (tools/audio-capture)"),
  node("vault-features", "Vaults", "component", "pl-features", "add, trash, features, POWERLOOM.md, .mcp.json and .codex/config.toml"),
  node("skills", "Skills", "component", "pl-features", "edits, revisions"),
  node("status", "Status", "component", "pl-features", "GET /api/status, the dashboard"),
  node("dead-letters", "Dead letters", "component", "pl-features", "list, replay, discard"),
];

const adoLibrary: SchemeNode[] = [
  node("ado-sync", "PBI sync", "component", "ado-integration", "sprint, single PBI, imports; bugs prepared"),
  node("ado-pull-requests", "Pull request check", "component", "ado-integration", "reviews to queue"),
  node("ado-repositories", "Repository catalog", "component", "ado-integration"),
  node("collect-documents", "Linked documents", "component", "ado-integration", "attachments downloaded; web pages read by web agents, tasks for agents without web"),
  node("ado-connection", "Connection", "component", "ado-integration", "settings, test"),
];

const confluenceLibrary: SchemeNode[] = [
  node("sync-pbi-pages", "Page sync", "component", "confluence-integration", "linked pages and their files"),
  node("load-page", "Load page", "component", "confluence-integration", "the PBI page's button"),
];

const messagingParts: SchemeNode[] = [
  node("queue-vault", "vault queue", "component", "messaging", "partitioned per vault, 4 slots"),
  node("queue-dispatch", "dispatch queue", "component", "messaging", "one dispatch at a time"),
  node("queue-runner", "runner queue", "component", "messaging", "one request to the runner at a time"),
  node("inbox", "inbox / scheduled", "component", "messaging", "durable local queues in Postgres"),
  node("dead-letter-store", "dead letters", "component", "messaging", "what Wolverine gave up on"),
];

const infrastructureParts: SchemeNode[] = [
  node("persistence", "Persistence", "component", "pl-infrastructure", "EF Core, migrations at start"),
  node("vault-capture", "VaultCapture", "component", "pl-infrastructure", "pwsh module: drafts, registers"),
  node("vault-scan", "Vault scan", "component", "pl-infrastructure", "notes, links, usage"),
  node("attachments", "Attachments", "component", "pl-infrastructure", "text extraction, storage"),
  node("runner-client", "Runner client", "component", "pl-infrastructure", "POST /runs, GET /health, the sign-ins"),
  node("telemetry", "Telemetry", "component", "pl-infrastructure", "OpenTelemetry → otel-lgtm"),
];

const runnerModules: SchemeNode[] = [
  node("runner-server", "HTTP port", "module", "agent-runner", "POST /runs, GET /health, the Azure and Codex sign-ins", 0, 0),
  node("runner-agents", "Agents", "module", "agent-runner", "the pipeline's agents", 1, 0),
  node("runner-tools", "Tools", "module", "agent-runner", "what an agent can do", 2, 0),
  node("agent-config", "AgentConfig", "module", "agent-runner", "definitions, pause, budgets", 0, 1),
  node("budget", "AgentUsage", "module", "agent-runner", "tokens, cost, budgets", 1, 1),
  node("agent-runtime", "AgentRuntime", "module", "agent-runner", "Claude Agent SDK, Codex SDK, repo cache", 2, 1),
];

const runnerAgents: SchemeNode[] = [
  node("agent-planning", "planning", "component", "runner-agents"),
  node("agent-implementation", "implementation", "component", "runner-agents", "GSD execution on the PBI branch, local commits only"),
  node("agent-tech-writer", "tech-writer", "component", "runner-agents"),
  node("agent-code-review", "code-review", "component", "runner-agents"),
  node("agent-vault-review", "vault-review", "component", "runner-agents"),
  node("agent-better-refinement", "better-refinement", "component", "runner-agents"),
  node("agent-better-research", "better-research", "component", "runner-agents"),
  node("agent-better-review", "better-review", "component", "runner-agents"),
  node("agent-autotest", "autotest", "component", "runner-agents", "Playwright through DevHub"),
  node("agent-custom", "your agents", "component", "runner-agents", "made on the Agents page; the generic executor"),
];

const runnerTools: SchemeNode[] = [
  node("tool-attachments", "attachments", "component", "runner-tools"),
  node("tool-confluence", "confluence", "component", "runner-tools"),
  node("tool-findings", "findings", "component", "runner-tools"),
  node("tool-human-tasks", "human tasks", "component", "runner-tools"),
  node("tool-vault-capture", "vault capture", "component", "runner-tools"),
  node("tool-web", "web research", "component", "runner-tools"),
  node("tool-repos", "repo cache", "component", "runner-tools"),
  node("tool-pbi-context", "PBI context", "component", "runner-tools", "read_pbi: the context of every run on a PBI"),
  node("tool-create-task", "create task", "component", "runner-tools", "tasks for other agents or the user"),
  node("tool-sql", "read SQL", "component", "runner-tools"),
  node("tool-azure", "read Azure", "component", "runner-tools", "Microsoft's Azure MCP Server per run (read-only, an az shim for the sign-in); Service Bus peek"),
  node("tool-mongo", "read Mongo", "component", "runner-tools", "find, aggregate; Cosmos strings fetched at call time"),
  node("tool-devhub", "DevHub", "component", "runner-tools"),
  node("tool-ado", "ADO (read)", "component", "runner-tools", "work items, pull requests with their threads, test cases (saved to the PBI)"),
  node("tool-access", "access requests", "component", "runner-tools", "every outside call logged; a refused one becomes a human task"),
];

const webParts: SchemeNode[] = [
  node("web-pages", "Pages", "module", "web", "Dashboard, Backlog, Tasks, Reviews, Vault, Agents, Runs, Settings", 0, 0),
  node("web-client", "PowerLoom client", "module", "web", "openapi-fetch, typed from the OpenAPI document", 0, 1),
];

const databaseParts: SchemeNode[] = [
  node("schema-public", "public", "component", "database", "PBIs, items, runs, settings"),
  node("schema-powerloom", "powerloom", "component", "database", "Wolverine's tables"),
  node("schema-agent-config", "agent_config", "component", "database", "AgentConfig"),
  node("schema-agent-usage", "agent_usage", "component", "database", "AgentUsage"),
];

export const SCHEME_NODES: SchemeNode[] = [
  ...topLevel, ...aiProviders, ...powerloomModules, ...powerloomFeatures, ...adoLibrary, ...confluenceLibrary, ...messagingParts, ...infrastructureParts,
  ...runnerModules, ...runnerAgents, ...runnerTools, ...webParts, ...databaseParts,
];

export const SCHEME_LINKS: SchemeLink[] = [
  link("web-client", "pl-http", "HTTP API"),
  link("web-pages", "schema-public", "reads"),
  link("persistence", "schema-public"),
  link("messaging", "schema-powerloom"),
  link("agents-dispatch", "schedule-ticker"),
  link("agent-runs", "runner-client"),
  link("runner-client", "runner-server", "POST /runs"),
  link("runner-server", "pl-http", "completed"),
  link("ado-sync", "ado"),
  link("ado-pull-requests", "ado"),
  link("ado-repositories", "ado"),
  link("collect-documents", "ado"),
  link("sync-pbi-pages", "confluence"),
  link("load-page", "confluence"),
  link("vault-capture", "vaults"),
  link("vault-scan", "vaults"),
  link("pbis", "vaults", "backlog notes"),
  link("telemetry", "otel-lgtm"),
  link("agent-runtime", "claude"),
  link("agent-runtime", "codex"),
  link("ai-providers-feature", "runner-client", "Codex sign-in"),
  link("continue", "chat-apps", "Continue with …"),
  link("chat-apps", "mcp", "MCP"),
  link("mcp", "schema-public", "reads"),
  link("mcp", "pl-http", "writes"),
  link("tool-repos", "repos"),
  link("tool-vault-capture", "vaults"),
  link("tool-confluence", "confluence"),
  link("tool-sql", "sql-server"),
  link("tool-azure", "azure"),
  link("tool-mongo", "mongo"),
  link("tool-devhub", "devhub"),
  link("tool-ado", "ado", "work items, PRs"),
  link("tool-pbi-context", "schema-public"),
  link("tool-access", "schema-public"),
  link("mcp", "schema-public", "reads"),
  link("mcp", "pl-http", "writes"),
  link("runner-agents", "schema-public"),
  link("agent-config", "schema-agent-config"),
  link("budget", "schema-agent-usage"),
  link("agent-config", "web-pages", "Config, Pause"),
  link("backup", "database"),
];
