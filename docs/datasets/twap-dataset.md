---
title: TWAP Dataset
description: Hyperliquid TWAP dataset documentation - Time-Weighted Average Price order status and execution tracking
---

## Overview

The **TWAP** stream contains Time-Weighted Average Price (TWAP) order status updates from the Hyperliquid exchange. TWAP orders are algorithmic orders that execute gradually over a specified time period to minimize market impact.

**Stream Type:** `TWAP`  
**API Availability:** gRPC Streaming API + JSON-RPC/WebSocket APIs  
**Volume:** Low - Most blocks are empty; only updates when TWAP orders change status

## Data Structure

Most blocks are empty as TWAP status updates only occur when orders are activated, finished, or terminated. Each event represents a status change for a TWAP order.

```json
{
  "local_time": "2025-12-04T17:00:22.590883578",
  "block_time": "2025-12-04T17:00:22.417074898",
  "block_number": 817824346,
  "events": [
    {
      "time": "2025-12-04T17:00:22.417074898",
      "twap_id": 1430699,
      "state": {
        "coin": "HYPE",
        "user": "0x9d6a5ab97a8eed617bde9968d9ab6fcf72fde1b8",
        "side": "A",
        "sz": "108.36",
        "executedSz": "0.0",
        "executedNtl": "0.0",
        "minutes": 10,
        "reduceOnly": false,
        "randomize": false,
        "timestamp": 1764867622417
      },
      "status": "activated"
    }
  ]
}
```

## Event Fields

<div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
<StyledTable
  columns={[
    { key: 'field', label: 'Field', width: '25%', align: 'left' },
    { key: 'type', label: 'Type', width: '25%', align: 'left' },
    { key: 'description', label: 'Description', width: '50%', align: 'left' }
  ]}
  showMobileCards={false}
  data={[
    { field: 'time', type: 'string', description: 'Event timestamp (ISO 8601 format)' },
    { field: 'twap_id', type: 'integer', description: 'Unique identifier for the TWAP order' },
    { field: 'state', type: 'object', description: 'Current state of the TWAP order' },
    { field: 'status', type: 'string', description: 'TWAP order status (see Status Types below)' }
  ]}
/>
</div>

## State Object Fields

<div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
<StyledTable
  columns={[
    { key: 'field', label: 'Field', width: '25%', align: 'left' },
    { key: 'type', label: 'Type', width: '20%', align: 'left' },
    { key: 'description', label: 'Description', width: '55%', align: 'left' }
  ]}
  showMobileCards={false}
  data={[
    { field: 'coin', type: 'string', description: 'Trading pair identifier (e.g., "HYPE", "xyz:NVDA", "@107")' },
    { field: 'user', type: 'string', description: 'User address who created the TWAP order' },
    { field: 'side', type: 'string', description: 'Order side: "B" (Buy) or "A" (Ask/Sell)' },
    { field: 'sz', type: 'string', description: 'Total target size for the TWAP order' },
    { field: 'executedSz', type: 'string', description: 'Amount executed so far' },
    { field: 'executedNtl', type: 'string', description: 'Notional value executed (price × size)' },
    { field: 'minutes', type: 'integer', description: 'Duration of TWAP order in minutes' },
    { field: 'reduceOnly', type: 'boolean', description: 'Whether order can only reduce position (cannot increase)' },
    { field: 'randomize', type: 'boolean', description: 'Whether execution timing is randomized to avoid detection' },
    { field: 'timestamp', type: 'integer', description: 'TWAP order creation timestamp (Unix milliseconds)' }
  ]}
/>
</div>

## Status Types

TWAP orders progress through different status states during their lifecycle, from initial creation to completion or cancellation.

<div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
<StyledTable
  columns={[
    { key: 'status', label: 'Status', width: '30%', align: 'left' },
    { key: 'description', label: 'Description', width: '70%', align: 'left' }
  ]}
  showMobileCards={false}
  data={[
    { status: 'activated', description: 'TWAP order has been created and is actively executing' },
    { status: 'finished', description: 'TWAP order completed successfully (entire size executed)' },
    { status: 'terminated', description: 'TWAP order was cancelled before completion (partial execution possible)' }
  ]}
/>
</div>

## Example Records

<details>
<summary><strong>Activated TWAP Order</strong></summary>

```json
{
  "time": "2025-12-04T17:00:22.417074898",
  "twap_id": 1430699,
  "state": {
    "coin": "HYPE",
    "user": "0x9d6a5ab97a8eed617bde9968d9ab6fcf72fde1b8",
    "side": "A",
    "sz": "108.36",
    "executedSz": "0.0",
    "executedNtl": "0.0",
    "minutes": 10,
    "reduceOnly": false,
    "randomize": false,
    "timestamp": 1764867622417
  },
  "status": "activated"
}
```

</details>

<details>
<summary><strong>Finished TWAP Order</strong></summary>

```json
{
  "time": "2025-12-04T17:00:39.012600357",
  "twap_id": 1430683,
  "state": {
    "coin": "xyz:NVDA",
    "user": "0x130506ec2875c51eaf6fa2632ee952205a3dd793",
    "side": "A",
    "sz": "1.0",
    "executedSz": "1.0",
    "executedNtl": "183.83588",
    "minutes": 5,
    "reduceOnly": false,
    "randomize": false,
    "timestamp": 1764867337234
  },
  "status": "finished"
}
```

</details>

<details>
<summary><strong>Terminated TWAP Order (Partially Executed)</strong></summary>

```json
{
  "time": "2025-12-04T17:05:55.357168702",
  "twap_id": 1430645,
  "state": {
    "coin": "HYPE",
    "user": "0xdce7148dd9418e01129192095954a5ad3d75b0cc",
    "side": "B",
    "sz": "100.59",
    "executedSz": "25.94",
    "executedNtl": "897.98844",
    "minutes": 120,
    "reduceOnly": false,
    "randomize": true,
    "timestamp": 1764866098571
  },
  "status": "terminated"
}
```

</details>

<details>
<summary><strong>Long Duration TWAP (210 minutes)</strong></summary>

```json
{
  "time": "2025-12-04T17:03:28.969809817",
  "twap_id": 1430703,
  "state": {
    "coin": "xyz:NVDA",
    "user": "0xa993ad31ef46873c0193448dbb2f04c0d3854731",
    "side": "B",
    "sz": "27.11",
    "executedSz": "0.0",
    "executedNtl": "0.0",
    "minutes": 210,
    "reduceOnly": false,
    "randomize": false,
    "timestamp": 1764867808969
  },
  "status": "activated"
}
```

</details>

## API Usage

<details>
<summary><strong>gRPC Streaming</strong></summary>

```javascript
// Subscribe to TWAP updates
const request = {
  subscribe: {
    stream_type: 'TWAP',
    start_block: 0,
    filters: {
      "user": ["0x123..."]},
      "coin": ["BTC", "ETH"]},
      "status": ["activated", "finished"]}
    }
  }
};
```

</details>

<details>
<summary><strong>JSON-RPC</strong></summary>

```bash
# Get latest TWAP blocks
curl -X POST https://your-endpoint.hype-mainnet.quiknode.pro/your-token/hypercore \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "hl_getLatestBlocks",
    "params": {
      "stream": "twap",
      "count": 10
    },
    "id": 1
  }'
```

</details>

<details>
<summary><strong>WebSocket</strong></summary>

```javascript
// Subscribe to TWAP updates
ws.send(JSON.stringify({
  "method": "hl_subscribe",
  "params": {
    "streamType": "twap"
  }
}));
```

</details>

## Important Notes
<br />

- **Sparse Data**: Most blocks have empty event arrays - TWAP updates only occur when orders are created, completed, or cancelled
- **TWAP ID Linking**: The `twap_id` field can be used to correlate with individual fills in the [Trades](./trades) dataset (where `twapId` field references this `twap_id`)
- **Execution Progress**: Compare `executedSz` to `sz` to determine completion percentage
- **Randomization**: When `randomize` is `true`, order execution timing is randomized to avoid predictable patterns
- **Reduce-Only Orders**: When `reduceOnly` is `true`, the TWAP order can only reduce existing positions
- **Duration Range**: TWAP orders can range from very short (5 minutes) to very long (210+ minutes or 3.5+ hours)
- **Partial Execution**: Terminated orders may have partial execution (non-zero `executedSz` less than `sz`)

## Related Streams
<br />

- **[Trades](/docs/hyperliquid/datasets/trades)** - View individual fills that comprise TWAP execution (matching `twapId` field)
- **[Orders](/docs/hyperliquid/datasets/orders)** - See the individual child orders created by TWAP algorithm
- **[Events](/docs/hyperliquid/datasets/events)** - Monitor system events that may affect TWAP execution