export class EntitlementRequiredError extends Error {
  constructor() {
    super('Trial expired — upgrade to keep using asobeast');
    this.name = 'EntitlementRequiredError';
  }
}
