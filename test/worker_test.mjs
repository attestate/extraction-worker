//@format
import { env } from "process";

import test from "ava";
import esmock from "esmock";

import { messages } from "../src/api.mjs";
import { execute, validateConfig } from "../src/worker.mjs";

test("worker's immediate execution endpoint upon invalid message", async (t) => {
  const message = {
    version: "0.0.1",
    type: "json-rpc",
    method: "eth_getTransactionReceipt",
    params: [
      "0xed14c3386aea0c5b39ffea466997ff13606eaedf03fe7f431326531f35809d1d",
    ],
  };
  const outcome = await execute(message);
  t.falsy(outcome.commissioner);
  t.truthy(outcome.error);
  t.falsy(outcome.results);
});

test("worker's immediate execution endpoint", async (t) => {
  const message = {
    options: {
      url: env.RPC_HTTP_HOST,
    },
    version: "0.0.1",
    type: "json-rpc",
    method: "eth_getTransactionReceipt",
    params: [
      "0xed14c3386aea0c5b39ffea466997ff13606eaedf03fe7f431326531f35809d1d",
    ],
  };
  const outcome = await execute(message);
  t.falsy(outcome.commissioner);
  t.truthy(outcome.results);
  t.falsy(outcome.error);
});

test("if run returns queue instance", async (t) => {
  const workerData = {
    queue: {
      options: {
        concurrent: 1,
      },
    },
  };
  const { run } = await esmock("../src/worker.mjs", null, {
    worker_threads: {
      parentPort: {
        on: () => {}, // noop
        postMessage: () => {}, // noop
      },
      workerData,
    },
  });
  const queue = run();
  t.truthy(queue.getQueue);
});

test("throw on invalidly formatted message", async (t) => {
  t.plan(2);
  const workerMock = await esmock("../src/worker.mjs", null, {
    worker_threads: {
      parentPort: {
        on: () => {}, // noop
        postMessage: (message) => {
          t.is(message.hello, "world");
          t.true(
            message.error.includes("ValidationError"),
            `Unexpected content of message.error: ${message.error}`
          );
        },
      },
      workerData: {
        queue: {
          options: {
            concurrent: 1,
          },
        },
      },
    },
  });

  const message = {
    hello: "world",
  };
  const queue = workerMock.run();
  workerMock.messageHandler(queue)(message);
});

test("call exit", async (t) => {
  t.plan(1);
  const workerMock = await esmock("../src/worker.mjs", null, {
    process: {
      exit: () => t.true(true),
    },
  });

  workerMock.messageHandler()({
    type: "exit",
    version: messages.version,
  });
});

test("validateConfig should not throw error for valid config", (t) => {
  t.notThrows(() =>
    validateConfig({
      queue: {
        options: {
          concurrent: 10,
        },
      },
    })
  );
});

test("validateConfig should throw error for invalid config", (t) => {
  t.throws(() =>
    validateConfig({
      queue: { options: "" },
    })
  );
});
