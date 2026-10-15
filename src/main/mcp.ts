import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { localhostHostValidation, localhostOriginValidation, NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { McpServer } from '@modelcontextprotocol/server';
import type { Repository } from './db/repository';
import { createMcpTools, type McpBridge } from './mcpTools';

// Local MCP endpoint inside the running app: Streamable HTTP on 127.0.0.1,
// Host/Origin validated and protected by a bearer token kept in userData.

const PREFERRED_PORT = 47615;

export type McpInfo = { url: string; token: string };

const loadToken = (file: string): string => {
  try {
    const saved = JSON.parse(readFileSync(file, 'utf8')) as { token?: string };
    if (typeof saved.token === 'string' && saved.token.length >= 32) return saved.token;
  } catch {
    // first run
  }
  const token = randomBytes(24).toString('hex');
  writeFileSync(file, JSON.stringify({ token }), { mode: 0o600 });
  return token;
};

const authorized = (req: IncomingMessage, token: string) => {
  const header = req.headers.authorization ?? '';
  const given = Buffer.from(header.replace(/^Bearer\s+/i, ''));
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
};

const listen = (server: Server, port: number) =>
  new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });

export const startMcpServer = async (userData: string, repo: Repository, bridge: McpBridge): Promise<McpInfo> => {
  const token = loadToken(path.join(userData, 'mcp-token.json'));
  const tools = createMcpTools(repo, bridge);
  const validateHost = localhostHostValidation();
  const validateOrigin = localhostOriginValidation();

  const server = createServer(async (req, res) => {
    if (!validateHost(req, res) || !validateOrigin(req, res)) return;
    if (!req.url?.startsWith('/mcp')) {
      res.writeHead(404).end();
      return;
    }
    if (!authorized(req, token)) {
      res.writeHead(401, { 'WWW-Authenticate': 'Bearer' }).end('unauthorized');
      return;
    }
    // Stateless: one server + transport per request.
    const mcp = new McpServer({ name: 'petnudge', version: '0.1.0' });
    for (const [name, tool] of Object.entries(tools)) {
      mcp.registerTool(
        name,
        { description: tool.description, inputSchema: tool.inputSchema },
        tool.handler as Parameters<typeof mcp.registerTool>[2]
      );
    }
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => void mcp.close());
    await mcp.connect(transport);
    await transport.handleRequest(req, res);
  });

  let port: number;
  try {
    port = await listen(server, PREFERRED_PORT);
  } catch {
    port = await listen(server, 0);
  }
  return { url: `http://127.0.0.1:${port}/mcp`, token };
};
