import { APIGatewayProxyEvent } from 'aws-lambda';
import { AWSServerlessProxy } from './proxy';
import { AWSServerlessResponse } from './proxy';
import { Context } from 'aws-lambda';
import { EffectFactory } from '@marblejs/core';

import { apiGatewayContext$ } from './middleware';
import { apiGatewayEvent$ } from './middleware';
import { httpListener } from '@marblejs/core';
import { mapTo } from 'rxjs/operators';

const helloServerless$ = EffectFactory
  .matchPath('/test/hello')
  .matchType('GET')
  .use(req$ => req$.pipe(
    mapTo({ body: 'Hello, serverless!' })
  ));

const app = httpListener({
  effects: [helloServerless$],
  middlewares: [apiGatewayEvent$, apiGatewayContext$]
});

const proxy = new AWSServerlessProxy(app, []);

export const handler = (event: APIGatewayProxyEvent,
                        context: Context): Promise<AWSServerlessResponse> => {
  // NOTE: backdoor for tests
  this['_proxy'] = proxy;
  return proxy.handle(event, context);
};
