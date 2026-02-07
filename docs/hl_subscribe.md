# hl_subscribe

Subscribes to real-time updates from a specified Hyperliquid stream via WebSocket using JSON-RPC protocol.

## Parameters

- **streamType** (string (REQUIRED)): Stream type to subscribe to: 'trades' (executed trades), 'orders' (order statuses - high volume), 'book_updates' (order book updates), 'twap' (TWAP history), 'events' (liquidations, transfers), 'writer_actions' (writer action events)

- **filters** (object (optional)): Optional filters to apply to the stream. Each field maps directly to an array of filter values.

- **filterName** (string (optional)): Optional name for this filter set (enables OR logic and named unsubscribe)

## Returns

- **result** (object): Returns subscription confirmation and continuous real-time stream data for the subscribed stream with applied filters

## Code Examples

### WSCAT

```js
wscat -c {{url_wss}}/ws \
# wait for connection 
{"jsonrpc":"2.0","method":"hl_subscribe","params":{"streamType":"trades"},"id":1}
```
