import { useCallback, useEffect, useState } from 'react';
import { OrdersFormatError, parseOrders } from '../domain/parseOrders';
import type { LoadState, Order } from '../domain/types';

const MAX_DELAY_MS = 10_000;

export function ordersRequest(search: string): { url: string; delayMs: number } {
  const params = new URLSearchParams(search);
  const url = params.get('error') === '1' ? '/orders.does-not-exist.json' : '/orders.json';
  const delay = Number(params.get('delay'));
  const delayMs = Number.isFinite(delay) ? Math.min(MAX_DELAY_MS, Math.max(0, delay)) : 0;
  return { url, delayMs };
}

class LoadError extends Error {}

export function wait(ms: number, signal: AbortSignal): Promise<void> {
  if (ms === 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

async function loadOrders(signal: AbortSignal): Promise<Order[]> {
  const { url, delayMs } = ordersRequest(window.location.search);
  await wait(delayMs, signal);

  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new LoadError("Couldn't reach the server to load orders. Check your connection, then try again.");
  }
  if (!response.ok) {
    throw new LoadError(
      `The orders file could not be loaded (HTTP ${response.status}). Try again, and if it keeps failing check that the export has been published.`,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    if (signal.aborted) throw error;
    throw new LoadError('The orders file is not valid JSON. Re-export it from the admin, then try again.');
  }

  try {
    return parseOrders(body);
  } catch (error) {
    if (error instanceof OrdersFormatError) {
      throw new LoadError(`${error.message} Re-export it from the admin, then try again.`);
    }
    throw error;
  }
}

export function useOrders(): { state: LoadState; retry: () => void } {
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ phase: 'loading' });
    loadOrders(controller.signal).then(
      (orders) => {
        if (!controller.signal.aborted) setState({ phase: 'ready', orders });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          error instanceof LoadError ? error.message : 'Something went wrong while reading the orders. Try again.';
        setState({ phase: 'error', message });
      },
    );
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}
