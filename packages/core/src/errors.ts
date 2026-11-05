export class InvalidUrlError extends Error {
  constructor(message = 'Invalid URL or unsupported scheme (only http and https).') {
    super(message);
    this.name = 'InvalidUrlError';
  }
}