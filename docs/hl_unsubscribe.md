# hl_unsubscribe

Unsubscribes from specified Hyperliquid streams or named filters via WebSocket.

## Parameters

- **streamType** (string (optional)): Stream type to unsubscribe from: 'trades', 'orders', 'book_updates', 'twap', 'events', 'writer_actions'

- **filterName** (string (optional)): Name of the specific filter to unsubscribe from (if subscription was created with a filterName)

## Returns

- **result** (object): Returns confirmation of successfully unsubscribed stream or filter

## Code Examples

### WSCAT

```js
wscat -c {{url_wss}}/ws \
# wait for connection 
{"jsonrpc":"2.0","method":"hl_unsubscribe","params":{"streamType":"trades"},"id":2}
```
