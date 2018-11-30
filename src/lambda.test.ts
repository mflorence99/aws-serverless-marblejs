const apiGatewayEvent = require('lambda-local/examples/event_apigateway');
const handler = require('./lambda.func.ts');
const lambdaLocal = require('lambda-local');

test('lambda local 200', async () => {
  expect.assertions(2);
  const response = await lambdaLocal.execute({
    event: apiGatewayEvent,
    lambdaFunc: handler,
    lambdaHandler: 'handler',
    profilePath: '~/.aws/credentials',
    profileName: 'default',
    verboseLevel: 0
  });
  expect(response.body).toEqual('"Hello, serverless!"');
  expect(response.statusCode).toEqual(200);
});

test('lambda local 404', async () => {
  expect.assertions(1);
  const response = await lambdaLocal.execute({
    event: { ...apiGatewayEvent, path: '/xxx' },
    lambdaFunc: handler,
    lambdaHandler: 'handler',
    profilePath: '~/.aws/credentials',
    profileName: 'default',
    verboseLevel: 0
  });
  expect(response.statusCode).toEqual(404);
});
