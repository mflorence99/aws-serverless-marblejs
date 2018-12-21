import * as aws from 'aws-lambda';

import { AWSServerlessProxy } from './proxy';
import { AWSServerlessResponse } from './proxy';
import { EffectFactory } from '@marblejs/core';

import { apiGatewayContext$ } from './middleware';
import { apiGatewayEvent$ } from './middleware';
import { filter } from 'rxjs/operators';
import { httpListener } from '@marblejs/core';
import { mapTo } from 'rxjs/operators';

const hello$ = EffectFactory
  .matchPath('/foo/bar')
  .matchType('GET')
  .use(req$ => req$.pipe(
    filter(req => req.apiGatewayEvent.httpMethod === 'GET'),
    filter(req => req.apiGatewayContext.awsRequestId === '0'),
    mapTo({ body: 'Hello, serverless!' })
  ));

const goodbye$ = EffectFactory
  .matchPath('/foo/bar')
  .matchType('PUT')
  .use(req$ => req$.pipe(
    filter(req => req.apiGatewayEvent.httpMethod === 'PUT'),
    filter(req => req.apiGatewayContext.awsRequestId === '0'),
    mapTo({ body: 'Goodbye, serverless!' })
  ));

const app = httpListener({ 
  effects: [hello$, goodbye$], 
  middlewares: [apiGatewayEvent$, apiGatewayContext$] 
});

const event = <aws.APIGatewayProxyEvent>{
  body: 'x=y',
  headers: {
    'this': 'that'
  },
  httpMethod: 'GET',
  isBase64Encoded: false,
  multiValueHeaders: null,
  multiValueQueryStringParameters: null,
  path: '/foo/bar',
  pathParameters: null,
  queryStringParameters: {
    'bizz': 'bazz',
    'buzz': 'bozz'
  },
  requestContext: null,
  resource: null,
  stageVariables: null,
};

const context = <aws.Context>{
  awsRequestId: '0'
};

test('ctor', () => {
  const proxy = new AWSServerlessProxy(app, ['text/css']); 
  expect(proxy.getBinaryMimeTypes()).toEqual(['text/css']);
  expect(proxy.isListening()).toBeFalsy();
});

test('static getDefaultBinaryMimeTypes', () => {
  expect(AWSServerlessProxy.getDefaultBinaryMimeTypes()).toContain('text/css');
});

test('private hackResponseHeaders', () => {
  const proxy = new AWSServerlessProxy(app); 
  const response: AWSServerlessResponse = {
    body: null,
    headers: {
      'set-cookie': ['this', 'that'],
      'transfer-encoding': 'chunked',
      'x-array': ['this', 'that']
    },
    statusCode: 0
  };
  const headers = proxy['hackResponseHeaders'](response);
  expect(headers['Set-cookie']).toEqual('this');
  expect(headers['sEt-cookie']).toEqual('that');
  expect(headers['transfer-encoding']).toBeUndefined();
  expect(headers['x-array']).toEqual('this,that');
});

test('private logID', () => {
  const proxy = new AWSServerlessProxy(app);
  expect(proxy['logID']()).toMatch(/AWSServerlessProxy .*/);
});

test('private makeClone', () => {
  const proxy = new AWSServerlessProxy(app);
  const obj = { a: 1, b: 2 };
  expect(proxy['makeClone'](obj).a).toEqual(1);
  expect(proxy['makeClone'](obj).b).toEqual(2);
});

test('private makeEventBodyBuffer', () => {
  const proxy = new AWSServerlessProxy(app); 
  expect(proxy['makeEventBodyBuffer'](event)).toEqual(Buffer.from([120, 61, 121]));
});

test('private makeHttpRequestOptions', () => {
  const proxy = new AWSServerlessProxy(app);
  const options = proxy['makeHttpRequestOptions'](event, context);
  expect(options.headers['this']).toEqual('that');
  expect(options.headers['Content-Length']).toEqual('3');
  expect(options.headers['x-apigateway-event']).not.toBeNull();
  expect(options.headers['x-apigateway-context']).toEqual('%7B%22awsRequestId%22%3A%220%22%7D');
  expect(options.path).toEqual('/foo/bar?bizz=bazz&buzz=bozz');
});

test('private makeSocketPath', () => {
  const proxy = new AWSServerlessProxy(app);
  expect(proxy['makeSocketPath']()).toMatch(/\/tmp\/server-.*\.sock/);
});

test('handler under normal conditions', async done => {
  const proxy = new AWSServerlessProxy(app);
  let response = await proxy.handle({ ...event, httpMethod: 'GET' }, context);
  expect(proxy.isListening()).toBeTruthy();
  expect(response.body).toEqual('IkhlbGxvLCBzZXJ2ZXJsZXNzISI=');
  response = await proxy.handle({ ...event, httpMethod: 'PUT' }, context);
  expect(response.body).toEqual('Ikdvb2RieWUsIHNlcnZlcmxlc3MhIg==');
  proxy.close();
  done();
});

test('handler under error conditions', async done => {
  const proxy = new AWSServerlessProxy(app, null, true);
  let bomb = { ...event };
  bomb['_snd_bomb'] = true;
  let response = await proxy.handle(bomb, context);
  expect(response.statusCode).toEqual(500);
  bomb = { ...event };
  bomb['_rcv_bomb'] = true;
  response = await proxy.handle(bomb, context);
  expect(response.statusCode).toEqual(502);
  proxy.close();
  done();
});
