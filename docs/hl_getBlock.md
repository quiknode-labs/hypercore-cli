# hl_getBlock

Retrieves a specific block from a Hyperliquid stream by block number.

## Parameters

- **stream** (string (REQUIRED)): The stream type to query (trades, orders, events, book, twap, writer_actions)

- **block_number** (integer (REQUIRED)): The specific block number to retrieve

## Returns

- **result** (object): The requested block object
  - **block_number** (integer): Block number on the Hyperliquid chain
  - **block_time** (string): Block timestamp in ISO 8601 format
  - **local_time** (string): Local server timestamp in ISO 8601 format
  - **events** (array): List of events in this block; each event is a 2-item tuple of [address, payload]
    - **address** (string): Event address as a 0x-prefixed hex string
    - **payload** (object): Event payload data
      - **builder** (string): Builder address as a 0x-prefixed hex string (only present for some events)
      - **builderFee** (string): Builder fee amount as a stringified number (only present for some events)
      - **cloid** (string): Client order identifier (only present for some events)
      - **closedPnl** (string): Realized PnL from this event as a stringified number
      - **coin** (string): Instrument symbol (e.g., BTC, xyz:XYZ100, xyz:HOOD)
      - **crossed** (boolean): Whether the order crossed the book
      - **dir** (string): Action direction describing the position change (e.g., Open Long, Open Short, Close Long, Close Short, Short > Long, Long > Short)
      - **fee** (string): Fee amount as a stringified number (can be negative depending on rebates)
      - **feeToken** (string): Token symbol used for fees (e.g., USDC)
      - **hash** (string): Transaction hash as a 0x-prefixed hex string
      - **oid** (integer): Order identifier
      - **px** (string): Execution price as a stringified number
      - **side** (string): Trade side indicator (e.g., B or A)
      - **startPosition** (string): Position size before the event as a stringified number
      - **sz** (string): Execution size/quantity as a stringified number
      - **tid** (integer): Trade identifier
      - **time** (integer): Event timestamp in milliseconds since Unix epoch
      - **twapId** (integer): TWAP identifier if the event is associated with a TWAP; null if not associated with a TWAP

## Code Examples

### CURL

```sh
curl {{url}} \
  -X POST \
  -H "Content-Type: application/json" \
  --data '{
    "jsonrpc": "2.0",
    "method": "hl_getBlock",
    "params": ["trades", 817824084],
    "id": 1
  }'
```

### JAVASCRIPT

```js
var myHeaders = new Headers();
myHeaders.append("Content-Type", "application/json");

var raw = JSON.stringify({
  "jsonrpc": "2.0",
  "method": "hl_getBlock",
  "params": ["trades", 817824084],
  "id": 1
});

var requestOptions = {
  method: 'POST',
  headers: myHeaders,
  body: raw,
  redirect: 'follow'
};

fetch("{{url}}", requestOptions)
  .then(response => response.text())
  .then(result => console.log(result))
  .catch(error => console.log('error', error));
```

### PYTHON

```py
import requests
import json

url = "{{url}}"

payload = json.dumps({
  "jsonrpc": "2.0",
  "method": "hl_getBlock",
  "params": ["trades", 817824084],
  "id": 1
})

headers = {
  'Content-Type': 'application/json'
}

response = requests.request("POST", url, headers=headers, data=payload)

print(response.text)
```

### RUBY

```rb
require "uri"
require "json"
require "net/http"

url = URI("{{url}}")

http = Net::HTTP.new(url.host, url.port)
http.use_ssl = true

request = Net::HTTP::Post.new(url)
request["Content-Type"] = "application/json"
request.body = JSON.dump({
  "jsonrpc": "2.0",
  "method": "hl_getBlock",
  "params": ["trades", 817824084],
  "id": 1
})

response = http.request(request)
puts response.read_body
```

