---
title: Book Updates Dataset
description: Hyperliquid book updates dataset documentation - Level 2 order book changes and market depth
---

## Overview

The **book updates** stream (also known as **book_diffs**) contains Level 2 order book updates from the Hyperliquid exchange. This dataset tracks every order placement, modification, and cancellation, showing incremental changes to the order book.

**Stream Type:** `BOOK_UPDATES`  
**API Availability:** gRPC Streaming API + JSON-RPC/WebSocket APIs  
**Volume:** Very High - Every order book change generates an event

## Data Structure

Each block contains an array of order book update events. These events represent changes (additions or removals) to specific price levels in the order book:

```json
{
  "local_time": "2025-12-04T17:00:00.071039761",
  "block_time": "2025-12-04T16:59:59.912486449", 
  "block_number": 817824076,
  "events": [
    {
      "user": "0x1c1c270b573d55b68b3d14722b5d5d401511bed0",
      "oid": 258166296856,
      "coin": "ETH",
      "side": "B",
      "px": "3167.4",
      "raw_book_diff": {
        "new": {
          "sz": "1.5785"
        }
      }
    }
  ]
}
```

## Field Definitions

<div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
<StyledTable
  columns={[
    { key: 'field', label: 'Field', width: '25%', align: 'left' },
    { key: 'type', label: 'Type', width: '25%', align: 'left' },
    { key: 'description', label: 'Description', width: '50%', align: 'left' }
  ]}
  showMobileCards={false}
  data={[
    { field: 'user', type: 'string', description: 'Address of the user who placed/modified/cancelled the order' },
    { field: 'oid', type: 'integer', description: 'Order ID - unique identifier for the order' },
    { field: 'coin', type: 'string', description: 'Trading pair identifier (e.g., "ETH", "BTC", "xyz:NVDA", "@198")' },
    { field: 'side', type: 'string', description: 'Order side: "B" (Bid/Buy) or "A" (Ask/Sell)' },
    { field: 'px', type: 'string', description: 'Price level for this order' },
    { field: 'raw_book_diff', type: 'string or object', description: 'Type of book update (see Book Diff Types below)' }
  ]}
/>
</div>

## Book Diff Types

The `raw_book_diff` field indicates what type of change occurred:

<div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
<StyledTable
  columns={[
    { key: 'type', label: 'Type', width: '30%', align: 'left' },
    { key: 'value', label: 'Value', width: '35%', align: 'left' },
    { key: 'description', label: 'Description', width: '35%', align: 'left' }
  ]}
  showMobileCards={false}
  data={[
    { type: 'New Order', value: '{"new": {"sz": "1.5785"}}', description: 'A new order was placed or an existing order size was updated at this price level. The `sz` field shows the new total size at this price level for this order.' },
    { type: 'Remove Order', value: '"remove"', description: 'An order was cancelled or fully filled and removed from the book.' }
  ]}
/>
</div>

### Important Notes
<br />

- When an order is modified (size changes), it appears as a `"remove"` event followed by a `{"new": {...}}` event with the updated size
- The `sz` field in `{"new": {...}}` represents the **total size** of this specific order at this price level, not a delta
- Multiple orders can exist at the same price level from different users

## Example Updates

<details>
<summary><strong>New Order Placement</strong></summary>

```json
{
  "user": "0x1c1c270b573d55b68b3d14722b5d5d401511bed0",
  "oid": 258166296856,
  "coin": "ETH",
  "side": "B",
  "px": "3167.4",
  "raw_book_diff": {
    "new": {
      "sz": "1.5785"
    }
  }
}
```

</details>

<details>
<summary><strong>Order Removal (Cancellation or Fill)</strong></summary>

```json
{
  "user": "0xe9acfdc9322f6f924f007016c082e6891a3c653c",
  "oid": 258166160909,
  "coin": "BIO",
  "side": "A",
  "px": "0.053056",
  "raw_book_diff": "remove"
}
```

</details>

<details>
<summary><strong>Order Size Modification</strong></summary>

When an order size is modified, you'll see two events:
<br />

1. **Remove the old order:**
```json
{
  "user": "0x1234567890abcdef1234567890abcdef12345678",
  "oid": 258166123456,
  "coin": "BTC",
  "side": "B", 
  "px": "95000.0",
  "raw_book_diff": "remove"
}
```
<br />

2. **Add the modified order:**
```json
{
  "user": "0x1234567890abcdef1234567890abcdef12345678",
  "oid": 258166123456,
  "coin": "BTC", 
  "side": "B",
  "px": "95000.0",
  "raw_book_diff": {
    "new": {
      "sz": "2.5"
    }
  }
}
```

</details>

<details>
<summary><strong>Building Order Books</strong></summary>

To build a complete order book from this stream:

### 1. Initialize Empty Book
```javascript
const orderBook = {
  bids: new Map(), // price -> Map(oid -> size)
  asks: new Map()  // price -> Map(oid -> size)
};
```

### 2. Process Book Updates
```javascript
function processBookUpdate(event) {
  const { side, px, oid, raw_book_diff } = event;
  const book = side === 'B' ? orderBook.bids : orderBook.asks;
  
  if (!book.has(px)) {
    book.set(px, new Map());
  }
  
  const priceLevel = book.get(px);
  
  if (raw_book_diff === 'remove') {
    // Remove order from this price level
    priceLevel.delete(oid);
    
    // Remove price level if empty
    if (priceLevel.size === 0) {
      book.delete(px);
    }
  } else if (raw_book_diff.new) {
    // Add/update order at this price level
    priceLevel.set(oid, raw_book_diff.new.sz);
  }
}
```

### 3. Calculate Price Level Totals
```javascript
function getPriceLevelSize(priceLevel) {
  let total = 0;
  for (const size of priceLevel.values()) {
    total += parseFloat(size);
  }
  return total;
}
```

</details>

## API Usage

<details>
<summary><strong>gRPC Streaming</strong></summary>

```javascript
// Subscribe to book updates
const request = {
  subscribe: {
    stream_type: 'BOOK_UPDATES',
    start_block: 0,
    filters: {
      "coin": ["BTC", "ETH"]},
      "side": ["B"]} // Only bids
    }
  }
};
```

</details>

<details>
<summary><strong>JSON-RPC</strong></summary>

```bash
# Get latest book update blocks
curl -X POST https://your-endpoint.hype-mainnet.quiknode.pro/your-token/hypercore \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "hl_getLatestBlocks",
    "params": {
      "stream": "book",
      "count": 10
    },
    "id": 1
  }'
```

</details>

<details>
<summary><strong>WebSocket</strong></summary>

```javascript
// Subscribe to book updates
ws.send(JSON.stringify({
  "method": "hl_subscribe",
  "params": {
    "streamType": "book_updates"
  }
}));
```

</details>

## Important Notes

<br />

- **High Frequency**: Book updates are the most frequent events - use coin filtering for specific markets
- **Order Aggregation**: Multiple orders can exist at the same price level from different users
- **State Reconstruction**: You can rebuild the complete order book by processing these incremental updates
- **Size Semantics**: `sz` represents the total order size, not incremental changes
- **Modification Pattern**: Order modifications appear as remove + add events with the same `oid`

## Related Streams
<br />

- **[Orders](/docs/hyperliquid/datasets/orders)** - See the order lifecycle events that cause these book changes
- **[Trades](/docs/hyperliquid/datasets/trades)** - View the executions that remove liquidity from the book
- **[Events](/docs/hyperliquid/datasets/events)** - Monitor system events that may affect order book state