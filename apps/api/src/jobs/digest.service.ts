import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AlertsDispatcher } from '../alerts/alerts.dispatcher';
import { AnalyticsService } from '../analytics/analytics.service';
import { Env } from '../config/env';

@Injectable()
export class DigestService {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly alerts: AlertsDispatcher,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async run(): Promise<void> {
    const reviewScoreMax = this.config.get('ALERT_REVIEW_SCORE_MAX', {
      infer: true,
    });
    const payload = await this.analytics.buildDigest(reviewScoreMax);
    if (payload.apps.length === 0) {
      return;
    }
    await this.alerts.dispatch(payload);
  }
}
