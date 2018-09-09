const { PubSub } = require("graphql-subscriptions");
const pgIPC = require("pg-ipc");
const { Client } = require("pg");
const {
  eventEmitterAsyncIterator
} = require("./event-emitter-to-async-iterator");

class PostgresPubSub extends PubSub {
  constructor(options = {}) {
    super();
    this.client = options.client || new Client(options);
    if (!options.client) {
      this.client.connect();
    }
    this.ee = new pgIPC(this.client);
    this.subscriptions = {};
    this.subIdCounter = 0;
  }
  publish(triggerName, payload) {
    const encodedPayload = payload != null && typeof payload !== "string" ? JSON.stringify(payload) : payload;

    if (encodedPayload != null && encodedPayload.length > 8000) {
      console.warn("payload is to large to send over postgres");
      return false;
    }

    this.ee.notify(triggerName, payload);
    return true;
  }
  subscribe(triggerName, onMessage) {
    const callback = ({ payload }) => onMessage(payload);
    this.ee.on(triggerName, callback);
    this.subIdCounter = this.subIdCounter + 1;
    this.subscriptions[this.subIdCounter] = [triggerName, callback];
    return Promise.resolve(this.subIdCounter);
  }
  unsubscribe(subId) {
    const [triggerName, onMessage] = this.subscriptions[subId];
    delete this.subscriptions[subId];
    this.ee.removeListener(triggerName, onMessage);
  }
  asyncIterator(triggers) {
    return eventEmitterAsyncIterator(this.ee, triggers);
  }
}

module.exports = { PostgresPubSub };
