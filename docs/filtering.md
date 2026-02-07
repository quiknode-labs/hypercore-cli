---
title: Stream Filtering Guide
description: Complete guide to filtering Hyperliquid streaming data with gRPC and JSON-RPC/WebSocket APIs
---

## Overview

Hyperliquid streaming APIs support powerful filtering capabilities to help you receive only the data you need. Filters work across **gRPC**, **JSON-RPC**, and **WebSocket** protocols, allowing you to subscribe to specific events, users, trading pairs, and more.

**Supported Protocols:**
<br />

- **gRPC Streaming API** - High-performance streaming with filters
- **JSON-RPC over WebSocket** - Standard WebSocket filtering
- **WebSocket API** - Real-time filtered subscriptions

## Why Use Filtering?

Without filtering, streaming from Hyperliquid can generate massive amounts of data. The exchange processes thousands of trades, orders, and events per minute across hundreds of trading pairs. Filtering is essential because it allows you to:

- **Reduce bandwidth and improve performance** - Receive only relevant data instead of processing everything, significantly reducing network traffic and processing overhead
- **Focus on specific data** - Track particular trading pairs, users, or event types instead of consuming all market data
- **Build efficient applications** - Create focused applications without overwhelming data streams that could impact performance
- **Enable real-time decision making** - Process targeted data faster for alerts, notifications, and trading decisions

## Basic Filtering Concepts

Before diving into syntax, here are the key concepts:
<br />

1. **Streams** - Different data types (trades, orders, events, etc.)
2. **Fields** - Properties within each stream that can be filtered 
3. **Values** - Specific criteria you want to match
4. **Logic** - How multiple filters combine (AND/OR)

**Simple Example:**
```
"I want to see only BTC trades that are buys (not sells)"

WebSocket Filter: {"coin": ["BTC"], "side": ["B"]}
gRPC Filter: {"coin": {"values": ["BTC"]}, "side": {"values": ["B"]}}
```

## Available Streams

<div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
<StyledTable
  columns={[
    { key: 'stream', label: 'Stream Name', width: '25%', align: 'left' },
    { key: 'description', label: 'Description', width: '45%', align: 'left' },
    { key: 'format', label: 'Data Format', width: '30%', align: 'left' }
  ]}
  showMobileCards={true}
  data={[
    { stream: 'trades', description: 'Filled trades/executions', format: 'Tuple: [user_address, fill_data]' },
    { stream: 'orders', description: 'Order status updates', format: 'Object with order fields' },
    { stream: 'book_updates', description: 'Order book changes', format: 'Object with price/size' },
    { stream: 'twap_orders', description: 'TWAP order statuses', format: 'Flexible object' },
    { stream: 'events', description: 'Ledger updates, deposits, withdrawals, funding', format: 'Nested object' },
    { stream: 'writer_actions', description: 'System actions, spot sends', format: 'Object with action type' },
    { stream: 'blocks', description: 'Raw replica commands (gRPC only, NO FILTERING)', format: 'Full block data' }
  ]}
/>
</div>

## Filter Syntax

WebSocket and gRPC APIs use similar filter logic, but with different syntax:

<br />

<Tabs>
<TabItem value="websocket" label="WebSocket (JSON-RPC)" default>

```json
{
  "jsonrpc": "2.0",
  "method": "hl_subscribe",
  "params": {
    "streamType": "trades",
    "filters": {
      "<field_name>": ["<value1>", "<value2>"]
    },
    "filterName": "optional_name"
  },
  "id": 1
}
```

**Key points:**
- `streamType`: Stream name (trades, events, etc.)
- `filters`: Each field maps directly to an array of values
- `filterName`: Optional name for this filter (enables OR logic, unsubscribe by name)
- **Multiple streams require separate subscription requests**

</TabItem>
<TabItem value="grpc" label="gRPC">

```protobuf
Subscribe {
  stream_type: <STREAM_TYPE_ENUM>,
  filters: {
    "<field_name>": FilterValues { values: ["<value1>", "<value2>"] }
  }
}
```

</TabItem>
</Tabs>

## Filter Logic

### AND Across Fields
When multiple fields are specified, **ALL** must match:

```json
// WebSocket
{"filters": {"coin": ["BTC"], "side": ["B"]}}
```
Returns events where coin=BTC **AND** side=B

### OR Within Field
When multiple values are specified for one field, **ANY** can match:

```json
// WebSocket
{"filters": {"coin": ["BTC", "ETH", "HYPE"]}}
```
Returns events where coin=BTC **OR** coin=ETH **OR** coin=HYPE

### Combined Example

```json
// WebSocket
{"filters": {"coin": ["BTC", "ETH"], "side": ["B"]}}
```
Returns events where (coin=BTC **OR** coin=ETH) **AND** side=B

### OR Across Named Filters (Advanced)

Multiple subscriptions with different `filterName` values on the same stream = OR logic between them.

**Request 1:**
```json
{
  "jsonrpc": "2.0",
  "method": "hl_subscribe",
  "params": {
    "streamType": "trades",
    "filters": {
      "coin": ["BTC"],
      "side": ["B"]
    },
    "filterName": "btc_buys"
  },
  "id": 1
}
```

**Request 2:**
```json
{
  "jsonrpc": "2.0",
  "method": "hl_subscribe",
  "params": {
    "streamType": "trades",
    "filters": {
      "coin": ["ETH"],
      "side": ["A"]
    },
    "filterName": "eth_sells"
  },
  "id": 2
}
```

Returns (BTC AND side=B) OR (ETH AND side=A)

This is impossible with a single filter since AND applies across all fields.

### Recursive Field Matching
Filters automatically search through nested JSON objects:

```json
// This data:
{"inner": {"LedgerUpdate": {"users": ["0xABC"], "delta": {"type": "deposit"}}}}

// Matches this WebSocket filter:
{"filters": {"type": ["deposit"]}}
```

## Special Filter Values

<div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
<StyledTable
  columns={[
    { key: 'value', label: 'Value', width: '20%', align: 'left' },
    { key: 'meaning', label: 'Meaning', width: '30%', align: 'left' },
    { key: 'usecase', label: 'Use Case', width: '50%', align: 'left' }
  ]}
  showMobileCards={true}
  data={[
    { value: '"*"', meaning: 'Field exists (any value)', usecase: 'Find all liquidations: {"liquidation": {"values": ["*"]}}' },
    { value: '"exists"', meaning: 'Same as "*"', usecase: 'Alternative syntax: {"liquidation": {"values": ["exists"]}}' },
    { value: '"null"', meaning: 'Field is null', usecase: 'Find unfilled TWAPs: {"twapId": {"values": ["null"]}}' }
  ]}
/>
</div>

<details>
<summary><strong>Existence Filter Examples</strong></summary>

```json
// Find all trades that are liquidations (WebSocket)
{"filters": {"liquidation": ["*"]}}

// Find all trades with a builder (WebSocket)
{"filters": {"builder": ["*"]}}

// Find trades without TWAP ID (WebSocket)
{"filters": {"twapId": ["null"]}}
```

</details>

## Stream-Specific Fields

### Trades Stream

Filter completed trades and fills by user, trading pair, side, price, and execution details.

**Format:** Each event is a tuple `[user_address, fill_data]`

<div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
<StyledTable
  columns={[
    { key: 'field', label: 'Field', width: '15%', align: 'left' },
    { key: 'type', label: 'Type', width: '10%', align: 'left' },
    { key: 'description', label: 'Description', width: '30%', align: 'left' },
    { key: 'example', label: 'Example Filter', width: '45%', align: 'left' }
  ]}
  showMobileCards={true}
  data={[
    { field: 'user', type: 'string', description: 'Wallet address (matches tuple first element)', example: '{"user": {"values": ["0x123..."]}}' },
    { field: 'coin', type: 'string', description: 'Trading pair', example: '{"coin": {"values": ["BTC", "ETH"]}}' },
    { field: 'side', type: 'string', description: '"A" (ask/sell) or "B" (bid/buy)', example: '{"side": {"values": ["B"]}}' },
    { field: 'px', type: 'string', description: 'Execution price', example: '{"px": {"values": ["50000"]}}'},
    { field: 'sz', type: 'string', description: 'Size executed', example: '—' },
    { field: 'dir', type: 'string', description: 'Direction', example: '{"dir": {"values": ["Open Long", "Close Short"]}}' },
    { field: 'crossed', type: 'boolean', description: 'Crossed the spread', example: '{"crossed": {"values": ["true"]}}' },
    { field: 'fee', type: 'string', description: 'Fee amount', example: '—' },
    { field: 'feeToken', type: 'string', description: 'Fee token', example: '{"feeToken": {"values": ["USDC"]}}' },
    { field: 'hash', type: 'string', description: 'Transaction hash', example: '{"hash": {"values": ["0xabc..."]}}' },
    { field: 'oid', type: 'number', description: 'Order ID', example: '{"oid": {"values": ["12345"]}}'},
    { field: 'tid', type: 'number', description: 'Trade ID', example: '—' },
    { field: 'cloid', type: 'string', description: 'Client order ID (optional)', example: '{"cloid": {"values": ["0x..."]}}' },
    { field: 'twapId', type: 'number/null', description: 'TWAP ID if from TWAP', example: '{"twapId": {"values": ["*"]}}' },
    { field: 'builder', type: 'string', description: 'Builder address (optional)', example: '{"builder": {"values": ["0x999..."]}}' },
    { field: 'builderFee', type: 'string', description: 'Builder fee (optional)', example: '—' },
    { field: 'liquidation', type: 'object', description: 'Liquidation data (optional)', example: '{"liquidation": {"values": ["*"]}}' },
    { field: 'liquidation.liquidatedUser', type: 'string', description: 'Liquidated user address', example: '{"liquidatedUser": {"values": ["0x..."]}}' },
    { field: 'liquidation.method', type: 'string', description: 'Liquidation method', example: '{"method": {"values": ["market"]}}'},
    { field: 'liquidation.markPx', type: 'string', description: 'Mark price at liquidation', example: '—' }
  ]}
/>
</div>

<details>
<summary><strong>Trades Filter Examples</strong></summary>

```json
// Get all BTC buys (WebSocket)
{"streamType": "trades", "filters": {"coin": ["BTC"], "side": ["B"]}}

// Get liquidations only (WebSocket)
{"streamType": "trades", "filters": {"liquidation": ["*"]}}

// Get trades for specific user (WebSocket)
{"streamType": "trades", "filters": {"user": ["0x727956612a8700627451204a3ae26268bd1a1525"]}}

// Get TWAP executions only (WebSocket)
{"streamType": "trades", "filters": {"twapId": ["*"]}}
```

</details>

### Orders Stream

Monitor order status updates including placements, cancellations, and partial fills.

<div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
<StyledTable
  columns={[
    { key: 'field', label: 'Field', width: '15%', align: 'left' },
    { key: 'type', label: 'Type', width: '15%', align: 'left' },
    { key: 'description', label: 'Description', width: '25%', align: 'left' },
    { key: 'example', label: 'Example Filter', width: '45%', align: 'left' }
  ]}
  showMobileCards={true}
  data={[
    { field: 'coin', type: 'string', description: 'Trading pair', example: '{"coin": {"values": ["ETH"]}}' },
    { field: 'side', type: 'string', description: '"A" or "B"', example: '{"side": {"values": ["A"]}}' },
    { field: 'limit_px', type: 'string', description: 'Limit price', example: '—' },
    { field: 'sz', type: 'string', description: 'Current size', example: '—' },
    { field: 'orig_sz', type: 'string', description: 'Original size', example: '—' },
    { field: 'oid', type: 'number', description: 'Order ID', example: '{"oid": {"values": ["12345"]}}'},
    { field: 'timestamp', type: 'number', description: 'Order timestamp', example: '—' }
  ]}
/>
</div>

<details>
<summary><strong>Orders Filter Examples</strong></summary>

```json
// Get all ETH orders (WebSocket)
{"streamType": "orders", "filters": {"coin": ["ETH"]}}

// Get sell orders only (WebSocket)
{"streamType": "orders", "filters": {"side": ["A"]}}
```

</details>

### Book Updates Stream

Track order book changes including price level updates and size modifications for bid and ask sides.

<div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
<StyledTable
  columns={[
    { key: 'field', label: 'Field', width: '10%', align: 'left' },
    { key: 'type', label: 'Type', width: '15%', align: 'left' },
    { key: 'description', label: 'Description', width: '35%', align: 'left' },
    { key: 'example', label: 'Example Filter', width: '40%', align: 'left' }
  ]}
  showMobileCards={true}
  data={[
    { field: 'coin', type: 'string', description: 'Trading pair', example: '{"coin": {"values": ["BTC"]}}' },
    { field: 'side', type: 'string', description: '"A" (ask) or "B" (bid)', example: '{"side": {"values": ["B"]}}' },
    { field: 'px', type: 'string', description: 'Price level', example: '—' },
    { field: 'sz', type: 'string', description: 'Size at level', example: '—' }
  ]}
/>
</div>

<details>
<summary><strong>Book Updates Filter Examples</strong></summary>

```json
// Get BTC bid updates only (WebSocket)
{"streamType": "book_updates", "filters": {"coin": ["BTC"], "side": ["B"]}}

// Get updates for multiple coins (WebSocket)
{"streamType": "book_updates", "filters": {"coin": ["BTC", "ETH", "SOL"]}}
```

</details>

### Events Stream

Filter ledger updates including deposits, withdrawals, transfers, vault operations, and funding events.

**Note:** Events have nested structure with various types.

<div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
<StyledTable
  columns={[
    { key: 'field', label: 'Field', width: '10%', align: 'left' },
    { key: 'type', label: 'Type', width: '15%', align: 'left' },
    { key: 'description', label: 'Description', width: '35%', align: 'left' },
    { key: 'example', label: 'Example Filter', width: '40%', align: 'left' }
  ]}
  showMobileCards={true}
  data={[
    { field: 'users', type: 'array', description: 'Affected users', example: '{"users": {"values": ["0x..."]}}' },
    { field: 'type', type: 'string', description: 'Event type', example: '{"type": {"values": ["deposit", "withdraw"]}}' },
    { field: 'usdc', type: 'string', description: 'USDC amount', example: '—' },
    { field: 'token', type: 'number', description: 'Token ID', example: '{"token": {"values": ["124"]}}'}
  ]}
/>
</div>

**Common Event Types:**
- `deposit` - USDC deposit
- `withdraw` - USDC withdrawal  
- `internalTransfer` - Internal transfer
- `spotTransfer` - Spot transfer
- `liquidation` - Liquidation event
- `funding` - Funding payment
- `vaultDeposit` / `vaultWithdraw` - Vault operations

<details>
<summary><strong>Events Filter Examples</strong></summary>

```json
// Get deposits only (WebSocket)
{"streamType": "events", "filters": {"type": ["deposit"]}}

// Get all events for a user (WebSocket)
{"streamType": "events", "filters": {"users": ["0xabc..."]}}

// Get vault operations (WebSocket)
{"streamType": "events", "filters": {"type": ["vaultDeposit", "vaultWithdraw"]}}
```

</details>

### Writer Actions Stream

Monitor system actions including spot token transfers, perps operations, and core system activities.

<div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
<StyledTable
  columns={[
    { key: 'field', label: 'Field', width: '10%', align: 'left' },
    { key: 'type', label: 'Type', width: '15%', align: 'left' },
    { key: 'description', label: 'Description', width: '25%', align: 'left' },
    { key: 'example', label: 'Example Filter', width: '50%', align: 'left' }
  ]}
  showMobileCards={true}
  data={[
    { field: 'user', type: 'string', description: 'User address', example: '{"user": {"values": ["0x200..."]}}' },
    { field: 'nonce', type: 'number', description: 'Action nonce', example: '—' },
    { field: 'evm_tx_hash', type: 'string', description: 'EVM transaction hash', example: '{"evm_tx_hash": {"values": ["0x..."]}}' },
    { field: 'action.type', type: 'string', description: 'Action type', example: '{"type": {"values": ["SystemSpotSendAction"]}}' },
    { field: 'action.destination', type: 'string', description: 'Destination address', example: '{"destination": {"values": ["0x..."]}}' },
    { field: 'action.token', type: 'number', description: 'Token ID', example: '{"token": {"values": ["124"]}}'},
    { field: 'action.wei', type: 'number', description: 'Amount in wei', example: '—' }
  ]}
/>
</div>

**Common Action Types:**
- `SystemSpotSendAction` - Spot token transfer
- `SystemPerpsAction` - Perps system action  
- `CoreWriterAction` - Core writer action

<details>
<summary><strong>Writer Actions Filter Examples</strong></summary>

```json
// Get spot sends only (WebSocket)
{"streamType": "writer_actions", "filters": {"type": ["SystemSpotSendAction"]}}

// Get actions for specific token (WebSocket)
{"streamType": "writer_actions", "filters": {"token": ["124"]}}

// Get actions for specific user (WebSocket)
{"streamType": "writer_actions", "filters": {"user": ["0x200..."]}}
```

</details>

### TWAP Orders Stream

Track Time-Weighted Average Price order status updates including running, completed, and cancelled TWAP orders.

<div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
<StyledTable
  columns={[
    { key: 'field', label: 'Field', width: '10%', align: 'left' },
    { key: 'type', label: 'Type', width: '15%', align: 'left' },
    { key: 'description', label: 'Description', width: '25%', align: 'left' },
    { key: 'example', label: 'Example Filter', width: '50%', align: 'left' }
  ]}
  showMobileCards={true}
  data={[
    { field: 'user', type: 'string', description: 'User address', example: '{"user": {"values": ["0x..."]}}' },
    { field: 'coin', type: 'string', description: 'Trading pair', example: '{"coin": {"values": ["BTC"]}}' },
    { field: 'side', type: 'string', description: '"A" or "B"', example: '{"side": {"values": ["B"]}}' },
    { field: 'status', type: 'string', description: 'TWAP status', example: '{"status": {"values": ["running", "completed"]}}'}
  ]}
/>
</div>

## Filter Limits

To ensure optimal performance and prevent abuse, Hyperliquid enforces limits on the number of filter values per field and total filter complexity:

<div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
<StyledTable
  columns={[
    { key: 'limit', label: 'Limit', width: '40%', align: 'left' },
    { key: 'default', label: 'Default', width: '20%', align: 'left' },
    { key: 'description', label: 'Description', width: '40%', align: 'left' }
  ]}
  showMobileCards={true}
  data={[
    { limit: 'Max values per user/address field', default: '100', description: 'Max addresses in one filter' },
    { limit: 'Max values per coin field', default: '50', description: 'Max coins in one filter' },
    { limit: 'Max values per type field', default: '20', description: 'Max types in one filter' },
    { limit: 'Max total values', default: '500', description: 'Sum of all filter values' },
    { limit: 'Max named filters per stream', default: '10', description: 'Max named filters (filterName) per stream type' },
    { limit: 'Unknown fields', default: 'Allowed', description: 'Any field can be filtered (uses highest limit)' }
  ]}
/>
</div>

<details>
<summary><strong>Limit Error Response</strong></summary>

```json
{
  "error": {
    "code": -32602,
    "message": "Filter validation failed: Too many values for field 'user': 150 (max: 100)"
  }
}
```

</details>

## Complete Examples

### WebSocket Examples

<details>
<summary><strong>Basic Subscription</strong></summary>

```json
// Subscribe to trades stream
{"jsonrpc":"2.0","method":"hl_subscribe","params":{"streamType":"trades"},"id":1}

// Response
{"jsonrpc":"2.0","result":{"subscribed":["trades"]},"id":1}
```

</details>

<details>
<summary><strong>Filtered Subscriptions</strong></summary>

```json
// Filter trades by coin and side
{
  "jsonrpc": "2.0",
  "method": "hl_subscribe",
  "params": {
    "streamType": "trades",
    "filters": {
      "coin": ["BTC", "ETH"],
      "side": ["B"]
    }
  },
  "id": 1
}

// Get all liquidations
{
  "jsonrpc": "2.0",
  "method": "hl_subscribe",
  "params": {
    "streamType": "trades",
    "filters": {
      "liquidation": ["*"]
    }
  },
  "id": 1
}

// Get deposits for specific user
{
  "jsonrpc": "2.0",
  "method": "hl_subscribe",
  "params": {
    "streamType": "events",
    "filters": {
      "type": ["deposit"],
      "users": ["0xabc..."]
    }
  },
  "id": 1
}

// Get SystemSpotSendAction events
{
  "jsonrpc": "2.0",
  "method": "hl_subscribe",
  "params": {
    "streamType": "writer_actions",
    "filters": {
      "type": ["SystemSpotSendAction"]
    }
  },
  "id": 1
}
```

</details>

<details>
<summary><strong>Unsubscribe</strong></summary>

```json
// Unsubscribe from specific filter
{"jsonrpc":"2.0","method":"hl_unsubscribe","params":{"filterName":"btc_trades"},"id":2}

// Unsubscribe from stream type
{"jsonrpc":"2.0","method":"hl_unsubscribe","params":{"streamType":"trades"},"id":3}
```

</details>

### wscat One-Liners

<details>
<summary><strong>Quick Testing Commands</strong></summary>

```bash
# All trades (no filter)
wscat -c wss://endpoint/ws -w 9999
{"jsonrpc":"2.0","method":"hl_subscribe","params":{"streamType":"trades"},"id":1}

# BTC trades only
wscat -c wss://endpoint/ws -w 9999
{"jsonrpc":"2.0","method":"hl_subscribe","params":{"streamType":"trades","filters":{"coin":["BTC"]}},"id":1}

# Liquidations only
wscat -c wss://endpoint/ws -w 9999
{"jsonrpc":"2.0","method":"hl_subscribe","params":{"streamType":"trades","filters":{"liquidation":["*"]}},"id":1}

# Specific user's trades
wscat -c wss://endpoint/ws -w 9999
{"jsonrpc":"2.0","method":"hl_subscribe","params":{"streamType":"trades","filters":{"user":["0x123..."]}},"id":1}
```

</details>

### gRPC Examples

<details>
<summary><strong>gRPC Filter Examples</strong></summary>

```javascript
// JavaScript gRPC example
const request = {
  subscribe: {
    stream_type: 'TRADES',
    start_block: 0,
    filters: {
      "coin": { values: ["BTC", "ETH"] },
      "side": { values: ["B"] }
    }
  }
};

// Python gRPC example
request = {
    "subscribe": {
        "stream_type": "TRADES",
        "filters": {
            "liquidation": {"values": ["*"]},
            "coin": {"values": ["BTC"]}
        }
    }
}

// Go gRPC example
request := &pb.SubscribeRequest{
    Subscribe: &pb.Subscribe{
        StreamType: pb.StreamType_TRADES,
        Filters: map[string]*pb.FilterValues{
            "coin": {Values: []string{"BTC", "ETH"}},
            "user": {Values: []string{"0x123..."}},
        },
    },
}
```

</details>

## Response Format

### Subscription Confirmation

```json
{"jsonrpc":"2.0","result":{"subscribed":["trades"]},"id":1}
```

### Stream Data

```json
{
  "stream": "trades",
  "block_number": 817824278,
  "data": {
    "block_number": 817824278,
    "block_time": "2025-12-04T17:00:15.929034389",
    "local_time": "2025-12-04T17:00:16.076556955",
    "events": [
      ["0x727956612a8700627451204a3ae26268bd1a1525", {"coin": "HYPE", "side": "B", ...}]
    ]
  }
}
```

## Important Notes
<br />

- **Case Sensitivity**: Field names and values are case-insensitive (`"Coin" = "coin" = "COIN"`, `"btc" = "BTC"`)
- **Address Matching**: Addresses are case-insensitive (`"0xABC" = "0xabc"`)
- **Empty Filters**: No filters = receive all events (no filtering applied)
- **Whitespace**: Values are automatically trimmed of whitespace
- **Per-Stream Filters**: Each stream can have independent filters
- **Recursive Matching**: Filters search through nested JSON structures automatically
- **Tuple Format**: TRADES stream uses `[user, data]` format; user filter matches the first element
- **Blocks Stream**: The blocks stream does **NOT** support filtering (gRPC only, raw data)

## Related Documentation
<br />

- **[Data Streams Overview](/docs/hyperliquid/datasets/)** - Learn about available data streams
- **[gRPC API](/docs/hyperliquid/grpc-api/)** - gRPC streaming implementation
- **[JSON-RPC API](/docs/hyperliquid/json-rpc/hl_subscribe/)** - WebSocket subscription methods