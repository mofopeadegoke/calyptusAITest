import { ordersRequest, wait } from './useOrders';

describe('ordersRequest', () => {
  test('defaults to the real export with no delay', () => {
    expect(ordersRequest('')).toEqual({ url: '/orders.json', delayMs: 0 });
  });

  test('?error=1 points at a file that does not exist', () => {
    expect(ordersRequest('?error=1').url).toBe('/orders.does-not-exist.json');
  });

  test.each([
    ['?delay=2000', 2000],
    ['?delay=99999', 10000],
    ['?delay=-5', 0],
    ['?delay=soon', 0],
  ])('%s waits %i ms', (search, delayMs) => {
    expect(ordersRequest(search).delayMs).toBe(delayMs);
  });
});

describe('wait', () => {
  test('rejects when aborted during the delay', async () => {
    const controller = new AbortController();
    const waiting = wait(10_000, controller.signal);
    controller.abort();
    await expect(waiting).rejects.toThrow();
  });

  test('rejects at once when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(wait(10_000, controller.signal)).rejects.toThrow();
  });
});
