'use client';

// apps/web/src/lib/data-events.ts
// Live dashboard synchronization. The demo experience already broadcasts
// "demo changed" events whenever data is generated, reset, cleared or mutated
// by the Full Demo / live walkthroughs. This module re-exports that bus under
// a neutral name and provides useLiveRefresh() so ANY admin page can react to
// data changes in real time — without a refresh.

import { useEffect, useRef } from 'react';
import { subscribeDemoChanged, notifyDemoChanged } from './demo-events';

export const subscribeDataChanged = subscribeDemoChanged;
export const notifyDataChanged = notifyDemoChanged;

/**
 * Refetch whenever demo data changes (generate / reset / clear / run-step),
 * or when the window regains focus / becomes visible. The passed refetch is
 * kept in a ref so pages can pass a stable function without re-subscribing.
 */
export function useLiveRefresh(refetch: () => void | Promise<void>): void {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    const run = () => {
      void refetchRef.current();
    };
    const unsubscribe = subscribeDataChanged(run);
    const onFocus = () => run();
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      unsubscribe();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
}
