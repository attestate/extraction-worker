# @attestate/extraction-worker

The extraction-worker is a component that accepts JSON objects to execute
simple or complex extraction maneuvres. Originally, the extraction worker was
conceived as utility tool for `@neume-network/extraction-worker`, but it is
frankly useful for any kind of task that requires downloading a bigger chunk of
data from various endpoints.

The extraction worker supports: JSON-RPC, GraphQL, HTTPS, Arweave and IPFS.

## Installation

```bash
npm i @attestate/extraction-worker
npm i eth-fun --no-save # to install eth-fun as a peer dependency
```

## Usage

If you're looking to extract a single message, use the `execute` function.

```js
import { execute } from "@attestate/extraction-worker";

const message = {
  version: "0.0.1",
  type: "json-rpc",
  method: "eth_getTransactionReceipt",
  params: [
    "0xed14c3386aea0c5b39ffea466997ff13606eaedf03fe7f431326531f35809d1d",
  ],
};

const outcome = await execute(message);

if (!outcome.results) {
  console.error(outcome.error);
  return;
}
console.log(outcome.results);
```

Else, you can use the extraction worker to stream tasks. For that, you'll need
to create a worker execution module

worker_start.mjs

```js
import "dotenv/config";
import { Worker, isMainThread, workerData } from "worker_threads";

import logger from "./logger.mjs";
import { run } from "@attestate/extraction-worker";

const log = logger("start");
const module = {
  defaults: {
    workerData: {
      queue: {
        options: {
          concurrent: 1,
        },
      },
    },
  },
};

if (isMainThread) {
  log("Detected mainthread: Respawning extractor as worker_thread");
  // INFO: We're launching this file as a `Worker` when the mainthread is
  // detected as this can be useful when running it without an accompanying
  // other process.
  new Worker(__filename, { workerData: module.defaults.workerData });
} else {
  run();
}
```

You can then execute it as follows

```js
import { once } from "events";
import { Worker } from "worker_threads";

const worker = new Worker(workerPath, {
  workerData: {
    queue: {
      options: {
        concurrent: 1,
      },
    },
  },
});

const message = {
  version: "0.0.1",
  type: "json-rpc",
  method: "eth_getTransactionReceipt",
  params: [
    "0xed14c3386aea0c5b39ffea466997ff13606eaedf03fe7f431326531f35809d1d",
  ],
};
worker.postMessage(message);
const [outcome] = await once(w, "message");

if (!outcome.results) {
  console.error(outcome.error);
  return;
}
console.log(outcome.results);
```

## License

GPL-3.0-only, see LICENSE file for details.
