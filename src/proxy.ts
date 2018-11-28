import * as aws from 'aws-lambda';
import * as http from 'http';
import * as url from 'url';

import { config } from './config';

/**
 * Serverless proxy for AWS Lambda, optimized for Marble.js
 */

export interface AWSServerlessResponse {
  body: string;
  headers: any;
  isBase64Encoded: boolean;
  statusCode: number;
}

/**
 * Serverless proxy for AWS Lambda, optimized for Marble.js
 */

export class AWSServerlessProxy {

  private listening: boolean;
  private server: http.Server;
  private socketPath: string;

  /* ctor */
  constructor(private app: (req: http.IncomingMessage, res: http.OutgoingMessage) => void,
              private binaryMimeTypes: string[] = config.binaryMimeTypes) { 
    this.socketPath = this.makeSocketPath();
    this.server = http.createServer(this.app)
      .on('close', () => this.listening = false)
      .on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          console.warn(`WARNING: Attempting to listen on socket ${this.socketPath}, but it is already in use. This is likely as a result of a previous invocation error or timeout. Check the logs for the invocation(s) immediately prior to this for root cause, and consider increasing the timeout and/or cpu/memory allocation if this is purely as a result of a timeout. aws-serverless-marblejs will restart the Node.js server listening on a new port and continue with this request.`);
          this.socketPath = this.makeSocketPath();
          this.server.close(() => this.startServer());
        }
        else console.error(error);
      })
      .on('listening', () => this.listening = true);
  }

  /** Access the default binary mime types */
  static getDefaultBinaryMimeTypes(): string[] {
    return config.binaryMimeTypes;
  }

  /** Stop the proxy server (used in testing) */
  close(): void {
    this.server.close();
  }

  /** Access the defined binary MIME types */
  getBinaryMimeTypes(): string[] {
    return this.binaryMimeTypes;
  }

  /** AWS Lambda handler method */
  handle(event: aws.APIGatewayProxyEvent,
         context: aws.Context): Promise<AWSServerlessResponse> {
    return new Promise<AWSServerlessResponse>((resolve, reject) => {
      if (this.listening) {
        this.sendToServer(event, context)
          .then((response: AWSServerlessResponse) => resolve(response));
      }
      else {
        this.startServer().on('listening', () => {
          this.sendToServer(event, context)
            .then((response: AWSServerlessResponse) => resolve(response));
        });
      }
    });
  }

  /** Is this proxy currently listening? */
  isListening(): boolean {
    return this.listening;
  }

  // private methods

  private makeClone(obj: any): any {
    return JSON.parse(JSON.stringify(obj));
  }

  private makeEventBodyBuffer(event: aws.APIGatewayProxyEvent): Buffer {
    return Buffer.from(event.body, event.isBase64Encoded? 'base64' : 'utf8');
  }

  private makeHttpRequestOptions(event: aws.APIGatewayProxyEvent,
                                 context: aws.Context): http.RequestOptions {
    const headers = { ...event.headers };
    // NOTE: API Gateway may not set Content-Length
    if (event.body && !headers['Content-Length']) {
      const body = this.makeEventBodyBuffer(event);
      headers['Content-Length'] = String(Buffer.byteLength(body));
    }
    const clonedEvent = this.makeClone(event);
    // we don't want the body here
    delete clonedEvent.body;
    // NOTE: all this prepares for the middleware
    headers['x-apigateway-event'] = encodeURIComponent(JSON.stringify(clonedEvent));
    headers['x-apigateway-context'] = encodeURIComponent(JSON.stringify(context));
    // fabricate the options
    return { 
      headers: headers,
      method: event.httpMethod,
      path: url.format({ pathname: event.path, query: event.queryStringParameters }),
      socketPath: this.socketPath
    };
  }

  private makeResponse(statusCode: number,
                       body = '',
                       headers = { },
                       isBase64Encoded = false): AWSServerlessResponse {
    return { body, headers, isBase64Encoded, statusCode };
  }

  private makeSocketPath(): string {
    const suffix = Math.random().toString(36).substring(2, 15);
    return `/tmp/server-${suffix}.sock`;
  }

  private sendToServer(event: aws.APIGatewayProxyEvent,
                       context: aws.Context): Promise<AWSServerlessResponse> {
    return new Promise<AWSServerlessResponse>((resolve, reject) => {
      try {
        const options = this.makeHttpRequestOptions(event, context);
        // NOTE: @types/node doesn't recognize this variant of http.request()
        const request = http.request(<any>options, response => {
          const buffer = [];
          response
            .on('data', chunk => buffer.push(chunk))
            .on('end', () => {
              const isBase64Encoded = false;
              const body = Buffer.concat(buffer).toString(isBase64Encoded? 'base64' : 'utf8');
              const headers = response.headers;
              const statusCode = response.statusCode;
              resolve(this.makeResponse(statusCode, body, headers, isBase64Encoded));
            });
        });
        request.on('error', (error: NodeJS.ErrnoException) => {
          console.error(error);
          // @see https://nodejs.org/api/http.html#http_http_request_options_callback
          resolve(this.makeResponse(502));
        });
        if (event.body)
          request.write(this.makeEventBodyBuffer(event));
        request.end();
      }
      catch (error) {
        console.error(error);
        resolve(this.makeResponse(500));
      }
    });
  }

  private startServer(): http.Server {
    return this.server.listen(this.socketPath);
  }

}
