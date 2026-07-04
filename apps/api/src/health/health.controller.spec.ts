import { HealthController } from './health.controller';

describe('HealthController', () => {
  const controller = new HealthController();

  it('reports ok with uptime and an ISO timestamp', () => {
    const result = controller.check();

    expect(result.status).toBe('ok');
    expect(typeof result.uptime).toBe('number');
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
    expect(result.timestamp).toBe(new Date(result.timestamp).toISOString());
  });
});
