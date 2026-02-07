---
title: Orders Dataset  
description: Hyperliquid orders dataset documentation - complete order lifecycle tracking with 18+ status types
---

## Overview

The **orders** stream contains all order status updates from the Hyperliquid exchange. This includes order placements, cancellations, fills, rejections, and other lifecycle events.

**Stream Type:** `ORDERS`  
**API Availability:** gRPC Streaming API + JSON-RPC/WebSocket APIs  
**Volume:** Very High - Most frequent stream with 18+ different status types

## Data Structure

Each block contains an array of order status events:

```json
{
  "local_time": "2025-12-04T17:00:00.268701903",
  "block_time": "2025-12-04T17:00:00.083688002",
  "block_number": 817828537,
  "events": [
    {
      "time": "2025-12-04T17:00:00.268701903",
      "user": "0xeb6eda4756f831824cd28e568ef8adcff35016e3",
      "hash": "0x81598918a9303dff82d30430bf015102068e00fe44335cd12522346b683417ea",
      "builder": null,
      "status": "open",
      "order": {
        "coin": "ZEC",
        "side": "B",
        "limitPx": "356.42",
        "sz": "1.1",
        "oid": 258166303284,
        "timestamp": 1764867600268,
        "triggerCondition": "N/A",
        "isTrigger": false,
        "triggerPx": "0.0",
        "children": [],
        "isPositionTpsl": false,
        "reduceOnly": false,
        "orderType": "Limit",
        "origSz": "1.1",
        "tif": "Gtc",
        "cloid": "0x89119db7aae18b90abe620888af9aadc"
      }
    }
  ]
}
```

## Event Fields

<div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
<StyledTable
  columns={[
    { key: 'field', label: 'Field', width: '20%', align: 'left' },
    { key: 'type', label: 'Type', width: '25%', align: 'left' },
    { key: 'description', label: 'Description', width: '55%', align: 'left' }
  ]}
  showMobileCards={false}
  data={[
    { field: 'time', type: 'string', description: 'Timestamp of the order status event (ISO 8601)' },
    { field: 'user', type: 'string', description: 'Ethereum address of the user who placed the order' },
    { field: 'hash', type: 'string|null', description: 'Transaction hash (null for rejected/canceled orders without blockchain tx)' },
    { field: 'builder', type: 'object|null', description: 'Builder information when order flow comes through a builder. Contains {"b": "builder_address", "f": fee_in_basis_points}. Null for direct orders.' },
    { field: 'status', type: 'string', description: 'Order status - see Order Statuses below' },
    { field: 'order', type: 'object', description: 'Full order details - see Order Object below' }
  ]}
/>
</div>

## Order Object

<div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
<StyledTable
  columns={[
    { key: 'field', label: 'Field', width: '25%', align: 'left' },
    { key: 'type', label: 'Type', width: '20%', align: 'left' },
    { key: 'description', label: 'Description', width: '55%', align: 'left' }
  ]}
  showMobileCards={false}
  data={[
    { field: 'coin', type: 'string', description: 'Trading pair (e.g., "BTC", "ETH", "xyz:NVDA", "@162")' },
    { field: 'side', type: 'string', description: 'Order side: "B" (Buy) or "A" (Ask/Sell)' },
    { field: 'limitPx', type: 'string', description: 'Limit price as string' },
    { field: 'sz', type: 'string', description: 'Current order size (can be "0.0" if fully filled)' },
    { field: 'oid', type: 'integer', description: 'Unique order ID' },
    { field: 'timestamp', type: 'integer', description: 'Order creation timestamp (milliseconds since epoch)' },
    { field: 'triggerCondition', type: 'string', description: 'Trigger condition or "N/A" if not a trigger order' },
    { field: 'isTrigger', type: 'boolean', description: 'Whether this is a trigger/stop order' },
    { field: 'triggerPx', type: 'string', description: 'Trigger price (0.0 if not applicable)' },
    { field: 'children', type: 'array', description: 'Array of child orders (for complex order types)' },
    { field: 'isPositionTpsl', type: 'boolean', description: 'Whether this is a position-level TP/SL order' },
    { field: 'reduceOnly', type: 'boolean', description: 'Whether order can only reduce position' },
    { field: 'orderType', type: 'string', description: 'Order type: "Limit", "Market", etc.' },
    { field: 'origSz', type: 'string', description: 'Original order size at placement' },
    { field: 'tif', type: 'string', description: 'Time-in-force: "Gtc", "Alo", "Ioc", etc.' },
    { field: 'cloid', type: 'string|null', description: 'Client order ID (optional, for user reference)' }
  ]}
/>
</div>

## Builder Orders

When order flow comes through a builder (MEV builder or order flow provider), the `builder` field contains structured information about the builder and associated fees.

**Builder Object Structure:**

<div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
<StyledTable
  columns={[
    { key: 'field', label: 'Field', width: '25%', align: 'left' },
    { key: 'type', label: 'Type', width: '20%', align: 'left' },
    { key: 'description', label: 'Description', width: '55%', align: 'left' }
  ]}
  showMobileCards={false}
  data={[
    { field: 'b', type: 'string', description: 'Builder Ethereum address (e.g., "0x999a4b5f268a8fbf33736feff360d462ad248dbf")' },
    { field: 'f', type: 'integer', description: 'Builder fee in basis points (e.g., 20 = 0.20%)' }
  ]}
/>
</div>

**Example builder object:**
```json
{
  "b": "0x999a4b5f268a8fbf33736feff360d462ad248dbf",
  "f": 20
}
```

**When is builder null vs populated?**
- **null**: Direct orders placed by users without a builder intermediary
- **populated**: Orders that flow through builders, often for HIP-3 coins or MEV-related order flow

**HIP-3 Coins:**
Orders for HIP-3 coins (identified by prefixes like `vntl:`, `xyz:`, etc.) commonly include builder information. Examples: `vntl:SPACEX`, `xyz:NVDA`, `vntl:TRUMPWIN`.

**Filtering for builder orders:**

```json
// WebSocket - Get all orders with any builder
{"streamType": "orders", "filters": {"builder": ["*"]}}

// WebSocket - Get orders for specific builder
{"streamType": "orders", "filters": {"builder": ["0x999a4b5f268a8fbf33736feff360d462ad248dbf"]}}

// gRPC - Get all orders with any builder
{"builder": {"values": ["*"]}}

// gRPC - Get orders for specific builder
{"builder": {"values": ["0x999a4b5f268a8fbf33736feff360d462ad248dbf"]}}
```

## Order Statuses

The following order statuses are observed in the dataset:

### Success Statuses

These statuses indicate orders that have been successfully processed or are actively working on the exchange.

<div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
<StyledTable
  columns={[
    { key: 'status', label: 'Status', width: '30%', align: 'left' },
    { key: 'description', label: 'Description', width: '70%', align: 'left' }
  ]}
  showMobileCards={false}
  data={[
    { status: 'open', description: 'Order successfully placed and is active on the orderbook' },
    { status: 'filled', description: 'Order fully executed/filled' },
    { status: 'triggered', description: 'Trigger order condition met and order activated' }
  ]}
/>
</div>

### Cancellation Statuses

Orders with these statuses were placed successfully but later canceled due to user action or system conditions.

<div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
<StyledTable
  columns={[
    { key: 'status', label: 'Status', width: '40%', align: 'left' },
    { key: 'description', label: 'Description', width: '60%', align: 'left' }
  ]}
  showMobileCards={false}
  data={[
    { status: 'canceled', description: 'Order canceled by user or system' },
    { status: 'marginCanceled', description: 'Order canceled due to insufficient margin' },
    { status: 'openInterestCapCanceled', description: 'Order canceled due to open interest cap reached' },
    { status: 'reduceOnlyCanceled', description: 'Reduce-only order canceled (likely position closed)' },
    { status: 'scheduledCancel', description: 'Order canceled on a scheduled basis' },
    { status: 'selfTradeCanceled', description: 'Order canceled to prevent self-trading' },
    { status: 'siblingFilledCanceled', description: 'Order canceled because a sibling order filled' }
  ]}
/>
</div>

### Rejection Statuses

Orders with these statuses were rejected before being placed on the order book due to validation failures or risk constraints.

<div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
<StyledTable
  columns={[
    { key: 'status', label: 'Status', width: '45%', align: 'left' },
    { key: 'description', label: 'Description', width: '55%', align: 'left' }
  ]}
  showMobileCards={false}
  data={[
    { status: 'badAloPxRejected', description: 'ALO (Add Liquidity Only) order rejected due to bad price (would cross spread)' },
    { status: 'iocCancelRejected', description: 'IOC (Immediate or Cancel) order rejected/canceled' },
    { status: 'insufficientSpotBalanceRejected', description: 'Order rejected due to insufficient spot token balance' },
    { status: 'minTradeNtlRejected', description: 'Order rejected - notional value below minimum' },
    { status: 'oracleRejected', description: 'Order rejected due to oracle price issues' },
    { status: 'perpMarginRejected', description: 'Perpetual order rejected due to insufficient margin' },
    { status: 'perpMaxPositionRejected', description: 'Perpetual order rejected - would exceed max position size' },
    { status: 'positionFlipAtOpenInterestCapRejected', description: 'Order rejected - would flip position at OI cap' },
    { status: 'positionIncreaseAtOpenInterestCapRejected', description: 'Order rejected - would increase position at OI cap' },
    { status: 'reduceOnlyRejected', description: 'Reduce-only order rejected (would increase position)' },
    { status: 'tooAggressiveAtOpenInterestCapRejected', description: 'Order rejected - too aggressive near OI cap' }
  ]}
/>
</div>

## Market Types

Orders can reference different market types via the `coin` field:

- **Standard perpetuals**: `"BTC"`, `"ETH"`, `"SOL"`, etc.
- **Prediction markets (XYZ)**: `"xyz:NVDA"`, `"xyz:AAPL"`, `"xyz:TSLA"`, etc.
- **Spot tokens**: `"@162"`, `"@198"`, etc.

## Time-in-Force (TIF) Types

<div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
<StyledTable
  columns={[
    { key: 'tif', label: 'TIF', width: '25%', align: 'left' },
    { key: 'description', label: 'Description', width: '75%', align: 'left' }
  ]}
  showMobileCards={false}
  data={[
    { tif: 'Gtc', description: 'Good-Till-Cancel (remains active until filled or canceled)' },
    { tif: 'Alo', description: 'Add-Liquidity-Only (will only add to book, not cross spread)' },
    { tif: 'Ioc', description: 'Immediate-or-Cancel (executes immediately or cancels)' },
    { tif: 'FrontendMarket', description: 'Market order from frontend interface' }
  ]}
/>
</div>

## Example Order Events

<details>
<summary><strong>Open Order</strong></summary>

```json
{
  "time": "2025-12-04T17:00:00.268701903",
  "user": "0xeb6eda4756f831824cd28e568ef8adcff35016e3",
  "hash": "0x81598918a9303dff82d30430bf015102068e00fe44335cd12522346b683417ea",
  "builder": null,
  "status": "open",
  "order": {
    "coin": "ZEC",
    "side": "B",
    "limitPx": "356.42",
    "sz": "1.1",
    "oid": 258166303284,
    "timestamp": 1764867600268,
    "triggerCondition": "N/A",
    "isTrigger": false,
    "triggerPx": "0.0",
    "children": [],
    "isPositionTpsl": false,
    "reduceOnly": false,
    "orderType": "Limit",
    "origSz": "1.1",
    "tif": "Gtc",
    "cloid": "0x89119db7aae18b90abe620888af9aadc"
  }
}
```

</details>

<details>
<summary><strong>Filled Order</strong></summary>

```json
{
  "time": "2025-12-04T17:00:00.475982103",
  "user": "0x4c96f9be0e7bd04bb2db2a5cdf0b8797be00b0da",
  "hash": "0xace6f472128f05e4ae600430bf19350202770057ad8224b650af9fc4d182dfcf",
  "builder": null,
  "status": "filled",
  "order": {
    "coin": "ZEREBRO",
    "side": "B",
    "limitPx": "0.036676",
    "sz": "0.0",
    "oid": 258174064171,
    "timestamp": 1764868092303,
    "triggerCondition": "N/A",
    "isTrigger": false,
    "triggerPx": "0.0",
    "children": [],
    "isPositionTpsl": false,
    "reduceOnly": false,
    "orderType": "Limit",
    "origSz": "2858.0",
    "tif": "Gtc",
    "cloid": null
  }
}
```

</details>

<details>
<summary><strong>Rejected Order</strong></summary>

```json
{
  "time": "2025-12-04T17:00:00.105982103",
  "user": "0x1234567890abcdef1234567890abcdef12345678",
  "hash": null,
  "builder": null,
  "status": "perpMarginRejected",
  "order": {
    "coin": "BTC",
    "side": "B",
    "limitPx": "95000.0",
    "sz": "10.0",
    "oid": 258166123456,
    "timestamp": 1764867600105,
    "triggerCondition": "N/A",
    "isTrigger": false,
    "triggerPx": "0.0",
    "children": [],
    "isPositionTpsl": false,
    "reduceOnly": false,
    "orderType": "Limit",
    "origSz": "10.0",
    "tif": "Gtc",
    "cloid": null
  }
}
```

</details>

<details>
<summary><strong>Order with Builder</strong></summary>

```json
{
  "time": "2025-12-04T17:15:23.456789012",
  "user": "0xabc123def456789abcdef0123456789abcdef012",
  "hash": "0x789abc123def456789abcdef0123456789abcdef0123456789abcdef012345678",
  "builder": {
    "b": "0x999a4b5f268a8fbf33736feff360d462ad248dbf",
    "f": 20
  },
  "status": "open",
  "order": {
    "coin": "vntl:SPACEX",
    "side": "B",
    "limitPx": "125.50",
    "sz": "50.0",
    "oid": 258166987654,
    "timestamp": 1764868523456,
    "triggerCondition": "N/A",
    "isTrigger": false,
    "triggerPx": "0.0",
    "children": [],
    "isPositionTpsl": false,
    "reduceOnly": false,
    "orderType": "Limit",
    "origSz": "50.0",
    "tif": "Gtc",
    "cloid": "0x12345678abcdef1234567890abcdef12"
  }
}
```

</details>

## API Usage

<details>
<summary><strong>gRPC Streaming</strong></summary>

```javascript
// Subscribe to orders
const request = {
  subscribe: {
    stream_type: 'ORDERS',
    start_block: 0,
    filters: {
      "user": {"values": ["0x123..."]},
      "coin": {"values": ["BTC", "ETH"]},
      "status": {"values": ["open", "filled"]},
      "builder": {"values": ["*"]}  // Filter for orders with any builder
    }
  }
};
```

</details>

<details>
<summary><strong>JSON-RPC</strong></summary>

```bash
# Get latest order blocks
curl -X POST https://your-endpoint.hype-mainnet.quiknode.pro/your-token/hypercore \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "hl_getLatestBlocks",
    "params": {
      "stream": "orders",
      "count": 10
    },
    "id": 1
  }'
```

</details>

<details>
<summary><strong>WebSocket</strong></summary>

```javascript
// Subscribe to orders
ws.send(JSON.stringify({
  "method": "hl_subscribe",
  "params": {
    "streamType": "orders"
  }
}));
```

</details>

## Important Notes
<br />

- **High Volume**: Orders stream has the highest event frequency - use filtering for specific users/coins
- **Order Lifecycle**: Track complete order lifecycle from placement to completion/cancellation
- **Status Importance**: Different status types indicate various success/failure conditions
- **Partial Fills**: `sz` field shows remaining size, `origSz` shows original order size
- **Hash Field**: `null` for rejected orders that don't reach the blockchain
- **Client Order IDs**: Use `cloid` for tracking your own orders

## Related Streams
<br />

- **[Trades](./trades)** - See the actual fills that result from these orders
- **[Book Updates](./book-updates)** - See how open orders affect the order book
- **[Events](./events)** - View system events that may cause order cancellations