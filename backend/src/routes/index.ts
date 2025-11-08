import { Response, Router } from "express";
import pointRouter from './point';
const router = Router({
  caseSensitive : true,
  strict        : true
});

router.use('/points', pointRouter);

export enum StatusCode {
  OK = 200,
  CREATED = 201,
  UPDATED = 202,
  DELETED = 203,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  INTERNAL_SERVER_ERROR = 500,
}

class Packet {
  public message : string;
  public data? : unknown;
  public status_code : StatusCode;
  public timestamp : string;

  constructor(message : string, status_code : StatusCode, data? : unknown) {
    this.message = message;
    this.data = data;
    this.status_code = status_code;
    this.timestamp = new Date().toISOString();
  }
}

export class OKPacket extends Packet {
  constructor(message : string, data? : unknown) {
    super(message, StatusCode.OK, data);
  }
}

export class NoDataPacket extends Packet {
  constructor(message : string, status_code : StatusCode) {
    super(message, status_code);
  }
}

export class ErrorPacket extends Packet {
  constructor(message : string, status_code : StatusCode) {
    super(message, status_code);
  }
}


export function sendPacket(packet : Packet, res : Response) {
  res.status(packet.status_code).send(packet);
}

export function isString(value : unknown) : boolean {
  return typeof value === 'string' || value instanceof String;
}

export function isNumber(value : unknown) : boolean {
  return typeof value === 'number' && isFinite(value);
}

export default router;