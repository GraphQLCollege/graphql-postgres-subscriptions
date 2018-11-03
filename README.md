# graphql-postgres-subscriptions

[![Build Status](https://travis-ci.org/GraphQLCollege/graphql-postgres-subscriptions.svg?branch=master)](https://travis-ci.org/GraphQLCollege/graphql-postgres-subscriptions)

A graphql subscriptions implementation using postgres and apollo's graphql-subscriptions.

This package implements the PubSubEngine Interface from the graphql-subscriptions package and also the new AsyncIterator interface. It allows you to connect your subscriptions manger to a postgres based Pub Sub mechanism to support multiple subscription manager instances.

## Installation

`yarn add graphql-postgres-subscriptions` or `npm install graphql-postgres-subscriptions --save`

## Usage

Example app: https://github.com/GraphQLCollege/apollo-subscriptions-example

First of all, follow the instructions in [graphql-subscriptions](https://github.com/apollographql/graphql-subscriptions) to add subscriptions to your app.

Afterwards replace `PubSub` with `PostgresPubSub`:

```js
// Before
import { PubSub } from "graphql-subscriptions";

export const pubsub = new PubSub();
```

```js
// After
import { PostgresPubSub } from "graphql-postgres-subscriptions";

export const pubsub = new PostgresPubSub();
```

This library uses [`node-postgres`](https://github.com/brianc/node-postgres) to connect to PostgreSQL. If you want to customize connection options, please refer to their [connection docs](https://node-postgres.com/features/connecting).

You have three options:

If you don's send any argument to `new PostgresPubSub()`, we'll create a `postgres` client with no arguments.

You can also pass [node-postgres connection options](https://node-postgres.com/features/connecting#programmatic) to `PostgresPubSub`.

You can instantiate your own `client` and pass it to `PostgresPubSub`. Like this:

```js
import { PostgresPubSub } from "graphql-postgres-subscriptions";
import { Client } from "pg";

const client = new Client();
await client.connect();
const pubsub = new PostgresPubSub({ client });
```

**Important**: Don't pass clients from `pg`'s `Pool` to `PostgresPubSub`. As [node-postgres creator states in this StackOverflow answer](https://stackoverflow.com/questions/8484404/what-is-the-proper-way-to-use-the-node-js-postgresql-module), the client needs to be around and not shared so pg can properly handle `NOTIFY` messages (which this library uses under the hood)

### commonMessageHandler

The second argument to `new PostgresPubSub()` is the `commonMessageHandler`. The common message handler gets called with the received message from PostgreSQL.
You can transform the message before it is passed to the individual filter/resolver methods of the subscribers.
This way it is for example possible to inject one instance of a [DataLoader](https://github.com/facebook/dataloader) which can be used in all filter/resolver methods.

```javascript
const getDataLoader = () => new DataLoader(...)
const commonMessageHandler = ({attributes: {id}, data}) => ({id, dataLoader: getDataLoader()})
const pubsub = new PostgresPubSub({ client, commonMessageHandler });
```

```javascript
export const resolvers = {
  Subscription: {
    somethingChanged: {
      resolve: ({ id, dataLoader }) => dataLoader.load(id)
    }
  }
};
```

## Error handling

`PostgresPubSub` instances emit a special event called `"error"`. This event's payload is an instance of Javascript's `Error`. You can get the error's text using `error.message`.

```js
const ps = new PostgresPubSub({ client });

ps.subscribe("error", err => {
  console.log(err.message); // -> "payload string too long"
}).then(() => ps.publish("a", "a".repeat(9000)));
```

For example you can log all error messages (including stack traces and friends) using something like this:

```js
ps.subscribe("error", console.error);
```

## Development

This project has an integration test suite that uses [`jest`](https://facebook.github.io/jest/) to make sure everything works correctly.

We use Docker to spin up a PostgreSQL instance before running the tests. To run them, type the following commands:

- `docker-compose build`
- `docker-compose run test`
