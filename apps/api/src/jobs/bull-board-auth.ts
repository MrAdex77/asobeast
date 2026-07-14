import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const sha256 = (value: string): Buffer =>
  createHash('sha256').update(value).digest();

const matches = (provided: string, expected: string): boolean =>
  timingSafeEqual(sha256(provided), sha256(expected));

function parseBasic(header: string): [string, string] | null {
  const [scheme, encoded] = header.split(' ');
  if (scheme !== 'Basic' || !encoded) {
    return null;
  }
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const separator = decoded.indexOf(':');
  if (separator === -1) {
    return null;
  }
  return [decoded.slice(0, separator), decoded.slice(separator + 1)];
}

export function bullBoardAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const user = process.env.BULL_BOARD_USER;
  const password = process.env.BULL_BOARD_PASSWORD;
  if (!user || !password) {
    next();
    return;
  }

  const credentials = parseBasic(req.headers.authorization ?? '');
  if (
    credentials &&
    matches(credentials[0], user) &&
    matches(credentials[1], password)
  ) {
    next();
    return;
  }

  res
    .status(401)
    .set('WWW-Authenticate', 'Basic realm="asobeast"')
    .send('Authentication required');
}
