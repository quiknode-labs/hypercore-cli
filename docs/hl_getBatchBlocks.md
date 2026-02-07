# hl_getBatchBlocks

Retrieves a batch of blocks from a specified Hyperliquid stream within a block range.

## Parameters

- **stream** (string (REQUIRED)): The stream type to query (trades, orders, events, book, twap, writer_actions)

- **from** (integer (REQUIRED)): Starting block number (inclusive)

- **to** (integer (REQUIRED)): Ending block number (inclusive)

## Returns

- **result** (object): Result payload containing the requested blocks
  - **blocks** (array): Array of block objects within the specified range
    - **block_number** (integer): Block number on the Hyperliquid chain
    - **block_time** (string): Block timestamp in ISO 8601 format
    - **local_time** (string): Local server timestamp in ISO 8601 format
    - **events** (array): List of events in this block; each event is a 2-item tuple of [address, payload]
      - **address** (string): Event address as a 0x-prefixed hex string
      - **payload** (object): Event payload data
        - **coin** (string): Instrument symbol (e.g., HYPE, BTC, SUI, XRP, xyz:HOOD, xyz:XYZ100, @198)
        - **px** (string): Execution price as a stringified number
        - **sz** (string): Execution size/quantity as a stringified number
        - **side** (string): Trade side indicator (e.g., B or A)
        - **time** (integer): Event timestamp in milliseconds since Unix epoch
        - **startPosition** (string): Position size before the event as a stringified number
        - **dir** (string): Action direction describing the position change (e.g., Open Long, Open Short, Close Long, Close Short, Buy, Sell, Long > Short, Short > Long)
        - **closedPnl** (string): Realized PnL from this event as a stringified number
        - **hash** (string): Transaction hash as a 0x-prefixed hex string
        - **oid** (integer): Order identifier
        - **crossed** (boolean): Whether the order crossed the book
        - **fee** (string): Fee amount as a stringified number (can be negative depending on rebates)
        - **feeToken** (string): Token symbol used for fees (e.g., USDC, WOULD)
        - **tid** (integer): Trade identifier
        - **twapId** (integer): TWAP identifier if the event is associated with a TWAP; otherwise null
        - **cloid** (string): Client order identifier
        - **builder** (string): Builder address as a 0x-prefixed hex string
        - **builderFee** (string): Builder fee amount as a stringified number

## Code Examples

### CURL

```sh
curl {{url}} \
  -X POST \
  -H "Content-Type: application/json" \
  --data '{
    "jsonrpc": "2.0",
    "method": "hl_getBatchBlocks",
    "params": {
      "stream": "trades",
      "from": 817824078,
      "to": 817824090
    },
    "id": 1
  }'
```

### JAVASCRIPT

```js
var myHeaders = new Headers();
myHeaders.append("Content-Type", "application/json");

var raw = JSON.stringify({
  "jsonrpc": "2.0",
  "method": "hl_getBatchBlocks",
  "params": {
    "stream": "trades",
    "from": 817824078,
    "to": 817824090
  },
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
  "method": "hl_getBatchBlocks",
  "params": {
    "stream": "trades",
    "from": 817824078,
    "to": 817824090
  },
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
  "method": "hl_getBatchBlocks",
  "params": {
    "stream": "trades",
    "from": 817824078,
    "to": 817824090
  },
  "id": 1
})

response = http.request(request)
puts response.read_body
```

