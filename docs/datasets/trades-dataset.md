---
title: Trades Dataset
description: Hyperliquid trades dataset documentation - executed trade data with maker/taker information
---

## Overview

The **trades** stream (also known as **fills**) contains executed trade data from the Hyperliquid exchange.

**Stream Type:** `TRADES`  
**API Availability:** gRPC Streaming API + JSON-RPC/WebSocket APIs  
**Volume:** High - Multiple trades per block during active trading

## Data Structure

Each block contains an array of trade events. Trades always come in pairs (maker and taker sides of the same trade).

```json
{
  "local_time": "2025-12-04T17:52:45.734593237",
  "block_time": "2025-12-04T17:52:45.554315846",
  "block_number": 817863403,
  "events": [
    [
      "0x<user_address>",
      {
        "coin": "BTC",
        "px": "92385.0",
        "sz": "0.00361",
        "side": "B",
        "time": 1764867600518,
        "startPosition": "0.0",
        "dir": "Open Long",
        "closedPnl": "0.0",
        "hash": "0x<transaction_hash>",
        "oid": 258166309475,
        "crossed": true,
        "fee": "0.190767",
        "tid": 1081368440085115,
        "feeToken": "USDC",
        "cloid": "0x<client_order_id>",
        "builder": "0x<builder_address>",
        "builderFee": "0.046691",
        "twapId": 1430535
      }
    ]
  ]
}
```

## Field Definitions

### Required Fields

<div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
<StyledTable
  columns={[
    { key: 'field', label: 'Field', width: '30%', align: 'left' },
    { key: 'type', label: 'Type', width: '30%', align: 'left' },
    { key: 'description', label: 'Description', width: '40%', align: 'left' }
  ]}
  showMobileCards={false}
  data={[
    { field: 'coin', type: 'string', description: 'Trading pair identifier (e.g., "BTC", "ETH", "xyz:HOOD", "@198")' },
    { field: 'px', type: 'string', description: 'Execution price' },
    { field: 'sz', type: 'string', description: 'Trade size/quantity' },
    { field: 'side', type: 'string', description: 'Trade side: "B" (Buy) or "A" (Ask/Sell)' },
    { field: 'time', type: 'integer', description: 'Execution timestamp (Unix milliseconds)' },
    { field: 'startPosition', type: 'string', description: 'User\'s position before this trade' },
    { field: 'dir', type: 'string', description: 'Trade direction/type (see Direction Types below)' },
    { field: 'closedPnl', type: 'string', description: 'Realized PnL from closing positions' },
    { field: 'hash', type: 'string', description: 'Transaction hash' },
    { field: 'oid', type: 'integer', description: 'Order ID' },
    { field: 'crossed', type: 'boolean', description: 'Whether order crossed the spread (true = taker, false = maker)' },
    { field: 'fee', type: 'string', description: 'Trading fee charged' },
    { field: 'tid', type: 'integer', description: 'Trade ID (unique identifier for the trade)' },
    { field: 'feeToken', type: 'string', description: 'Token used for fee payment (e.g., "USDC", "HYPE", "WOULD", "UXPL", "USDH")' },
    { field: 'twapId', type: 'integer or null', description: 'TWAP order identifier (if part of TWAP execution)' }
  ]}
/>
</div>

### Optional Fields

<div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
<StyledTable
  columns={[
    { key: 'field', label: 'Field', width: '30%', align: 'left' },
    { key: 'type', label: 'Type', width: '30%', align: 'left' },
    { key: 'description', label: 'Description', width: '40%', align: 'left' }
  ]}
  showMobileCards={false}
  data={[
    { field: 'cloid', type: 'string', description: 'Client order ID (custom identifier set by user)' },
    { field: 'builder', type: 'string', description: 'Builder address (MEV builder/order flow provider)' },
    { field: 'builderFee', type: 'string', description: 'Fee paid to the builder' }
  ]}
/>
</div>

## Liquidation Data

The **trades stream is the primary source for liquidation events**. When a trade is part of a liquidation, it includes a `liquidation` object with detailed information:

<div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
<StyledTable
  columns={[
    { key: 'field', label: 'Field', width: '30%', align: 'left' },
    { key: 'type', label: 'Type', width: '20%', align: 'left' },
    { key: 'description', label: 'Description', width: '50%', align: 'left' }
  ]}
  showMobileCards={true}
  data={[
    { field: 'liquidation.liquidatedUser', type: 'string', description: 'Address of the user being liquidated' },
    { field: 'liquidation.markPx', type: 'string', description: 'Mark price at the time of liquidation' },
    { field: 'liquidation.method', type: 'string', description: 'Liquidation method (e.g., "market")' }
  ]}
/>
</div>

**Filtering for liquidations:**
```json
{"streamType": "trades", "filters": {"liquidation": ["*"]}}
```

## Builder Fee Data

**Builder fees** show MEV builder involvement in trades:

<div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
<StyledTable
  columns={[
    { key: 'field', label: 'Field', width: '30%', align: 'left' },
    { key: 'type', label: 'Type', width: '20%', align: 'left' },
    { key: 'description', label: 'Description', width: '50%', align: 'left' }
  ]}
  showMobileCards={true}
  data={[
    { field: 'builder', type: 'string', description: 'MEV builder address (when present)' },
    { field: 'builderFee', type: 'string', description: 'Fee paid to the builder' }
  ]}
/>
</div>

**Filtering for builder trades:**
```json
{"streamType": "trades", "filters": {"builder": ["*"]}}
```

## Direction Types

The `dir` field indicates the type of trade action:

<div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
<StyledTable
  columns={[
    { key: 'direction', label: 'Direction', width: '50%', align: 'left' },
    { key: 'description', label: 'Description', width: '50%', align: 'left' }
  ]}
  showMobileCards={false}
  data={[
    { direction: 'Buy', description: 'Spot market buy' },
    { direction: 'Sell', description: 'Spot market sell' },
    { direction: 'Open Long', description: 'Open a long perpetual position' },
    { direction: 'Open Short', description: 'Open a short perpetual position' },
    { direction: 'Close Long', description: 'Close a long perpetual position' },
    { direction: 'Close Short', description: 'Close a short perpetual position' },
    { direction: 'Long > Short', description: 'Flip from long position to short position' },
    { direction: 'Short > Long', description: 'Flip from short position to long position' },
    { direction: 'Net Child Vaults', description: 'Internal vault rebalancing/netting' }
  ]}
/>
</div>

## Example Trades

<details>
<summary><strong>Spot Buy</strong></summary>

```json
{
  "coin": "@198",
  "px": "0.0123",
  "sz": "871.9",
  "side": "B",
  "time": 1764867600701,
  "startPosition": "4.207665",
  "dir": "Buy",
  "closedPnl": "0.0",
  "hash": "0x57a93d7773a45a5359220430bf015702042f005d0ea77925fb71e8ca32a8343d",
  "oid": 258166311363,
  "crossed": true,
  "fee": "0.585916",
  "tid": 433967339133223,
  "feeToken": "WOULD",
  "twapId": null
}
```

</details>

<details>
<summary><strong>Open Long Position</strong></summary>

```json
{
  "coin": "HEMI",
  "px": "0.016385",
  "sz": "754.0",
  "side": "B",
  "time": 1764867600054,
  "startPosition": "4496.0",
  "dir": "Open Long",
  "closedPnl": "0.0",
  "hash": "0x0000000000000000000000000000000000000000000000000000000000000000",
  "oid": 258166267029,
  "crossed": false,
  "fee": "0.0",
  "tid": 67363762501869,
  "cloid": "0x20251204000000000000000000381433",
  "feeToken": "USDC",
  "twapId": null
}
```

</details>

<details>
<summary><strong>Position Flip (Short to Long)</strong></summary>

```json
{
  "coin": "xyz:XYZ100",
  "px": "25600.0",
  "sz": "0.0027",
  "side": "B",
  "time": 1764867600518,
  "startPosition": "-0.0001",
  "dir": "Short > Long",
  "closedPnl": "0.000351",
  "hash": "0x7f08a6e55e57ee1180820430bf015402066100caf95b0ce322d152381d5bc7fc",
  "oid": 258166169652,
  "crossed": false,
  "fee": "0.015814",
  "builderFee": "0.013824",
  "tid": 931158683853203,
  "cloid": "0x49a6df9ed40b4efa8f93535dd8803465",
  "feeToken": "USDC",
  "builder": "0x999a4b5f268a8fbf33736feff360d462ad248dbf",
  "twapId": null
}
```

</details>

<details>
<summary><strong>Liquidation Trade</strong></summary>

```json
{
  "coin": "CRV",
  "px": "0.39626",
  "sz": "1076.0",
  "side": "B",
  "time": 1766671523811,
  "startPosition": "-2777.0",
  "dir": "Close Short",
  "closedPnl": "-19.5294",
  "hash": "0xbce01e7d41ad9ff1be5904321300250201890062dca0bec360a8c9d000a179dc",
  "oid": 278847514653,
  "crossed": true,
  "fee": "0.191869",
  "tid": 620686698918268,
  "liquidation": {
    "liquidatedUser": "0x7a475736bf02d67bf51b00414ab766ef4da9214d",
    "markPx": "0.39617",
    "method": "market"
  },
  "feeToken": "USDC",
  "twapId": null
}
```

</details>

<details>
<summary><strong>Builder Fee Trade</strong></summary>

```json
{
  "coin": "CRV",
  "px": "0.39645",
  "sz": "909.9",
  "side": "A",
  "time": 1766671523811,
  "startPosition": "109083.8",
  "dir": "Close Long",
  "closedPnl": "11.865096",
  "hash": "0xbce01e7d41ad9ff1be5904321300250201890062dca0bec360a8c9d000a179dc",
  "oid": 278847504835,
  "crossed": false,
  "fee": "0.059158",
  "builderFee": "0.036072",
  "tid": 856474671603519,
  "cloid": "0x94be780c945d077a58273f343342f4c3",
  "liquidation": {
    "liquidatedUser": "0xd0be131babb6abb6da97ceee4a6207ada82d9aa8",
    "markPx": "0.39617",
    "method": "market"
  },
  "feeToken": "USDC",
  "builder": "0x6530512a6c89c7cfcebc3ba7fcd9ada5f30827a6",
  "twapId": null
}
```

</details>

## API Usage

<details>
<summary><strong>gRPC Streaming</strong></summary>

```javascript
// Subscribe to trades
const request = {
  subscribe: {
    stream_type: 'TRADES',
    start_block: 0,
    filters: {
      "coin": ["BTC", "ETH"]},
      "user": ["0x123..."]}
    }
  }
};
```

</details>

<details>
<summary><strong>JSON-RPC</strong></summary>

```bash
# Get latest trade blocks
curl -X POST https://your-endpoint.hype-mainnet.quiknode.pro/your-token/hypercore \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "hl_getLatestBlocks",
    "params": {
      "stream": "trades",
      "count": 10
    },
    "id": 1
  }'
```

</details>

<details>
<summary><strong>WebSocket</strong></summary>

```javascript
// Subscribe to trades
ws.send(JSON.stringify({
  "method": "hl_subscribe",
  "params": {
    "streamType": "trades"
  }
}));
```

</details>

## Important Notes
<br />

- **Trades come in pairs**: Each trade has a buyer side (`"B"`) and a seller side (`"A"`) with the same `tid` (trade ID) and `hash`
- **Maker vs Taker**: The `crossed` field indicates taker (true) or maker (false) status
- **Fee Tokens**: Most fees are paid in USDC, but can also be paid in native tokens like HYPE, WOULD, UXPL, or USDH
- **Builder Fees**: When present, indicate MEV builder involvement in the trade
- **TWAP Orders**: Non-null `twapId` values indicate the trade is part of a TWAP execution
- **Position Flips**: `Long > Short` and `Short > Long` indicate position direction changes in a single trade

## Related Streams
<br />

- **[Orders](/docs/hyperliquid/datasets/orders)** - View the order lifecycle events that lead to these trades
- **[Book Updates](/docs/hyperliquid/datasets/book-updates)** - See how these trades affect the order book
- **[TWAP](/docs/hyperliquid/datasets/twap)** - Track TWAP algorithm progress for trades with `twapId`