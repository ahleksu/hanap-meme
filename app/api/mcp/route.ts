import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp";
import { rateLimit, siteUrl } from "@/lib/http";

// Stateless Streamable HTTP: a fresh server and transport per request, no session ids.
async function handle(req: Request) {
  const limited = rateLimit(req, "mcp", 60);
  if (limited) return limited;
  const server = createMcpServer(siteUrl(req));
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export { handle as GET, handle as POST, handle as DELETE };
