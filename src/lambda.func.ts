import * as aws from 'aws-lambda';

import { AWSServerlessProxy } from './proxy';
import { AWSServerlessResponse } from './proxy';
import { EffectFactory } from '@marblejs/core';

import { apiGatewayContext$ } from './middleware';
import { apiGatewayEvent$ } from './middleware';
import { httpListener } from '@marblejs/core';
import { mapTo } from 'rxjs/operators';

const hello$ = EffectFactory
  .matchPath('/test/hello')
  .matchType('GET')
  .use(req$ => req$.pipe(
    mapTo({ body: 'Hello, serverless!' })
  ));

const app = httpListener({
  effects: [hello$],
  middlewares: [apiGatewayEvent$, apiGatewayContext$]
});

const proxy = new AWSServerlessProxy(app, []);

export const handler = (event: aws.APIGatewayProxyEvent,
  context: aws.Context): Promise<AWSServerlessResponse> => {
  return proxy.handle(event, context);
};
