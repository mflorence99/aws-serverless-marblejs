import * as Lambda from 'aws-lambda';

import { httpListener } from '@marblejs/core';

/**
 * Dictionary service
 */

export class AWSServerlessProxy {

  /* ctor */
  constructor(private app: typeof httpListener) { }

  /** AWS Lambda handler method */
  handle(event: Lambda.APIGatewayEvent,
         context: Lambda.Context): void {
    console.log(this.app);
  }

}
