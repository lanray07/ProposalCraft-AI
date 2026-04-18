import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { createProposalCraftServer } from "./mcp.js";

type SessionRecord = {
  server: Server;
  transport: SSEServerTransport;
};

const sessions = new Map<string, SessionRecord>();
const ssePath = "/mcp";
const postPath = "/mcp/messages";

async function handleSseRequest(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const server = createProposalCraftServer();
  const transport = new SSEServerTransport(postPath, res);
  const sessionId = transport.sessionId;

  sessions.set(sessionId, { server, transport });

  transport.onclose = async () => {
    sessions.delete(sessionId);
    await server.close();
  };

  transport.onerror = (error) => {
    console.error("SSE transport error", error);
  };

  try {
    await server.connect(transport);
  } catch (error) {
    sessions.delete(sessionId);
    console.error("Failed to start SSE session", error);

    if (!res.headersSent) {
      res.writeHead(500).end("Failed to establish SSE connection");
    }
  }
}

async function handlePostMessage(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");

  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    res.writeHead(400).end("Missing sessionId query parameter");
    return;
  }

  const session = sessions.get(sessionId);

  if (!session) {
    res.writeHead(404).end("Unknown session");
    return;
  }

  try {
    await session.transport.handlePostMessage(req, res);
  } catch (error) {
    console.error("Failed to process message", error);

    if (!res.headersSent) {
      res.writeHead(500).end("Failed to process message");
    }
  }
}

export async function handleMcpHttpRequest(
  req: IncomingMessage,
  res: ServerResponse
) {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  const isMcpPath = url.pathname === ssePath || url.pathname === postPath;

  if (req.method === "OPTIONS" && isMcpPath) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type"
    });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === ssePath) {
    await handleSseRequest(res);
    return;
  }

  if (req.method === "POST" && url.pathname === postPath) {
    await handlePostMessage(req, res, url);
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, name: "proposalcraft-ai" }));
    return;
  }

  res.writeHead(404).end("Not Found");
}

const portEnv = Number(process.env.PORT ?? 8000);
const port = Number.isFinite(portEnv) ? portEnv : 8000;

if (process.argv[1]?.endsWith("http.ts") || process.argv[1]?.endsWith("http.js")) {
  const httpServer = createServer(handleMcpHttpRequest);

  httpServer.on("clientError", (error: Error, socket) => {
    console.error("HTTP client error", error);
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
  });

  httpServer.listen(port, () => {
    console.log(`ProposalCraft AI MCP server listening on http://localhost:${port}`);
    console.log(`SSE stream: GET http://localhost:${port}${ssePath}`);
    console.log(
      `Message endpoint: POST http://localhost:${port}${postPath}?sessionId=...`
    );
  });
}
