# SellerSprite Codex Marketplace

This repository is a Codex plugin marketplace containing [SellerSprite MCP](plugins/sellersprite-mcp/README.md).

## Add To Codex

In **Add plugin marketplace**, enter:

| Field | Value |
|---|---|
| Source | `https://github.com/JieXi-11/SellerSprite` |
| Git ref | `main` |
| Sparse checkout path | Leave empty |

After adding the marketplace, install **SellerSprite MCP**, refresh Codex, and start a new task.

The marketplace manifest is located at [`.agents/plugins/marketplace.json`](.agents/plugins/marketplace.json). The plugin source is under [`plugins/sellersprite-mcp`](plugins/sellersprite-mcp/).
