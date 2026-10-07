// MIT License — Copyright (c) 2026 Decentralized Science Labs
// The two MCP transports: Streamable HTTP (POST JSON-RPC to /mcp, answered as JSON; remote agents such as Claude and
// ChatGPT) and stdio (one JSON message per line; local agents such as Claude Code or Codex).
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, GET, OPTIONS",
  "access-control-allow-headers": "content-type, accept, authorization, mcp-protocol-version, mcp-session-id, last-event-id",
  "access-control-expose-headers": "mcp-session-id",
};
const text = (body, status, extra = {}) => new Response(body, { status, headers: { ...CORS, "content-type": "text/plain; charset=utf-8", ...extra } });
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });

// Requests per client per minute (the client's address, or X-Forwarded-For behind nginx).
function limiter(perMinute, now) {
  const seen = new Map();
  return (key) => {
    const t = now(), w = seen.get(key) || [];
    while (w.length && t - w[0] > 60_000) w.shift();
    if (w.length >= perMinute) return false;
    w.push(t); seen.set(key, w);
    if (seen.size > 5_000) for (const [k, v] of seen) if (!v.length || t - v.at(-1) > 60_000) seen.delete(k);
    return true;
  };
}

export function httpHandler(mcp, { path = "/mcp", maxBody = 64 * 1024, perMinute = 120, trustProxy = true, now = () => Date.now() } = {}) {
  const allow = limiter(perMinute, now);
  return async (req, info) => {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (url.pathname !== path) return url.pathname === "/" ? text(`GL1F Crypto MCP server: POST JSON-RPC to ${path}\n`, 200) : text("Not found\n", 404);
    if (req.method === "GET") return text("This server answers each POST directly and does not stream.\n", 405, { allow: "POST, OPTIONS" });
    if (req.method !== "POST") return text("Method not allowed\n", 405, { allow: "POST, OPTIONS" });
    const client = (trustProxy && req.headers.get("x-forwarded-for")?.split(",")[0].trim()) || info?.remoteAddr?.hostname || "local";
    if (!allow(client)) return json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "Too many requests: try again in a minute" } }, 429);
    if (Number(req.headers.get("content-length") || 0) > maxBody) return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Request too large" } }, 413);
    let body;
    try { const raw = await req.text(); if (raw.length > maxBody) throw new Error("too large"); body = JSON.parse(raw); }
    catch { return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400); }
    const batch = Array.isArray(body), out = (await Promise.all((batch ? body : [body]).map((m) => mcp.handle(m)))).filter(Boolean);
    if (!out.length) return new Response(null, { status: 202, headers: CORS });   // notifications and responses only
    return json(batch ? out : out[0]);
  };
}

export async function serveStdio(mcp, { input = Deno.stdin.readable, output = Deno.stdout.writable } = {}) {
  const writer = output.getWriter(), enc = new TextEncoder();
  let queue = Promise.resolve();
  const write = (msg) => (queue = queue.then(() => writer.write(enc.encode(`${JSON.stringify(msg)}\n`))));
  let buffer = "";
  for await (const chunk of input.pipeThrough(new TextDecoderStream())) {
    buffer += chunk;
    let i;
    while ((i = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, i).trim(); buffer = buffer.slice(i + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }); continue; }
      for (const m of Array.isArray(msg) ? msg : [msg]) mcp.handle(m).then((r) => r && write(r)).catch((e) => console.error("mcp:", e.message));
    }
  }
  await queue;
}
