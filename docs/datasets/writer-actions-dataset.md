---
title: Writer Actions Dataset
description: Hyperliquid writer_actions dataset documentation - system writer and bridge action events
---

## Overview

The `writer_actions` stream contains system writer actions, including spot send and core writer flows used for HyperCore/HyperEVM-related operations.

**Stream Type:** `WRITER_ACTIONS`  
**API Availability:** WebSocket + JSON-RPC + gRPC  
**Volume:** Low

## Event Structure

Each block follows the common HyperCore envelope:

```json
{
  "block_number": 817863403,
  "block_time": "2025-12-04T17:52:45.554315846",
  "local_time": "2025-12-04T17:52:45.734593237",
  "events": [
    {
      "time": "2025-12-04T17:52:45.554315846",
      "user": "0x2001222233334444555566667777888899990000",
      "nonce": 8123,
      "evm_tx_hash": "0xddddeeeeffff1111222233334444555566667777888899990000aaaabbbbcccc",
      "action": {
        "type": "SystemSpotSendAction",
        "destination": "0x9999222233334444555566667777888899990000",
        "token": 124,
        "wei": "250000000000000000"
      }
    }
  ]
}
```

### Key Fields

- `user`: source user address
- `nonce`: action nonce
- `evm_tx_hash`: related HyperEVM transaction hash (when present)
- `action.type`: action discriminator (for example `SystemSpotSendAction`)
- `action.destination`: destination address (when present)
- `action.token`: token identifier
- `action.wei`: quantity in wei units

## Filtering

Common filters:

- `user`
- `type` (maps to `action.type`)
- `destination` (maps to `action.destination`)
- `token` (maps to `action.token`)

Example:

```json
{
  "streamType": "writer_actions",
  "filters": {
    "type": ["SystemSpotSendAction"],
    "token": ["124"]
  }
}
```
