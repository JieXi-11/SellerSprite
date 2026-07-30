---
name: sellersprite-research
description: Use SellerSprite MCP whenever the user asks for SellerSprite data, Amazon ASIN analysis, reverse ASIN keywords, traffic keywords, competitor lookup, product research, keyword research, ABA data, market analysis, BSR sales estimates, offer or sales trends, or SellerSprite reviews. Trigger on Chinese requests such as 卖家精灵、查ASIN、流量词、关键词反查、查竞品、选产品、选市场、ABA、销量趋势 and 评论分析.
---

# SellerSprite Research

Use the bundled SellerSprite MCP tools for SellerSprite-backed Amazon research. Do not substitute general web search when the user explicitly requests SellerSprite data.

## Workflow

1. Call `sellersprite_session_status` before a data request.
2. If `ready` is false, call `sellersprite_login` with `waitSeconds: 180` and let the user sign in through the opened browser window.
3. Find the required feature with `sellersprite_list_operations`. Search using the user's business term instead of guessing an operation name.
4. Call `sellersprite_describe_operation` and follow its `tool_input`, defaults, enums, and prerequisites.
5. Call `sellersprite_call` with only documented parameters.
6. Label returned SellerSprite measurements separately from interpretation or recommendations.

For extension-authenticated operations, check that `extension.valid` is true. If it is false, tell the user to install and sign in to the SellerSprite extension in the same MCP browser profile, then check status again.

## Examples

- `分析这个 ASIN 的流量词` means discover the reverse-ASIN or traffic-keyword operation, inspect its required marketplace and ASIN parameters, then execute it.
- `查询美国站某关键词的趋势` means discover the relevant keyword trend operation and request the marketplace and date fields required by its contract.
- `分析类目竞争度` means discover market research and concentration operations rather than relying on Amazon page observations alone.
