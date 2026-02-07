---
title: Hyperliquid Data Streams
description: Overview of Hyperliquid data stream types and their structures
---

## Overview

Hyperliquid provides several data streams that contain different types of blockchain and exchange events. These streams are available through both **gRPC Streaming API** and **JSON-RPC/WebSocket APIs**, allowing you to access real-time and historical data.

## Available Data Streams

<div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
<StyledTable
  columns={[
    { key: 'streamType', label: 'Stream Type', width: '16%', align: 'left' },
    { key: 'description', label: 'Description', width: '30%', align: 'left' },
    { key: 'availability', label: 'API Availability', width: '20%', align: 'center' },
    { key: 'useCase', label: 'Primary Use Case', width: '34%', align: 'left' }
  ]}
  showMobileCards={true}
  data={[
    {
      streamType: 'TRADES',
      description: 'All executed trades with price, size, and direction',
      availability: 'gRPC + JSON-RPC/WSS',
      useCase: 'Trading analytics, price tracking'
    },
    {
      streamType: 'ORDERS', 
      description: 'Order lifecycle events (18+ status types including fills, cancellations)',
      availability: 'gRPC + JSON-RPC/WSS',
      useCase: 'Order management, execution monitoring'
    },
    {
      streamType: 'BOOK_UPDATES',
      description: 'Order book changes with bid/ask prices and quantities',
      availability: 'gRPC + JSON-RPC/WSS',
      useCase: 'Market depth analysis, liquidity monitoring'
    },
    {
      streamType: 'TWAP',
      description: 'TWAP execution data and algorithm progress',
      availability: 'gRPC + JSON-RPC/WSS',
      useCase: 'Algorithmic trading, execution analytics'
    },
    {
      streamType: 'EVENTS',
      description: 'Balance changes, transfers, deposits, withdrawals, vault operations',
      availability: 'gRPC + JSON-RPC/WSS',
      useCase: 'Fund flow analysis, account monitoring'
    },
    {
      streamType: 'BLOCKS',
      description: 'Raw HyperCore blockchain data exposing replica_cmds (all transaction types)',
      availability: 'gRPC only',
      useCase: 'Blockchain analysis, data archiving'
    },
    {
      streamType: 'WRITER_ACTIONS',
      description: 'HyperCore ↔ HyperEVM asset transfers and bridge data',
      availability: 'gRPC + JSON-RPC/WSS',
      useCase: 'Cross-environment asset tracking, DeFi analytics'
    }
  ]}
/>
</div>

## Stream Filtering

All Hyperliquid data streams support powerful filtering capabilities to help you receive only the data you need. Without filtering, streaming can generate massive amounts of data. Filters allow you to focus on specific trading pairs, users, event types, and more.

**Key Benefits:**
- **Reduced bandwidth** - Receive only relevant data instead of processing everything
- **Focused applications** - Build targeted apps without overwhelming data streams  
- **Real-time efficiency** - Process specific events faster for alerts and decision making

**Example filters (WebSocket):**
```json
{
  "streamType": "trades",
  "filters": {
    "coin": ["BTC", "ETH"],     // Only BTC and ETH trades
    "side": ["B"],              // Only buy orders
    "user": ["0x123..."]        // Only specific user's trades
  }
}
```

**[Complete Filtering Guide](/docs/hyperliquid/filtering)** - Detailed documentation with syntax, examples, and field references for all stream types.

## Stream Structure

All data streams follow a consistent structure:

```json
{
  "local_time": "2025-12-04T17:52:45.734593237",
  "block_time": "2025-12-04T17:52:45.554315846", 
  "block_number": 817863403,
  "events": [
    // Array of events specific to the stream type
  ]
}
```

### Common Fields

<div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
<StyledTable
  columns={[
    { key: 'field', label: 'Field', width: '35%', align: 'left' },
    { key: 'type', label: 'Type', width: '30%', align: 'left' },
    { key: 'description', label: 'Description', width: '40%', align: 'left' }
  ]}
  showMobileCards={false}
  data={[
    {
      field: 'local_time',
      type: 'string',
      description: 'Local server timestamp in ISO 8601 format'
    },
    {
      field: 'block_time',
      type: 'string', 
      description: 'Blockchain block timestamp in ISO 8601 format'
    },
    {
      field: 'block_number',
      type: 'integer',
      description: 'Sequential block number on Hyperliquid chain'
    },
    {
      field: 'events',
      type: 'array',
      description: 'Array of events specific to the stream type'
    }
  ]}
/>
</div>

## Data Stream Details

Each data stream has its own unique event structure and use cases:
<br />

- **[Stream Filtering](/docs/hyperliquid/filtering)** - Complete guide to filtering all stream types with syntax and examples
- **[Trades](/docs/hyperliquid/datasets/trades)** - Executed trade data with maker/taker information
- **[Orders](/docs/hyperliquid/datasets/orders)** - Complete order lifecycle tracking with 18+ status types
- **[Book Updates](/docs/hyperliquid/datasets/book-updates)** - Real-time order book changes for market depth analysis
- **[TWAP](/docs/hyperliquid/datasets/twap)** - Time-weighted average price execution tracking
- **[Events](/docs/hyperliquid/datasets/events)** - Balance changes, transfers, deposits, withdrawals, and vault operations
- **[Blocks](/docs/hyperliquid/datasets/blocks)** - Raw blockchain data (gRPC only)
- **[Writer Actions](/docs/hyperliquid/datasets/writer-actions)** - HyperCore ↔ HyperEVM asset transfers and bridge data

## Access Methods

### gRPC Streaming API
All streams are available via the gRPC Streaming API for high-performance, real-time data access:

```javascript
// Subscribe to trades stream
subscribe: {
  stream_type: 'TRADES',
  start_block: 0,
  filters: {
    "coin": {"values": ["BTC", "ETH"]},
    "user": {"values": ["0x123..."]}
  }
}
```

### JSON-RPC API
Historical data access via JSON-RPC methods:

```bash
# Get latest blocks
curl -X POST https://your-endpoint.hype-mainnet.quiknode.pro/your-token/hypercore \
  -d '{"method": "hl_getLatestBlocks", "params": {"stream": "trades", "count": 10}}'

# Get specific block
curl -X POST https://your-endpoint.hype-mainnet.quiknode.pro/your-token/hypercore \
  -d '{"method": "hl_getBlock", "params": ["trades", 817863403]}'
```

### WebSocket API
Real-time subscriptions via WebSocket:

```javascript
// Subscribe to trades
ws.send(JSON.stringify({
  "method": "hl_subscribe",
  "params": {"streamType": "trades"}
}));

// Subscribe to orders
ws.send(JSON.stringify({
  "method": "hl_subscribe",
  "params": {"streamType": "orders"}
}));
```

## Frequently Asked Questions

<FAQAccordion
  items={[
    {
      question: "Which plan should I use for streaming all datasets with gRPC or WSS?",
      answer: "For users planning to stream all Hypercore datasets using gRPC or WSS with no filtering, we recommend the <strong>Scale plan or higher</strong> to account for the expected throughput.<br/><br/>Data volume varies based on onchain activity, and streaming all datasets without filters can generate significant data transfer. The Scale plan provides sufficient API credits to handle this usage pattern."
    },
    {
      question: "How much data does each stream produce per hour?",
      answer: "Based on live testing, here are the <strong>estimated decompressed data rates per hour</strong> for each stream:<br/><br/><strong>High-volume streams:</strong><br/>• <strong>BLOCKS:</strong> ~9.14 GB/hour (152 MB/min)<br/>• <strong>ORDERS:</strong> ~4.11 GB/hour (68 MB/min)<br/>• <strong>BOOK_UPDATES:</strong> ~3.15 GB/hour (53 MB/min)<br/><br/><strong>Medium-volume streams:</strong><br/>• <strong>TRADES:</strong> ~130 MB/hour (2.16 MB/min)<br/><br/><strong>Low-volume streams:</strong><br/>• <strong>EVENTS:</strong> ~6.8 MB/hour (0.11 MB/min)<br/>• <strong>WRITER_ACTIONS:</strong> ~5.8 MB/hour (0.10 MB/min)<br/>• <strong>TWAP:</strong> ~5.3 MB/hour (0.09 MB/min)<br/><br/><strong>Important:</strong> These are <em>estimates</em> based on a 10-minute testing period and extrapolated to hourly rates. <strong>Actual data volume will vary significantly based on network traffic.</strong> During periods of high market activity, trading volume, or increased onchain transactions, these rates can increase substantially. Plan your infrastructure and API credit usage accordingly."
    },
    {
      question: "Does Hyperliquid support data compression?",
      answer: "Yes! We support and encourage using <strong>zstd compression</strong> for gRPC streaming.<br/><br/><strong>Key points:</strong><br/>• Compression significantly improves data transfer speeds<br/>• Compression does <strong>not</strong> affect billing - you're billed on uncompressed data volume<br/>• Example implementations available at <a href='https://github.com/quiknode-labs/hypercore-grpc-examples' target='_blank'>hypercore-grpc-examples</a><br/><br/>Using compression is highly recommended for optimal performance, especially when streaming multiple datasets."
    },
    {
      question: "How many addresses can I filter?",
      answer: "<strong>gRPC/WebSocket concurrent streams and filters by plan:</strong><br/>• <strong>Build:</strong> 1 stream with up to 5 filters each<br/>• <strong>Accelerate:</strong> 5 streams with up to 10 filters each<br/>• <strong>Scale:</strong> 10 streams with up to 25 filters each<br/>• <strong>Business:</strong> 25 streams with up to 50 filters each<br/><br/><strong>For larger address lists:</strong><br/>Use our <a href='https://www.quicknode.com/docs/key-value-store' target='_blank'>KV Store</a> + <a href='https://www.quicknode.com/streams' target='_blank'>Streams</a> product for handling extensive address filtering. <br/><br/>See the complete <a href='/docs/hyperliquid/filtering'>Filtering Guide</a> for detailed filter syntax and examples."
    },
    {
      question: "Does gRPC support historical data queries?",
      answer: "No, gRPC is a <strong>streaming-only service</strong> designed for real-time data. It does not support querying historical blocks.<br/><br/><strong>For historical/backfill data, use JSON-RPC methods:</strong><br/>• <a href='/docs/hyperliquid/json-rpc/hl_getLatestBlocks'><code>hl_getLatestBlocks</code></a> - Fetch up to 200 recent blocks<br/>• <a href='/docs/hyperliquid/json-rpc/hl_getBatchBlocks'><code>hl_getBatchBlocks</code></a> - Fetch up to 200 specific blocks by number<br/><br/><strong>If your gRPC connection breaks:</strong><br/>You can use these JSON-RPC methods to query historical blocks in batches for backfilling, then resume your gRPC stream from the current block."
    },
    {
      question: "Where can I find gRPC streaming examples with compression?",
      answer: "We provide complete working examples for Hyperliquid gRPC streaming with <strong>zstd compression support</strong> in our official GitHub repository:<br/><br/><a href='https://github.com/quiknode-labs/hypercore-grpc-examples' target='_blank'>github.com/quiknode-labs/hypercore-grpc-examples</a><br/><br/><strong>What's included:</strong><br/>• Ready-to-run code examples in multiple languages<br/>• zstd compression implementation<br/>• Stream filtering examples<br/>• Complete setup instructions<br/><br/>Simply clone the repository, install dependencies, plug in your Quicknode endpoint, and run. These examples demonstrate best practices for optimal performance when streaming Hyperliquid data."
    }
  ]}
/>