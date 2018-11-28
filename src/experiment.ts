import * as Lambda from 'aws-lambda';

export let ctx: Lambda.APIGatewayEventRequestContext = <any>{ };

export const experiment = (...a: number[]) => a.reduce((acc, val) => acc + val, 0);
