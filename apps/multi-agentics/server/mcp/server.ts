/**
 * Stdio MCP server for New Level Multi-Agentics.
 *
 * Exposes the platform engine over the Model Context Protocol so external MCP
 * clients (Claude Desktop, IDEs, other agents) can submit goals, inspect runs,
 * search knowledge and approve tasks. Run standalone with `npm run mcp`.
 *
 * IMPORTANT: stdout is reserved for the MCP wire protocol, so this process must
 * never print to stdout. Our logger only writes to stderr (for errors), keeping
 * the channel clean.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { getDb } from '../db/db'
import { initState } from '../state'
import { MCP_TOOLS } from './tools'

export const MCP_SERVER_META = {
  name: 'new-level-multi-agentics',
  version: '1.0.0',
}

export function buildMcpServer(): Server {
  const server = new Server(MCP_SERVER_META, { capabilities: { tools: {} } })

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: MCP_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as { type: 'object' },
    })),
  }))

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = MCP_TOOLS.find((t) => t.name === req.params.name)
    if (!tool) {
      return { isError: true, content: [{ type: 'text', text: `Unknown tool: ${req.params.name}` }] }
    }
    try {
      const result = await tool.handler((req.params.arguments ?? {}) as Record<string, unknown>)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    } catch (err) {
      return { isError: true, content: [{ type: 'text', text: `Error: ${String(err)}` }] }
    }
  })

  return server
}

async function main() {
  // The MCP process owns its own state + DB connection.
  getDb()
  initState()
  const server = buildMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // eslint-disable-next-line no-console
  console.error('[mcp] New Level Multi-Agentics MCP server ready on stdio')
}

// Only auto-start when invoked directly (not when imported by the REST app).
const invokedDirectly = process.argv[1] && process.argv[1].endsWith('server.ts')
if (invokedDirectly) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[mcp] fatal:', err)
    process.exit(1)
  })
}
