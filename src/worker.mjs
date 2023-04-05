//@format
import { workerData, parentPort } from "worker_threads";
import { exit } from "process";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { config as configSchema } from "@neume-network/schema";
import fastq from "fastq";

import logger from "./logger.mjs";
import { messages } from "./api.mjs";
import { endpointStore, populateEndpointStore } from "./endpoint_store.mjs";

const log = logger("worker");

export function panic(error, message) {
  log(
    `Panic in queue with task "${JSON.stringify(
      message
    )}", error "${error.toString()}"`
  );
  message.error = error.toString();
  if (message) {
    return message;
  } else {
    throw new Error(
      "WARNING: Error isn't propagated outside of extration worker"
    );
  }
}

let finished = 0;
let errors = 0;
export async function process(queue, message) {
  try {
    messages.validate(message);
  } catch (error) {
    return panic(error, message);
  }

  if (message.type === "exit") {
    log(`Received exit signal; shutting down`);
    exit(0);
  } else {
    let result;
    try {
      result = await queue.push(message);
      if (result.error) {
        errors++;
      } else {
        finished++;
      }
      log(`Success: ${finished} Errors: ${errors}`);
    } catch (error) {
      errors++;
      log(`Success: ${finished} Errors: ${errors}`);
      return panic(error, message);
    }
    return result;
  }
}

export function messageHandler(queue) {
  return async (message) => {
    const result = await process(queue, message);
    if (!result) {
      log(
        "Result in messageHandler came back falsy and won't be sent back to the host process"
      );
      return;
    }
    parentPort.postMessage(result);
  };
}

export function validateConfig(config) {
  const ajv = new Ajv();
  addFormats(ajv);
  const check = ajv.compile(configSchema);
  const valid = check(config);
  if (!valid) {
    log(check.errors);
    throw new Error("Received invalid config");
  }
}

export async function execute(message, concurrency = 1) {
  // NOTE: For legacy reasons, for every message posted to the worker, it
  // requires a "commissioner" value, such that routing it in the
  // `@attestate/crawler` is possible to its respective origin strategy. But
  // messages passed into `execute()` don't need the property and so we're
  // mocking it here for processing and remove it afterwards.
  message.commissioner = "dummy value";
  const queue = fastq.promise(messages.route, concurrency);
  const result = await process(queue, message);
  delete result.commissioner;
  return result;
}

export function run() {
  validateConfig(workerData);
  log(
    `Starting as worker thread with queue options: "${JSON.stringify(
      workerData
    )}"`
  );
  if (workerData.endpoints) {
    populateEndpointStore(endpointStore, workerData.endpoints);
  }
  const queue = fastq.promise(
    messages.route,
    workerData.queue.options.concurrent
  );
  parentPort.on("message", messageHandler(queue));
  return queue;
}
