# AWS Serverless Marble.js

[![Build Status](https://travis-ci.org/mflorence99/aws-serverless-marblejs.svg?branch=master)](https://travis-ci.org/mflorence99/aws-serverless-marblejs) 
[![Jest Coverage](./coverage.svg)]()
[![npm](https://img.shields.io/npm/v/aws-serverless-marblejs.svg)]()
[![node](https://img.shields.io/badge/node-8.10-blue.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Run serverless applications and REST APIs using the [Marble.js](https://github.com/marblejs/marble) application framework, on top of [AWS Lambda](https://aws.amazon.com/lambda/) and the [Amazon API Gateway](https://aws.amazon.com/api-gateway/).

> NOTE: a separate repo containing a starter serverless [Marble.js](https://github.com/marblejs/marble) application will be published shortly.

Of course, I could only have built this library by standing on the shoulders of giants, in this case the team of contributors behind [AWS Serverless Express](https://github.com/awslabs/aws-serverless-express). I leveraged their considerable experience and knowledge by following their code. The liberties I have taken have been for the sake of accommodating [Marble.js](https://github.com/marblejs/marble) on the one hand and providing type safety via a TypeScript implementation on the other.

<!-- toc -->

- [Installation](#installation)
- [Marble.js Serverless Application](#marblejs-serverless-application)
- [Middleware](#middleware)
- [`AWSServerlessProxy` Class](#awsserverlessproxy-class)
- [`EADDRINUSE`](#eaddrinuse)
- [How to Run Tests](#how-to-run-tests)

<!-- tocstop -->

## Installation

```sh
npm install ---save aws-serverless-marblejs
```

## Marble.js Serverless Application

Of course, a real-life application will be factored very differently, but this sample shows the basics.

```ts
import * as aws from 'aws-lambda';

import { AWSServerlessProxy } from 'aws-serverless-marblejs';
import { AWSServerlessResponse } from 'aws-serverless-marblejs';
import { EffectFactory } from '@marblejs/core';

import { apiGatewayContext$ } from 'aws-serverless-marblejs';
import { apiGatewayEvent$ } from 'aws-serverless-marblejs';
import { httpListener } from '@marblejs/core';
import { mapTo } from 'rxjs/operators';

const helloServerless$ = EffectFactory
  .matchPath('/')
  .matchType('GET')
  .use(req$ => req$.pipe(
    mapTo({ body: 'Hello, Serverless!' })
  ));

const app = httpListener({
  effects: [helloServerless$],
  middlewares: [apiGatewayEvent$, apiGatewayContext$]
});

const proxy = new AWSServerlessProxy(app);

export const handler = (event: aws.APIGatewayProxyEvent,
                        context: aws.Context): Promise<AWSServerlessResponse> => {
  return proxy.handle(event, context);
};
```

## Middleware

The optional middleware shown in the above example simply attaches the original source `event` and (separately) `context` objects to the Marble.js `HttpRequest`, adding these additional properties:

* `apiGatewayEvent`
* `apiGatewayContext`

## `AWSServerlessProxy` Class

The `AWSServerlessProxy` constructor optionally accepts an array of MIME types to be treated as binary. If omitted, the following are assumed by default:

```ts
binaryMimeTypes = [
  'application/javascript',
  'application/json',
  'application/octet-stream',
  'application/xml',
  'font/eot',
  'font/opentype',
  'font/otf',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/svg+xml',
  'text/comma-separated-values',
  'text/css',
  'text/html',
  'text/javascript',
  'text/plain',
  'text/text',
  'text/xml'
];
```

> NOTE: If you get ERR_CONTENT_DECODING_FAILED in your browser, this is likely due to a compressed response (eg: gzip) which has not been handled correctly by AWS Serverless Marble.js and/or the Amazon API Gateway. In this case, supply your own list to `AWSServerlessProxy`.

If `null` or an empty list is provided, no MIME types are considered binary.

If you need to augment the default list, use the `AWSServerlessProxy.getDefaultBinaryMimeTypes()` API. For example:

```ts
const binaryMimeTypes = [
  ...AWSServerlessProxy.getDefaultBinaryMimeTypes(), 
  'application/pdf'
];
const proxy = new AWSServerlessProxy(app, binaryMimeTypes);
```

## <a name="EADDRINUSE">`EADDRINUSE`</a>

Following the lead of [AWS Serverless Express](https://github.com/awslabs/aws-serverless-express), `AWSServerlessProxy` may throw an `EADDRINUSE` error due to an attempt to listen to a socket that is already in use.

This is likely as a result of a previous invocation error or timeout. Check the logs for the invocation(s) immediately prior to this for the root cause and consider increasing the timeout and/or cpu/memory allocation if this is purely as a result of a timeout. 

`AWSServerlessProxy` will restart the server listening on a new socket and continue with this request.

## How to Run Tests

Pretty decent unit test coverage is provided by [Jest](https://jestjs.io/docs/en/api). Additional tests simulate the [AWS Lambda](https://aws.amazon.com/lambda/) environment using [lambda-local](https://github.com/ashiina/lambda-local). To run the tests:

```sh
git clone git@github.com:mflorence99/aws-serverless-marblejs.git
cd aws-serverless-marblejs

npm install

// run all tests:
npm run test

// lint, test and build:
npm run build
```
