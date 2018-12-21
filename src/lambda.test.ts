import * as path from 'path';

const apiGatewayEvent = require('lambda-local/examples/event_apigateway');
const handler = require('./lambda.func.ts');
const lambdaLocal = require('lambda-local');

test('lambda local 200', async done => {
  const response = await lambdaLocal.execute({
    event: apiGatewayEvent,
    lambdaFunc: handler,
    lambdaHandler: 'handler',
    profilePath: path.join(__dirname, '..', 'credentials'),
    profileName: 'default',
    verboseLevel: 0
  });
  expect(response.body).toEqual('"Hello, serverless!"');
  expect(response.statusCode).toEqual(200);
  done();
});

test('lambda local 404', async done => {
  const response = await lambdaLocal.execute({
    event: { ...apiGatewayEvent, path: '/xxx' },
    lambdaFunc: handler,
    lambdaHandler: 'handler',
    profilePath: path.join(__dirname, '..', 'credentials'),
    profileName: 'default',
    verboseLevel: 0
  });
  expect(response.statusCode).toEqual(404);
  done();
});

afterAll(() => {
  handler['_proxy'].close();
});
