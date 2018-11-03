// Adapted from https://github.com/apollographql/graphql-subscriptions/blob/master/src/test/tests.ts
const { isAsyncIterable } = require("iterall");
const { Client } = require("pg");

const { PostgresPubSub } = require("./postgres-pubsub");
let client;

describe("PostgresPubSub", () => {
  beforeEach(async () => {
    client = new Client();
    await client.connect();
  });

  test("PostgresPubSub can subscribe when instantiated without a client", function(done) {
    const ps = new PostgresPubSub();
    ps.subscribe("a", payload => {
      expect(payload).toEqual("test");
      done();
    }).then(() => {
      const succeed = ps.publish("a", "test");
      expect(succeed).toBe(true);
    });
  });

  test("PostgresPubSub can subscribe and is called when events happen", function(done) {
    const ps = new PostgresPubSub({ client });
    ps.subscribe("a", payload => {
      expect(payload).toEqual("test");
      done();
    }).then(() => {
      const succeed = ps.publish("a", "test");
      expect(succeed).toBe(true);
    });
  });

  test("PostgresPubSub can subscribe when instantiated with connection options but without a client", function(done) {
    const ps = new PostgresPubSub({
      connectionString: process.env.DATABASE_URL
    });
    ps.subscribe("a", payload => {
      expect(payload).toEqual("test");
      done();
    }).then(() => {
      const succeed = ps.publish("a", "test");
      expect(succeed).toBe(true);
    });
  });

  test("should send notification event after calling publish", done => {
    const ps = new PostgresPubSub({ client });
    client.on("notification", ({ payload }) => {
      expect(payload).toEqual("test");
      done();
    });
    ps.subscribe("a", payload => {
      expect(payload).toEqual("test");
    }).then(() => {
      const succeed = ps.publish("a", "test");
      expect(succeed).toBe(true);
    });
  });

  test("PostgresPubSub can unsubscribe", function(done) {
    const ps = new PostgresPubSub({ client });
    ps.subscribe("a", payload => {
      expect(false).toBe(true); // Should not reach this point
    }).then(subId => {
      ps.unsubscribe(subId);
      const succeed = ps.publish("a", "test");
      expect(succeed).toBe(true); // True because publish success is not
      // indicated by trigger having subscriptions
      done(); // works because pubsub is synchronous
    });
  });

  test("Should emit error when payload exceeds Postgres 8000 character limit", done => {
    const ps = new PostgresPubSub({ client });
    ps.subscribe("a", () => {
      expect(false).toBe(true); // Should not reach this point
      done();
    });
    ps.subscribe("error", err => {
      expect(err.message).toEqual("payload string too long");
      done();
    }).then(() => {
      const succeed = ps.publish("a", "a".repeat(9000));
      expect(succeed).toBe(true);
    });
  });

  test("AsyncIterator should expose valid asyncIterator for a specific event", () => {
    const eventName = "test";
    const ps = new PostgresPubSub({ client });
    const iterator = ps.asyncIterator(eventName);
    expect(iterator).not.toBeUndefined();
    expect(isAsyncIterable(iterator)).toBe(true);
  });

  test("AsyncIterator should trigger event on asyncIterator when published", done => {
    const eventName = "test";
    const ps = new PostgresPubSub({ client });
    const iterator = ps.asyncIterator(eventName);

    iterator.next().then(result => {
      expect(result).not.toBeUndefined();
      expect(result.value).not.toBeUndefined();
      expect(result.done).not.toBeUndefined();
      done();
    });

    ps.publish(eventName, { test: true });
  });

  test("AsyncIterator should not trigger event on asyncIterator when publishing other event", done => {
    const eventName = "test2";
    const ps = new PostgresPubSub({ client });
    const iterator = ps.asyncIterator("test");
    const spy = jest.fn();

    iterator.next().then(spy);
    ps.publish(eventName, { test: true });
    expect(spy).not.toHaveBeenCalled();
    done();
  });

  test("AsyncIterator should register to multiple events", done => {
    const eventName = "test2";
    const ps = new PostgresPubSub({ client });
    const iterator = ps.asyncIterator(["test", "test2"]);
    const spy = jest.fn();

    iterator.next().then(() => {
      spy();
      expect(spy).toHaveBeenCalled();
      done();
    });
    ps.publish(eventName, { test: true });
  });

  test("AsyncIterator transforms messages using commonMessageHandler", done => {
    const eventName = "test";
    const commonMessageHandler = message => ({ transformed: message });
    const ps = new PostgresPubSub({ client, commonMessageHandler });
    const iterator = ps.asyncIterator(eventName);

    iterator.next().then(result => {
      expect(result).not.toBeUndefined();
      expect(result.value).toEqual({ transformed: { test: true } });
      expect(result.done).toBe(false);
      done();
    });

    ps.publish(eventName, { test: true });
  });

  test("PostgresPubSub transforms messages using commonMessageHandler", function(done) {
    const commonMessageHandler = message => ({ transformed: message });
    const ps = new PostgresPubSub({ client, commonMessageHandler });
    ps.subscribe("transform", payload => {
      expect(payload).toEqual({ transformed: { test: true } });
      done();
    }).then(() => {
      const succeed = ps.publish("transform", { test: true });
      expect(succeed).toBe(true);
    });
  });

  // This test does not clean up after it ends. It breaks the test that follows after it.
  // It won't break any tests if it's the last. https://imgflip.com/i/2lmlgm
  // TODO: Fix it properly
  test("AsyncIterator should not trigger event on asyncIterator already returned", async done => {
    const eventName = "test";
    const ps = new PostgresPubSub({ client });
    const iterator = ps.asyncIterator(eventName);

    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    iterator.next().then(result => {
      expect(result).not.toBeUndefined();
      expect(result.value).not.toBeUndefined();
      expect(result.done).toBe(false);
    });

    ps.publish(eventName, { test: true });

    await delay(0);

    iterator.next().then(result => {
      expect(result).not.toBeUndefined();
      expect(result.value).toBeUndefined();
      expect(result.done).toBe(true);
      done();
    });

    await delay(0);

    iterator.return();

    ps.publish(eventName, { test: true });
  });
});
