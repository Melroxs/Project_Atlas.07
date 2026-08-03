// apps/web/src/lib/demo-events.ts
// Lightweight cross-component refresh bus for the demo experience. Any section
// (metrics, personas, walkthroughs, quick actions) can notify the page that
// demo data changed (generate / reset / clear / toggle), and every subscriber
// refetches its own data.

export const DEMO_CHANGED_EVENT = 'atlas:demo-changed';

export function notifyDemoChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(DEMO_CHANGED_EVENT));
}

export function subscribeDemoChanged(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(DEMO_CHANGED_EVENT, cb);
  return () => window.removeEventListener(DEMO_CHANGED_EVENT, cb);
}
