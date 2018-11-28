import { Middleware } from '@marblejs/core';

import { filter } from 'rxjs/operators';
import { tap } from 'rxjs/operators';

export const apiGatewayEvent$: Middleware = (req$, res) =>
  req$.pipe (
    filter(req => !!req.headers['x-apigateway-event']),
    tap(req => req.apiGatewayEvent = 
      JSON.parse(decodeURIComponent(<string>req.headers['x-apigateway-event'])))
  );

export const apiGatewayContext$: Middleware = (req$, res) =>
  req$.pipe(
    filter(req => !!req.headers['x-apigateway-context']),
    tap(req => req.apiGatewayContext =
      JSON.parse(decodeURIComponent(<string>req.headers['x-apigateway-context'])))
  );
