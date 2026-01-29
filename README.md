# Tier List MCP Server

An [MCP](https://modelcontextprotocol.io/) server that generates "Tiermaker-style" tier list images.

## Features
-   Generates typical S/A/B/C/D/F tier lists.
-   Supports custom tier labels and colors.
-   Supports images (via URL) and text labels for items.
-   Outputs base64-encoded PNG images ready for display by MCP clients.

## Quick Start (No Install)

You can use the hosted version of this MCP server without installing anything.

Add this to your MCP settings file (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "tier-list": {
      "url": "https://tiermcp.crmx.pw/sse",
      "type": "sse"
    }
  }
}
```

## Installation

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Build the project:
    ```bash
    npm run build
    ```

## Usage

### Running the Server
The server runs over stdio. Configure your MCP client (e.g., Claude Desktop, etc.) to run:

```bash
node /path/to/tierMCP/dist/index.js
```

### JSON-RPC Configuration
Add this to your MCP settings file:

```json
{
  "mcpServers": {
    "tier-list": {
      "command": "node",
      "args": ["/path/to/tierMCP/dist/index.js"]
    }
  }
}
```

## Tools

### `generate_tier_list`
Generates the image.

**Input Schema:**
```json
{
  "title": "My Tier List",
  "items": [
    { "id": "1", "tier": "S", "text": "Best Thing" },
    { "id": "2", "tier": "F", "imageUrl": "https://example.com/bad_thing.png" }
  ]
}
```

### `get_default_tiers`
Returns the default configuration (S, A, B, C, D, F) with their colors.

## Development

-   **Test Generation**: Run a local test script to generate a `test_output.png`.
    ```bash
    npm run test-gen
    ```

## Contributing
Feature requests and pull requests are welcome! Feel free to open an issue or submit a PR.
