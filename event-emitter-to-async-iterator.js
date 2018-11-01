// Based on https://github.com/apollographql/graphql-subscriptions/blob/master/src/event-emitter-to-async-iterator.ts
const { $$asyncIterator } = require("iterall");
const { EventEmitter } = require("events");

function eventEmitterAsyncIterator(eventEmitter, eventsNames, commonMessageHandler = message => message) {
  const pullQueue = [];
  const pushQueue = [];
  const eventsArray =
    typeof eventsNames === "string" ? [eventsNames] : eventsNames;
  let listening = true;

  const pushValue = ({ payload: event }) => {
    const value = commonMessageHandler(event);
    if (pullQueue.length !== 0) {
      pullQueue.shift()({ value, done: false });
    } else {
      pushQueue.push(value);
    }
  };

  const pullValue = () => {
    return new Promise(resolve => {
      if (pushQueue.length !== 0) {
        resolve({ value: pushQueue.shift(), done: false });
      } else {
        pullQueue.push(resolve);
      }
    });
  };

  const emptyQueue = () => {
    if (listening) {
      listening = false;
      removeEventListeners();
      pullQueue.forEach(resolve => resolve({ value: undefined, done: true }));
      pullQueue.length = 0;
      pushQueue.length = 0;
    }
  };

  const addEventListeners = () => {
    for (const eventName of eventsArray) {
      eventEmitter.addListener(eventName, pushValue);
    }
  };

  const removeEventListeners = () => {
    for (const eventName of eventsArray) {
      eventEmitter.removeListener(eventName, pushValue);
    }
  };

  addEventListeners();

  return {
    next() {
      return listening ? pullValue() : this.return();
    },
    return() {
      emptyQueue();

      return Promise.resolve({ value: undefined, done: true });
    },
    throw(error) {
      emptyQueue();

      return Promise.reject(error);
    },
    [$$asyncIterator]() {
      return this;
    }
  };
}

module.exports = {
  eventEmitterAsyncIterator
};
