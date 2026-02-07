---
title: Events Dataset
description: Hyperliquid events dataset documentation - comprehensive blockchain events including transfers, deposits, withdrawals, and system operations
---

## Overview

The **events** stream contains comprehensive blockchain events from the Hyperliquid exchange, including balance changes, transfers, deposits, withdrawals, vault operations, cross-chain activities, and system operations.

**Stream Type:** `EVENTS`  
**API Availability:** gRPC Streaming API + JSON-RPC/WebSocket APIs  
**Volume:** High - Multiple event types captured per block

## Data Structure

Each block contains an array of events with different inner types representing various blockchain operations:

```json
{
  "local_time": "2025-11-05T16:09:18.727320857",
  "block_time": "2025-11-05T16:09:18.466557521",
  "block_number": 786814394,
  "events": [
    {
      "time": "2025-11-05T16:09:18.466557521",
      "hash": "0x4a3367a1c546233d4bad042ee5d5ba020b2a00876049420fedfc12f48449fd27",
      "inner": {
        "LedgerUpdate": {
          "users": [
            "0x025a744111554e57c66ba2069a8081249fbe5e11",
            "0x1e37a337ed460039d1b15bd3bc489de789768d5e"
          ],
          "delta": {
            "type": "vaultWithdraw",
            "vault": "0x1e37a337ed460039d1b15bd3bc489de789768d5e",
            "user": "0x025a744111554e57c66ba2069a8081249fbe5e11",
            "requestedUsd": "7.203866",
            "commission": "0.0",
            "closingCost": "0.0",
            "basis": "7.22722",
            "netWithdrawnUsd": "7.203866"
          }
        }
      }
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
    { field: 'time', type: 'string', description: 'Event timestamp (ISO 8601)' },
    { field: 'hash', type: 'string', description: 'Transaction hash (may be null hash for some events)' },
    { field: 'inner', type: 'object', description: 'Inner event data - see Event Types below' }
  ]}
/>
</div>

## Event Types

The events stream captures six distinct categories of blockchain operations, each serving different purposes:

<div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
<StyledTable
  columns={[
    { key: 'type', label: 'Event Type', width: '25%', align: 'left' },
    { key: 'description', label: 'Description', width: '45%', align: 'left' },
    { key: 'examples', label: 'Key Operations', width: '30%', align: 'left' }
  ]}
  showMobileCards={false}
  data={[
    { 
      type: 'LedgerUpdate', 
      description: 'Balance changes, transfers, and asset movements (most common event type)', 
      examples: 'Deposits, withdrawals, trades, vault operations' 
    },
    { 
      type: 'CWithdrawal', 
      description: 'Cross-chain withdrawal events from Hyperliquid to other chains', 
      examples: 'Bridge withdrawals, finalization status' 
    },
    { 
      type: 'CDeposit', 
      description: 'Cross-chain deposit events from other chains to Hyperliquid', 
      examples: 'Bridge deposits, incoming transfers' 
    },
    { 
      type: 'Delegation', 
      description: 'Validator delegation and undelegation operations', 
      examples: 'Stake delegation, undelegation, validator changes' 
    },
    { 
      type: 'Funding', 
      description: 'Funding rate payments for perpetual positions', 
      examples: 'Hourly funding payments, rate calculations' 
    },
    { 
      type: 'ValidatorRewards', 
      description: 'Validator reward distributions and payouts', 
      examples: 'Block rewards, commission distributions' 
    }
  ]}
/>
</div>

### Event Type Distribution
<br />

- **LedgerUpdate**: ~85% of all events (contains 15 different operation subtypes)
- **Funding**: ~10% of all events (regular hourly payments)  
- **CWithdrawal/CDeposit**: ~3% of all events (bridge operations)
- **Delegation/ValidatorRewards**: ~2% of all events (staking operations)

## LedgerUpdate Delta Types

LedgerUpdate events represent the majority of blockchain activity and contain a `delta` field that specifies the exact type of balance or state change. These 15 delta types are organized into five logical categories:

### Transfer Operations

These operations move funds or assets between different accounts, wallets, or account types within the Hyperliquid ecosystem.

<div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
<StyledTable
  columns={[
    { key: 'type', label: 'Delta Type', width: '35%', align: 'left' },
    { key: 'description', label: 'Description', width: '45%', align: 'left' },
    { key: 'commonUse', label: 'Common Use Cases', width: '20%', align: 'left' }
  ]}
  showMobileCards={false}
  data={[
    { type: 'send', description: 'Direct transfers between user wallets', commonUse: 'P2P payments, gifts' },
    { type: 'spotTransfer', description: 'Transfers involving spot market tokens', commonUse: 'Token exchanges' },
    { type: 'accountClassTransfer', description: 'Moving funds between spot and perpetual accounts', commonUse: 'Cross-margin moves' },
    { type: 'subAccountTransfer', description: 'Transfers between main and sub-accounts', commonUse: 'Account organization' },
    { type: 'internalTransfer', description: 'System-initiated internal movements', commonUse: 'Automated rebalancing' }
  ]}
/>
</div>

### Deposit/Withdrawal Operations

These operations track funds entering and leaving the Hyperliquid platform from external sources.

<div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
<StyledTable
  columns={[
    { key: 'type', label: 'Delta Type', width: '35%', align: 'left' },
    { key: 'description', label: 'Description', width: '45%', align: 'left' },
    { key: 'commonUse', label: 'Common Use Cases', width: '20%', align: 'left' }
  ]}
  showMobileCards={false}
  data={[
    { type: 'withdraw', description: 'User-initiated withdrawals from Hyperliquid', commonUse: 'Cashing out, moving to other platforms' },
    { type: 'deposit', description: 'User deposits into Hyperliquid accounts', commonUse: 'Adding trading capital, onboarding' }
  ]}
/>
</div>

### Vault Operations

These operations involve Hyperliquid's vault system, where users can deposit funds to be managed by vault leaders.

<div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
<StyledTable
  columns={[
    { key: 'type', label: 'Delta Type', width: '35%', align: 'left' },
    { key: 'description', label: 'Description', width: '45%', align: 'left' },
    { key: 'commonUse', label: 'Common Use Cases', width: '20%', align: 'left' }
  ]}
  showMobileCards={false}
  data={[
    { type: 'vaultDeposit', description: 'User deposits funds into managed vaults', commonUse: 'Passive investment' },
    { type: 'vaultWithdraw', description: 'User withdraws funds from managed vaults', commonUse: 'Profit taking, exit' },
    { type: 'vaultCreate', description: 'Creation of new investment vaults', commonUse: 'New fund launches' },
    { type: 'vaultLeaderCommission', description: 'Commission payments to vault managers', commonUse: 'Performance fees' }
  ]}
/>
</div>

### Cross-Chain Operations

These operations facilitate interactions between Hyperliquid and other blockchain networks.

<div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
<StyledTable
  columns={[
    { key: 'type', label: 'Delta Type', width: '35%', align: 'left' },
    { key: 'description', label: 'Description', width: '45%', align: 'left' },
    { key: 'commonUse', label: 'Common Use Cases', width: '20%', align: 'left' }
  ]}
  showMobileCards={false}
  data={[
    { type: 'cStakingTransfer', description: 'Transfers related to cross-chain staking operations', commonUse: 'Multi-chain yield farming' }
  ]}
/>
</div>

### System Operations

These operations represent various system-level activities including rewards, account management, and protocol features.

<div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
<StyledTable
  columns={[
    { key: 'type', label: 'Delta Type', width: '35%', align: 'left' },
    { key: 'description', label: 'Description', width: '45%', align: 'left' },
    { key: 'commonUse', label: 'Common Use Cases', width: '20%', align: 'left' }
  ]}
  showMobileCards={false}
  data={[
    { type: 'rewardsClaim', description: 'Users claiming accumulated rewards or incentives', commonUse: 'Staking rewards, referrals' },
    { type: 'accountActivationGas', description: 'Gas fees for activating new accounts', commonUse: 'Onboarding costs' },
    { type: 'activateDexAbstraction', description: 'Enabling advanced DEX abstraction features', commonUse: 'Pro trading features' }
  ]}
/>
</div>

## Example Events

<details>
<summary><strong>Send Transfer</strong></summary>

```json
{
  "time": "2025-11-05T10:00:11.608307855",
  "hash": "0xc65653c0e96471afc7d0042ee18ed40201ba00a6846790816a1eff13a8684b9a",
  "inner": {
    "LedgerUpdate": {
      "users": ["0x2e763fb97107d75687fe24ed785a2367df023bfd"],
      "delta": {
        "type": "send",
        "user": "0x2e763fb97107d75687fe24ed785a2367df023bfd",
        "destination": "0x2e763fb97107d75687fe24ed785a2367df023bfd",
        "sourceDex": "spot",
        "destinationDex": "",
        "token": "USDC",
        "amount": "1454.29",
        "usdcValue": "1454.29",
        "fee": "0.0",
        "nativeTokenFee": "0.0",
        "nonce": 1762336800859,
        "feeToken": ""
      }
    }
  }
}
```

</details>

<details>
<summary><strong>Spot Transfer</strong></summary>

```json
{
  "time": "2025-11-05T10:00:12.061687082",
  "hash": "0xcfa4de23c8340733d11e042ee18eda020291000963372605736d89768737e11e",
  "inner": {
    "LedgerUpdate": {
      "users": [
        "0x2222222222222222222222222222222222222222",
        "0xbe6ef6c481d807221ecdb430c7d7b95f71644f16"
      ],
      "delta": {
        "type": "spotTransfer",
        "token": "HYPE",
        "amount": "5.0",
        "usdcValue": "202.27",
        "user": "0x2222222222222222222222222222222222222222",
        "destination": "0xbe6ef6c481d807221ecdb430c7d7b95f71644f16",
        "fee": "0.0",
        "nativeTokenFee": "0.0",
        "nonce": null,
        "feeToken": ""
      }
    }
  }
}
```

</details>

<details>
<summary><strong>Account Class Transfer</strong></summary>

```json
{
  "time": "2025-11-05T10:00:00.064607181",
  "hash": "0x402db380b853070941a7042ee18e5502023c0066535625dbe3f65ed37756e0f3",
  "inner": {
    "LedgerUpdate": {
      "users": ["0x95b05afa7d7fbfae2ef100c9f1dab4ba72836535"],
      "delta": {
        "type": "accountClassTransfer",
        "usdc": "1.57",
        "toPerp": true
      }
    }
  }
}
```

</details>

<details>
<summary><strong>Withdrawal</strong></summary>

```json
{
  "time": "2025-11-05T10:01:39.693886853",
  "hash": "0x815c520448e379fcb09a694d08dc82c3988b8fd50e50dba633b823ee44886fff",
  "inner": {
    "LedgerUpdate": {
      "users": ["0xc66c8d71922825d97ed19e50287952d6b2d31879"],
      "delta": {
        "type": "withdraw",
        "usdc": "18.0",
        "nonce": 1762336653439000,
        "fee": "1.0"
      }
    }
  }
}
```

</details>

<details>
<summary><strong>Deposit</strong></summary>

```json
{
  "time": "2025-11-05T10:00:04.076937921",
  "hash": "0xdf9b536831f9b2732004130d0b2d12bfdf177a913a335157fb02096d4ec02867",
  "inner": {
    "LedgerUpdate": {
      "users": ["0x42be63db85e660e1cede260b10a66baae89bc3c8"],
      "delta": {
        "type": "deposit",
        "usdc": "100.0"
      }
    }
  }
}
```

</details>

<details>
<summary><strong>Vault Deposit</strong></summary>

```json
{
  "time": "2025-11-05T10:02:31.473428017",
  "hash": "0x020bb6aec6dced660385042ee195a10201e8009461d00c38a5d4620185d0c750",
  "inner": {
    "LedgerUpdate": {
      "users": [
        "0x945276fb8750c8ee5b86df4804903ce66b25eb59",
        "0xdfc24b077bc1425ad1dea75bcb6f8158e10df303"
      ],
      "delta": {
        "type": "vaultDeposit",
        "vault": "0xdfc24b077bc1425ad1dea75bcb6f8158e10df303",
        "usdc": "10862.38"
      }
    }
  }
}
```

</details>

<details>
<summary><strong>Vault Withdrawal</strong></summary>

```json
{
  "time": "2025-11-05T10:00:38.123241873",
  "hash": "0xba9bcc1734fd7ac2bc15042ee1903102104a00fccff099945e647769f3f154ad",
  "inner": {
    "LedgerUpdate": {
      "users": [
        "0xbbb9b4f5b99283da5538214e0b9ebe4ffd0a6895",
        "0x1e37a337ed460039d1b15bd3bc489de789768d5e"
      ],
      "delta": {
        "type": "vaultWithdraw",
        "vault": "0x1e37a337ed460039d1b15bd3bc489de789768d5e",
        "user": "0xbbb9b4f5b99283da5538214e0b9ebe4ffd0a6895",
        "requestedUsd": "2005.55655",
        "commission": "40.555655",
        "closingCost": "0.0",
        "basis": "1599.999999",
        "netWithdrawnUsd": "1965.000895"
      }
    }
  }
}
```

</details>

<details>
<summary><strong>Sub-Account Transfer</strong></summary>

```json
{
  "time": "2025-11-05T10:00:28.697668509",
  "hash": "0x608e9b5851f0b0e96208042ee18fb3020190003decf3cfbb045746ab10f48ad4",
  "inner": {
    "LedgerUpdate": {
      "users": [
        "0x407c578cc7c27d8df36633cd0a2531c14aa1ccd5",
        "0x56edf34cbfc2f46580654ca81ce6fdf8f06aed38"
      ],
      "delta": {
        "type": "subAccountTransfer",
        "usdc": "272.0",
        "user": "0x56edf34cbfc2f46580654ca81ce6fdf8f06aed38",
        "destination": "0x407c578cc7c27d8df36633cd0a2531c14aa1ccd5"
      }
    }
  }
}
```

</details>

<details>
<summary><strong>Cross-Chain Withdrawal</strong></summary>

```json
{
  "time": "2025-11-05T10:00:09.060620743",
  "hash": "0x0000000000000000000000000000000000000000000000000000000000000000",
  "inner": {
    "CWithdrawal": {
      "user": "0x12c4b5b36c7a2ba402cdc674b7a5b4328cb01fd3",
      "amount": "0.30258917",
      "is_finalized": true
    }
  }
}
```

</details>

<details>
<summary><strong>Cross-Chain Deposit</strong></summary>

```json
{
  "time": "2025-11-05T10:15:42.264672394",
  "hash": "0xf240f9dd9eab7c85f3ba042ee1bc6702070f00c339ae9b589609a5305daf5670",
  "inner": {
    "CDeposit": {
      "user": "0xd93afcb4a933394963ab2a44c83de29073ae226a",
      "amount": "11.12345049"
    }
  }
}
```

</details>

<details>
<summary><strong>Delegation</strong></summary>

```json
{
  "time": "2025-11-05T10:09:17.981652963",
  "hash": "0x2f96561601812a3a3110042ee1a9a402027c00fb9c84490cd35f0168c0850424",
  "inner": {
    "Delegation": {
      "user": "0x06c25dadfd91e721be33130135286db335571037",
      "validator": "0xb8f45222a3246a2b0104696a1df26842007c5bc5",
      "amount": "1.0",
      "is_undelegate": true
    }
  }
}
```

</details>

<details>
<summary><strong>Rewards Claim</strong></summary>

```json
{
  "time": "2025-11-05T10:01:12.722447184",
  "hash": "0x546aff0681417b4155e4042ee191e702094900ec1c449a13f833aa594045552b",
  "inner": {
    "LedgerUpdate": {
      "users": ["0x364fc7e594e98f123829403889a6a2212583f58a"],
      "delta": {
        "type": "rewardsClaim",
        "amount": "18.40514403",
        "token": "USDC"
      }
    }
  }
}
```

</details>

## API Usage

<details>
<summary><strong>gRPC Streaming</strong></summary>

```javascript
// Subscribe to events
const request = {
  subscribe: {
    stream_type: 'EVENTS',
    start_block: 0,
    filters: {
      "user": ["0x123..."]},
      "type": ["vaultWithdraw", "deposit", "withdraw"]}
    }
  }
};
```

</details>

<details>
<summary><strong>JSON-RPC</strong></summary>

```bash
# Get latest event blocks
curl -X POST https://your-endpoint.hype-mainnet.quiknode.pro/your-token/hypercore \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "hl_getLatestBlocks",
    "params": {
      "stream": "events",
      "count": 10
    },
    "id": 1
  }'
```

</details>

<details>
<summary><strong>WebSocket</strong></summary>

```javascript
// Subscribe to events
ws.send(JSON.stringify({
  "method": "hl_subscribe",
  "params": {
    "streamType": "events"
  }
}));
```

</details>

## Important Notes
<br />

- **Comprehensive Coverage**: This stream captures all balance-affecting operations on the platform
- **Multiple Users**: Events can affect multiple users (shown in `users` array)
- **Hash Field**: May be null hash (`0x000...`) for some system events
- **Cross-Chain Events**: CDeposit and CWithdrawal events track bridge operations
- **Vault Operations**: Include deposits, withdrawals, creation, and commission payments
- **System Events**: Include account activation, DEX abstraction, and reward claims

## Related Streams
<br />

- **[Trades](./trades)** - See trading activity that may trigger balance changes
- **[Orders](./orders)** - View order activity that may result in fee payments
- **[Blocks](./blocks)** - See the raw HyperCore transactions that generate these events