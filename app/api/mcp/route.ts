import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp";
import { rateLimit, siteUrl } from "@/lib/http";

// Stateless Streamable HTTP: a fresh server and transport per request, no session ids.
async function handle(req: Request) {
  const limited = rateLimit(req, "mcp", 60) ?? rateLimit(req, "mcp-all", 2_000, 3_600_000, true);
  if (limited) return limited;
  const server = createMcpServer(siteUrl(req));
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export { handle as GET, handle as POST, handle as DELETE };
