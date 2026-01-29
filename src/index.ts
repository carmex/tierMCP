import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
    ListPromptsRequestSchema,
    GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { generateTierListImage } from "./drawer";
import { TierListConfig, DEFAULT_TIERS } from "./types";
import { ClientError } from "./errors";

// Schema definition for the tool (synced with capabilities)
const GenerateTierListSchema = z.object({
    title: z.string().optional(),
    backgroundColor: z.string().optional(),
    tiers: z.array(z.object({
        id: z.string(),
        label: z.string().max(50),
        color: z.string()
    })).optional(),
    items: z.array(z.object({
        id: z.string(),
        tier: z.string(),
        imageUrl: z.string().optional(),
        text: z.string().max(50).optional()
    }))
});

const server = new Server(
    {
        name: "tier-list-mcp",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
            resources: {},
            prompts: {},
        },
    }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "generate_tier_list",
                description: "Generate a tier list image from a list of items and rankings. Returns the image as a base64 string.",
                inputSchema: {
                    type: "object",
                    properties: {
                        title: { type: "string", description: "Title of the tier list" },
                        backgroundColor: { type: "string", description: "Background color hex code (default #1e1e1e)" },
                        tiers: {
                            type: "array",
                            description: "Custom tier definitions (optional, defaults to S-F)",
                            items: {
                                type: "object",
                                properties: {
                                    id: { type: "string" },
                                    label: { type: "string", description: "Max 50 characters" },
                                    color: { type: "string" }
                                },
                                required: ["id", "label", "color"]
                            }
                        },
                        items: {
                            type: "array",
                            description: "Items to place on the tier list",
                            items: {
                                type: "object",
                                properties: {
                                    id: { type: "string" },
                                    tier: { type: "string", description: "ID or Label of the tier to place this item in" },
                                    imageUrl: { type: "string", description: "URL of the item image" },
                                    text: { type: "string", description: "Text label if no image (Max 50 characters)" }
                                },
                                required: ["id", "tier"]
                            }
                        }
                    },
                    required: ["items"]
                },
            },
            // Removed get_default_tiers tool in favor of resource
        ],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
        if (request.params.name === "generate_tier_list") {
            const args = GenerateTierListSchema.parse(request.params.arguments);

            // Structured logging for application events
            console.error(JSON.stringify({
                level: 'info',
                event: 'tool_call',
                tool: 'generate_tier_list',
                title: args.title,
                itemCount: args.items.length,
                tierCount: args.tiers?.length ?? 'default'
            }));

            const config: TierListConfig = {
                title: args.title,
                backgroundColor: args.backgroundColor,
                tiers: args.tiers, // If undefined, drawer uses default
                items: args.items
            };

            const imageBuffer = await generateTierListImage(config);
            const base64Image = imageBuffer.toString('base64');

            return {
                content: [
                    {
                        type: "image",
                        data: base64Image,
                        mimeType: "image/png",
                    },
                ],
            };
        }

        throw new ClientError(`Unknown tool: ${request.params.name}`);
    } catch (error) {
        if (error instanceof z.ZodError) {
            // Log validation errors
            console.error(JSON.stringify({
                level: 'warn',
                event: 'validation_error',
                tool: request.params.name,
                error: error.message
            }));
            return {
                content: [{ type: "text", text: `Validation Error: ${error.message}` }],
                isError: true,
            };
        }
        if (error instanceof ClientError) {
            console.error(JSON.stringify({
                level: 'warn',
                event: 'client_error',
                tool: request.params.name,
                error: error.message
            }));
            return {
                content: [{ type: "text", text: error.message }],
                isError: true,
            };
        }

        // Log full error for server admin
        console.error(JSON.stringify({
            level: 'error',
            event: 'system_error',
            tool: request.params.name,
            error: String(error)
        }));
        console.error(error); // Also log full stack trace nicely

        // Return generic error to client to avoid leaking implementation details
        return {
            content: [
                {
                    type: "text",
                    text: "An internal error occurred while generating the tier list.",
                },
            ],
            isError: true,
        };
    }
});

// Resources implementation
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
        resources: [
            {
                uri: "tier-list://defaults",
                name: "Default Tiers",
                mimeType: "application/json",
                description: "The default tier configuration (S, A, B, etc.) used if no custom tiers are provided."
            }
        ]
    };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    if (request.params.uri === "tier-list://defaults") {
        return {
            contents: [{
                uri: request.params.uri,
                mimeType: "application/json",
                text: JSON.stringify(DEFAULT_TIERS, null, 2)
            }]
        };
    }

    throw new Error(`Resource not found: ${request.params.uri}`);
});

// Prompts implementation
server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
        prompts: [
            {
                name: "generate-tier-list",
                description: "Template for generating a tier list",
            }
        ]
    };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    if (request.params.name === "generate-tier-list") {
        return {
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: `Please generate a tier list with the following structure:
{
  "title": "My Tier List",
  "items": [
    { "id": "1", "tier": "S", "text": "Item 1" },
    { "id": "2", "tier": "A", "text": "Item 2" }
  ]
}`
                    }
                }
            ]
        };
    }
    throw new Error("Prompt not found");
});

async function run() {
    const transportType = process.env.MCP_TRANSPORT || "stdio";

    if (transportType === "http") {
        const app = express();
        app.use(cors());
        app.use(morgan('combined'));

        const transport = new StreamableHTTPServerTransport();
        await server.connect(transport);

        app.all("/mcp", async (req, res) => {
            await transport.handleRequest(req, res);
        });

        const port = process.env.PORT || 3003;
        app.listen(port, () => {
            console.log(`Tier List MCP Server running on StreamableHTTP at http://localhost:${port}/mcp`);
        });

    } else {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error("Tier List MCP Server running on stdio");
    }
}

run().catch((error) => {
    console.error("Fatal error running server:", error);
    process.exit(1);
});
