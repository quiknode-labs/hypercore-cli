---
title: Blocks Dataset
description: Hyperliquid blocks dataset documentation - complete raw HyperCore transaction data with all 34 action types
---

## Overview

The **blocks** stream (stored as `replica_cmds`) contains **ALL raw HyperCore transactions** submitted to the Hyperliquid blockchain. This is the most comprehensive dataset available, capturing every action on the chain.

**Stream Type:** `BLOCKS`  
**API Availability:** gRPC Streaming API only  
**Volume:** Extremely High - Every HyperCore action is recorded  
**Availability:** **gRPC nodes only**

## Data Structure

Each block contains:

- **Block metadata** (`abci_block`)
- **Signed action bundles** (transactions with signatures)  
- **Responses** (`resps`) showing success/failure of each action

```json
{
  "abci_block": {
    "round": 1096693511,
    "parent_round": 1096693510,
    "time": "2025-12-04T08:00:47.509497915",
    "proposer": "0x9dd85fb6cf95a9d755af0853b36fb05e972c71e1",
    "hardfork": {
      "version": 69,
      "round": 1091072071
    },
    "signed_action_bundles": [
      [
        "0xhash...",
        {
          "signed_actions": [
            {
              "signature": {
                "r": "0x...",
                "s": "0x...",
                "v": 28
              },
              "action": {
                "type": "order",
                "a": 0,
                "b": true,
                "p": "92385.0",
                "s": "0.00361",
                "r": false,
                "t": {"limit": {"tif": "Gtc"}},
                "c": "0x89119db7aae18b90abe620888af9aadc"
              },
              "nonce": 1764816505537,
              "vaultAddress": null
            }
          ],
          "broadcaster": "0x...",
          "broadcaster_nonce": 1764816362065
        }
      ]
    ]
  },
  "resps": {
    "Full": [
      [
        "0xhash...",
        [
          {
            "user": "0x...",
            "res": {
              "status": "ok",
              "response": {
                "type": "default"
              }
            }
          }
        ]
      ]
    ]
  }
}
```

## Block Metadata Fields

<div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
<StyledTable
  columns={[
    { key: 'field', label: 'Field', width: '25%', align: 'left' },
    { key: 'type', label: 'Type', width: '20%', align: 'left' },
    { key: 'description', label: 'Description', width: '55%', align: 'left' }
  ]}
  showMobileCards={false}
  data={[
    { field: 'round', type: 'integer', description: 'Block number (use this as the block identifier)' },
    { field: 'parent_round', type: 'integer', description: 'Previous block number' },
    { field: 'time', type: 'string', description: 'Block timestamp (ISO 8601)' },
    { field: 'proposer', type: 'string', description: 'Validator address who proposed this block' },
    { field: 'hardfork', type: 'object', description: 'Current protocol version and activation block' }
  ]}
/>
</div>

## Transaction Fields

<div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
<StyledTable
  columns={[
    { key: 'field', label: 'Field', width: '30%', align: 'left' },
    { key: 'type', label: 'Type', width: '25%', align: 'left' },
    { key: 'description', label: 'Description', width: '45%', align: 'left' }
  ]}
  showMobileCards={false}
  data={[
    { field: 'signature', type: 'object', description: 'ECDSA signature with r, s, v components' },
    { field: 'action', type: 'object', description: 'The actual operation being performed (see Action Types)' },
    { field: 'nonce', type: 'integer', description: 'Transaction nonce for replay protection' },
    { field: 'vaultAddress', type: 'string|null', description: 'Present when action is performed by a vault' },
    { field: 'broadcaster', type: 'string', description: 'Address that broadcasted the transaction bundle' },
    { field: 'broadcaster_nonce', type: 'integer', description: 'Broadcaster\'s nonce for the bundle' }
  ]}
/>
</div>

<details>
<summary><strong>Complete Action Types (34 Types)</strong></summary>

All HyperCore transaction types are organized by category for easier understanding:

<div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
<StyledTable
  columns={[
    { key: 'category', label: 'Category', width: '25%', align: 'left' },
    { key: 'actions', label: 'Action Types', width: '40%', align: 'left' },
    { key: 'description', label: 'Purpose', width: '35%', align: 'left' }
  ]}
  showMobileCards={false}
  data={[
    { 
      category: 'Trading', 
      actions: 'order, cancel, cancelByCloid, modify, batchModify, scheduleCancel', 
      description: 'Place, modify, and cancel orders' 
    },
    { 
      category: 'TWAP Orders', 
      actions: 'twapOrder, twapCancel', 
      description: 'Time-weighted algorithmic trading' 
    },
    { 
      category: 'Asset Transfers', 
      actions: 'usdSend, spotSend, sendAsset, withdraw3, usdClassTransfer', 
      description: 'Move funds between accounts and off-platform' 
    },
    { 
      category: 'Account Management', 
      actions: 'createSubAccount, subAccountTransfer, updateLeverage, updateIsolatedMargin', 
      description: 'Sub-accounts, leverage, and margin settings' 
    },
    { 
      category: 'Vault Operations', 
      actions: 'vaultTransfer, NetChildVaultPositionsAction, approveAgent', 
      description: 'Vault deposits, withdrawals, and agent permissions' 
    },
    { 
      category: 'Builder & MEV', 
      actions: 'approveBuilderFee', 
      description: 'MEV builder fee approvals and payments' 
    },
    { 
      category: 'Referrals', 
      actions: 'registerReferrer, setReferrer', 
      description: 'Referral program registration and attribution' 
    },
    { 
      category: 'Market Deployment', 
      actions: 'perpDeploy', 
      description: 'Launch new perpetual markets' 
    },
    { 
      category: 'Token Operations', 
      actions: 'tokenDelegate', 
      description: 'Token delegation for governance/staking' 
    },
    { 
      category: 'EVM Operations', 
      actions: 'evmRawTx, evmUserModify', 
      description: 'Direct smart contract interactions' 
    },
    { 
      category: 'DEX Abstraction', 
      actions: 'agentEnableDexAbstraction, userDexAbstraction', 
      description: 'Unified DEX interface and advanced trading' 
    },
    { 
      category: 'Validator & Governance', 
      actions: 'ValidatorSignWithdrawalAction, VoteEthFinalizedWithdrawalAction, SetGlobalAction', 
      description: 'Bridge security, governance, protocol upgrades' 
    },
    { 
      category: 'Multi-Signature', 
      actions: 'multiSig', 
      description: 'Transactions requiring multiple approvals' 
    },
    { 
      category: 'Utility', 
      actions: 'noop', 
      description: 'Protocol synchronization and placeholder transactions' 
    }
  ]}
/>
</div>

### Key Action Details

<div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
<StyledTable
  columns={[
    { key: 'action', label: 'Action', width: '25%', align: 'left' },
    { key: 'description', label: 'Description', width: '50%', align: 'left' },
    { key: 'keyFields', label: 'Key Fields', width: '25%', align: 'left' }
  ]}
  showMobileCards={false}
  data={[
    { action: 'order', description: 'Place new orders on the exchange', keyFields: 'a, b, p, s, r, t, c' },
    { action: 'cancel', description: 'Cancel orders by order ID', keyFields: 'a, o' },
    { action: 'twapOrder', description: 'Place algorithmic TWAP orders', keyFields: 'duration, randomization' },
    { action: 'usdSend', description: 'Send USD between users', keyFields: 'destination, amount, fee' },
    { action: 'withdraw3', description: 'Withdraw funds from platform', keyFields: 'destination, amount' },
    { action: 'vaultTransfer', description: 'Transfer to/from vaults', keyFields: 'vault, amount, direction' },
    { action: 'evmRawTx', description: 'Raw EVM transactions', keyFields: 'RLP encoded data' },
    { action: 'perpDeploy', description: 'Deploy new perpetual markets', keyFields: 'market parameters' }
  ]}
/>
</div>

**Field Abbreviations:**
- `a` = asset, `b` = is buy, `p` = price, `s` = size, `r` = reduce only, `t` = order type, `c` = cloid, `o` = order ID

</details>

<details>
<summary><strong>Response Structure</strong></summary>

The `resps` field contains the result of each action:

```json
{
  "Full": [
    [
      "0xtransaction_hash",
      [
        {
          "user": "0xuser_address",
          "res": {
            "status": "ok",  // or "err"
            "response": {
              "type": "default"  // or specific response data
            }
          }
        }
      ]
    ]
  ]
}
```

**Status values:**
- `"ok"` - Action executed successfully
- `"err"` - Action failed (response contains error message)

</details>

## API Usage

<details>
<summary><strong>gRPC Streaming Only</strong></summary>

```javascript
// Subscribe to blocks (gRPC only)
const request = {
  subscribe: {
    stream_type: 'BLOCKS',
    start_block: 0,
    filters: {
      "action_type": {"values": ["order", "cancel", "twapOrder"]},
      "user": {"values": ["0x123..."]}
    }
  }
};
```

**Note**: This dataset is **only available on gRPC nodes**, not through JSON-RPC or WebSocket APIs.

</details>

## Important Notes
<br />

1. **gRPC Nodes Only**: This dataset is **only available on gRPC nodes**, not on regular full nodes
2. **Block Identifier**: Use `round` as the block number, not the file name
3. **Responses Required**: Always check `resps` to see if actions succeeded or failed
4. **Highest Volume**: This is the highest volume dataset - each block can contain thousands of actions
5. **Most Comprehensive**: This captures **EVERYTHING** on HyperCore - if it happened on Hyperliquid, it's here
6. **Raw HyperCore Data**: This is the raw blockchain data before any processing or aggregation
7. **Signature Verification**: All actions include ECDSA signatures for verification
8. **Vault Actions**: Actions from vaults include `vaultAddress` field

## Related Streams
<br />

- **[Orders](/docs/hyperliquid/datasets/orders)** - Processed order events derived from raw `order` actions
- **[Trades](/docs/hyperliquid/datasets/trades)** - Trade executions resulting from order matching
- **[Events](/docs/hyperliquid/datasets/events)** - Processed blockchain events derived from various actions
- **[TWAP](/docs/hyperliquid/datasets/twap)** - TWAP order status updates from `twapOrder` and `twapCancel` actions