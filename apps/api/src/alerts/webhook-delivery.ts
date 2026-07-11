import { Injectable } from '@nestjs/common';
import { AlertPayload, WebhookTestResult } from '@asobeast/shared';
import { formatWebhookBody } from './webhook-format';
import { deliveryHeaders } from './webhook-signature';

const TIMEOUT_MS = 10_000;

@Injectable()
export class WebhookDelivery {
  async send(
    url: string,
    secret: string | null,
    payload: AlertPayload,
  ): Promise<void> {
    const response = await this.post(url, secret, payload);
    if (!response.ok) {
      throw new Error(`Webhook ${url} responded ${response.status}`);
    }
  }

  async attempt(
    url: string,
    secret: string | null,
    payload: AlertPayload,
  ): Promise<WebhookTestResult> {
    try {
      const response = await this.post(url, secret, payload);
      return { delivered: response.ok, status: response.status };
    } catch {
      return { delivered: false, status: null };
    }
  }

  private post(
    url: string,
    secret: string | null,
    payload: AlertPayload,
  ): Promise<Response> {
    const body = formatWebhookBody(url, payload);
    return fetch(url, {
      method: 'POST',
      headers: deliveryHeaders(payload.event, body, secret),
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  }
}
