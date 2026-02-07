---
title: Hyperliquid gRPC Streaming API
description: Hyperliquid gRPC API Overview
---

## Overview

Hyperliquid gRPC is a high-performance streaming API that enables real-time blockchain data access through gRPC interfaces. It serves as a powerful tool for developers who need to:
- Stream blockchain data in real-time
- Monitor on-chain activities (trades, orders, liquidations, funding events)
- Query HyperCore blockchain states efficiently
- Track TWAP executions and order book changes with minimal latency

The API provides enterprise-grade reliability with granular control over data streams, supporting both HyperCore and HyperEVM data.

## Access

To access Hyperliquid gRPC, you need to have a Quicknode endpoint with gRPC streaming enabled.

### Endpoint and Token Configuration
Hyperliquid gRPC operates on port 10000. This is a dedicated secure port for gRPC communication and is separate from the standard Hyperliquid RPC endpoint. When connecting to the service the port must be specified in the URL:

- **Endpoint**: The name of your gRPC-enabled endpoint followed by `.hype-mainnet.quiknode.pro` and the port number `10000` (e.g., `https://example-guide-demo.hype-mainnet.quiknode.pro:10000`)
- **Token**: Your API key that can be generated from the [Quicknode Dashboard](https://dashboard.quicknode.com/) Endpoint Security tab.

Given the following example HTTP Provider URL: `https://example-guide-demo.hype-mainnet.quiknode.pro/abc123def456/`, your authentication credentials would be:
- Endpoint: `https://example-guide-demo.hype-mainnet.quiknode.pro:10000`
- Token: `abc123def456`

Here is a sample for using this endpoint to connect with Node.js:

```javascript
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
// For HTTP Provider URL: https://example-guide-demo.hype-mainnet.quiknode.pro/abc123def456/
const ENDPOINT = 'example-guide-demo.hype-mainnet.quiknode.pro:10000';
const TOKEN = 'abc123def456';

const client = new hyperliquid.Hyperliquid(ENDPOINT, credentials);
const metadata = new grpc.Metadata();
metadata.add('x-token', TOKEN);
```

### Available Streams

<div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
<StyledTable
  columns={[
    { key: 'streamType', label: 'Stream Type', width: '180px', align: 'left' },
    { key: 'description', label: 'Description', width: '420px', align: 'left' },
    { key: 'useCase', label: 'Primary Use Case', width: '300px', align: 'left' }
  ]}
  showMobileCards={true}
  data={[
    {
      streamType: 'TRADES',
      description: 'All executed trades with price, size, and direction',
      useCase: 'Trading analytics, price tracking'
    },
    {
      streamType: 'ORDERS', 
      description: 'Order lifecycle events (18+ status types including fills, cancellations)',
      useCase: 'Order management, execution monitoring'
    },
    {
      streamType: 'BOOK_UPDATES',
      description: 'Order book changes (Level 2 data)',
      useCase: 'Market depth analysis, liquidity monitoring'
    },
    {
      streamType: 'TWAP',
      description: 'TWAP execution data and algorithm progress',
      useCase: 'Algorithmic trading, execution analytics'
    },
    {
      streamType: 'EVENTS',
      description: 'System events (funding, liquidations, governance)',
      useCase: 'Risk management, system monitoring'
    },
    {
      streamType: 'BLOCKS',
      description: 'Raw HyperCore blockchain data (all transaction types)',
      useCase: 'Blockchain analysis, data archiving'
    },
    {
      streamType: 'WRITER_ACTIONS',
      description: 'System operations for spot token transfers',
      useCase: 'Cross-environment asset tracking, system monitoring'
    }
  ]}
/>
</div>

## Stream Filtering

All Hyperliquid gRPC streams support powerful filtering capabilities to help you receive only the data you need. Filters allow you to focus on specific trading pairs, users, event types, and more, significantly reducing bandwidth and improving performance.

**Example gRPC filter:**
```protobuf
Subscribe {
  stream_type: TRADES,
  filters: {
    "coin": FilterValues { values: ["BTC", "ETH"] },
    "side": FilterValues { values: ["B"] }
  }
}
```

**[Complete Filtering Guide](/docs/hyperliquid/filtering)** - Detailed documentation with syntax, examples, and field references for all stream types.

## Making Hyperliquid gRPC Requests

To make requests to Hyperliquid gRPC using different languages, check out the resources below:

- [Go](/docs/hyperliquid/grpc-api/setup/go)
- [Node.js](/docs/hyperliquid/grpc-api/setup/nodejs)
- [Python](/docs/hyperliquid/grpc-api/setup/python)