import { fetchTgjuPriceSync, type PriceSyncRequest } from "../app/lib/tgju";
import { createCachedPriceSync } from "./tgju-cache";

const PORT = Number(process.env.PORT ?? 5780);
const HOST = process.env.HOST ?? "127.0.0.1";
const API_PATH = "/sarmaye-man-api/prices/sync";
const DEPLOY_TRIGGER_PATH = process.env.DEPLOY_TRIGGER_PATH ?? "";
const DEPLOY_TRIGGER_TOKEN = process.env.DEPLOY_TRIGGER_TOKEN ?? "";
const DEPLOY_TRIGGER_FILE = process.env.DEPLOY_TRIGGER_FILE ?? "";
const cachedPriceSync = createCachedPriceSync(fetchTgjuPriceSync);

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "POST, OPTIONS");
  headers.set("access-control-allow-headers", "content-type, accept");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");
  if (scheme.toLowerCase() === "bearer" && token) return token;
  return request.headers.get("x-deploy-token") ?? "";
}

async function triggerDeployPoll() {
  if (!DEPLOY_TRIGGER_FILE) throw new Error("Deploy trigger file is not configured");
  const { writeFile } = await import("node:fs/promises");
  await writeFile(DEPLOY_TRIGGER_FILE, `${new Date().toISOString()}\n`, "utf8");
}

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return jsonResponse({ ok: true });
  }

  if (url.pathname === "/health" || url.pathname === "/sarmaye-man-api/health") {
    return jsonResponse({ ok: true, service: "sarmaye-man-tgju", time: new Date().toISOString() });
  }

  if (DEPLOY_TRIGGER_PATH && url.pathname === DEPLOY_TRIGGER_PATH) {
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, { status: 405 });
    }

    if (!DEPLOY_TRIGGER_TOKEN) {
      return jsonResponse({ error: "Deploy trigger is disabled" }, { status: 503 });
    }

    if (getBearerToken(request) !== DEPLOY_TRIGGER_TOKEN) {
      return jsonResponse({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      await triggerDeployPoll();
      return jsonResponse({
        ok: true,
        triggered: true,
        time: new Date().toISOString(),
      }, { status: 202 });
    } catch (error) {
      return jsonResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Deploy trigger failed",
      }, { status: 502 });
    }
  }

  if (url.pathname !== API_PATH) {
    return jsonResponse({ error: "Not found" }, { status: 404 });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = (await request.json()) as PriceSyncRequest;
    return jsonResponse(await cachedPriceSync(body, fetch));
  } catch (error) {
    return jsonResponse(
      {
        records: [],
        fetchedAt: new Date().toISOString(),
        errors: [error instanceof Error ? error.message : "خطای دریافت قیمت"],
      },
      { status: 502 },
    );
  }
}

const { createServer } = await import("node:http");

createServer(async (incoming, outgoing) => {
  const chunks: Buffer[] = [];
  for await (const chunk of incoming) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const request = new Request(`http://${incoming.headers.host ?? `${HOST}:${PORT}`}${incoming.url ?? "/"}`, {
    body: chunks.length ? Buffer.concat(chunks) : undefined,
    headers: incoming.headers as HeadersInit,
    method: incoming.method,
  });
  const response = await handleRequest(request);
  outgoing.writeHead(response.status, Object.fromEntries(response.headers));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
}).listen(PORT, HOST, () => {
  console.log(`sarmaye-man TGJU service listening on http://${HOST}:${PORT}`);
});
