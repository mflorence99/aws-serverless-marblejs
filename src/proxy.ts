import * as url from 'url';

import { APIGatewayProxyEvent } from 'aws-lambda';
import { ClientRequest } from 'http';
import { Context } from 'aws-lambda';
import { IncomingMessage } from 'http';
import { OutgoingMessage } from 'http';
import { RequestOptions } from 'http';
import { Server } from 'http';

import { config } from './config';
import { createServer } from 'http';
import { request } from 'http';

import chalk from 'chalk';

import binaryCase = require('binary-case');
import typeIs = require('type-is');

type Resolver = (obj) => void;

/**
 * Serverless proxy response
 */

export interface AWSServerlessResponse {
  body: string;
  headers: any;
  isBase64Encoded?: boolean;
  on?: Function;
  statusCode: number;
}

/**
 * Serverless proxy for AWS Lambda, optimized for Marble.js
 */

export class AWSServerlessProxy {

  private listening: boolean;
  private server: Server;
  private socketPath: string;

  /* ctor */
  constructor(private app: (req: IncomingMessage, res: OutgoingMessage) => void,
              private binaryMimeTypes: string[] = config.binaryMimeTypes,
              private testMode = false) { 
    this.socketPath = this.makeSocketPath();
    this.server = createServer(this.app)
      .on('close', () => {
        this.listening = false;
        console.log(this.logID(), chalk.cyanBright('closed'));
      })
      .on('error', (error: NodeJS.ErrnoException) => {
        console.log(this.logID(), chalk.redBright(error.toString()));
        if (error.code === 'EADDRINUSE') {
          console.log(this.logID(), chalk.yellowBright('see https://github.com/mflorence99/aws-serverless-marblejs/blob/master/README.md#EADDRINUSE'));
          this.socketPath = this.makeSocketPath();
          this.server.close(() => this.startServer());
        }
      })
      .on('listening', () => {
        this.listening = true;
        console.log(this.logID(), chalk.cyan('listening'));
      });
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
  handle(event: APIGatewayProxyEvent,
         context: Context): Promise<AWSServerlessResponse> {
    return new Promise<AWSServerlessResponse>((resolve, reject) => {
      if (this.listening) 
        this.sendToServer(event, context, resolve);
      else this.startServer().on('listening', () => this.sendToServer(event, context, resolve));
    });
  }

  /** Is this proxy currently listening? */
  isListening(): boolean {
    return this.listening;
  }

  // private methods

  private hackResponseHeaders(response: AWSServerlessResponse): any {
    const headers = { ...response.headers };
    // NOTE: chunked transfer not currently supported by API Gateway
    if (headers['transfer-encoding'] === 'chunked') 
      delete headers['transfer-encoding'];
    // NOTE: modifies header casing to get around API Gateway's limitation of 
    // not allowing multiple headers with the same name
    // @see https://forums.awsamazon.com/message.jspa?messageID=725953#725953
    Object.keys(headers).forEach(h => {
      if (Array.isArray(headers[h])) {
        const hdrs = <string[]>headers[h];
        if (h.toLowerCase() === 'set-cookie') {
          hdrs.forEach((value, i) => {
            headers[binaryCase(h, i + 1)] = value;
          });
          delete headers[h];
        } 
        else headers[h] = hdrs.join(',');
      }
    });
    return headers;
  }

  private logID(): string {
    return chalk.greenBright(`AWSServerlessProxy ${this.socketPath}`);
  }

  private makeClone(obj: any): any {
    return JSON.parse(JSON.stringify(obj));
  }

  private makeEventBodyBuffer(event: APIGatewayProxyEvent): Buffer {
    return Buffer.from(event.body, event.isBase64Encoded? 'base64' : 'utf8');
  }

  private makeHttpRequestOptions(event: APIGatewayProxyEvent,
                                 context: Context): RequestOptions {
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
    const method = event.httpMethod;
    const path = url.format({ pathname: event.path, query: event.queryStringParameters });
    // fabricate the options
    console.log(this.logID(), chalk.blueBright(`${method} ${path}`));
    return { 
      headers: headers,
      method: method,
      path: path,
      socketPath: this.socketPath
    };
  }

  private makeSocketPath(): string {
    const suffix = Math.random().toString(36).substring(2, 15);
    return `/tmp/server-${suffix}.sock`;
  }

  private receiveFromServer(resolve: Resolver): (response: AWSServerlessResponse) => void {
    return (response: AWSServerlessResponse) => {
      const buffer = [];
      response
        .on('data', chunk => buffer.push(chunk))
        .on('end', () => {
          const headers = this.hackResponseHeaders(response);
          const contentType = 
            headers['content-type']? headers['content-type'].split(';')[0] : '';
          const isBase64Encoded = (this.binaryMimeTypes && (this.binaryMimeTypes.length > 0)) 
            && typeIs.is(contentType, this.binaryMimeTypes);
          const body = Buffer.concat(buffer).toString(isBase64Encoded? 'base64' : 'utf8');
          const statusCode = response.statusCode;
          resolve({ body, headers, isBase64Encoded, statusCode });
        });
    };
  }

  private sendToServer(event: APIGatewayProxyEvent,
                       context: Context,
                       resolve: Resolver): void {
    try {
      const options = this.makeHttpRequestOptions(event, context);
      // NOTE: @types/node doesn't recognize this variant of http.request()
      const req = request(<any>options, <any>this.receiveFromServer(resolve))
        .on('error', (error: NodeJS.ErrnoException) => {
          console.log(this.logID(), chalk.redBright(error.toString()));
          // @see https://nodejs.org/api/http.html#http_http_request_options_callback
          resolve({ body: error.toString(), headers: { }, statusCode: 502});
        });
      this.sendToServerStress(event, req);
      if (event.body)
        req.write(this.makeEventBodyBuffer(event));
      req.end();
    }
    catch (error) {
      console.log(this.logID(), chalk.redBright(error));
      resolve({ body: error.toString(), headers: { }, statusCode: 500 });
    }
  }

  // NOTE: strictly for testing!
  private sendToServerStress(event: APIGatewayProxyEvent,
                             req: ClientRequest): void {
    if (this.testMode) {
      if (event['_snd_bomb'])
        throw new Error('send bomb');
      if (event['_rcv_bomb'])
        req.emit('error', 'Error: receive bomb');
    }
  }

  private startServer(): Server {
    return this.server.listen(this.socketPath);
  }

}
