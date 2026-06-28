export class StoreUnavailableError extends Error {
  readonly name = 'StoreUnavailableError';

  constructor(message = 'D1 unavailable', options?: ErrorOptions) {
    super(message, options);
  }
}
