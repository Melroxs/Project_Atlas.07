// apps/web/src/lib/voice-analytics.ts
// Lightweight client-side voice analytics reporter. Fire-and-forget POSTs to
// the authenticated /api/voice/analytics route; failures are silently ignored
// so analytics never degrades the voice experience.

export interface VoiceAnalyticsEvent {
  type: string;
  command?: string;
  latencyMs?: number;
  ok?: boolean;
  detail?: string;
}

let enabled = true;
let queue: VoiceAnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function setVoiceAnalyticsEnabled(value: boolean): void {
  enabled = value;
}

export function trackVoiceAnalytics(event: VoiceAnalyticsEvent): void {
  if (!enabled) return;
  queue.push(event);
  if (queue.length >= 10) {
    flushVoiceAnalytics();
    return;
  }
  if (!flushTimer) {
    flushTimer = setTimeout(flushVoiceAnalytics, 4000);
  }
}

export async function flushVoiceAnalytics(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  try {
    await fetch('/api/voice/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
  } catch {
    // Analytics is best-effort — never throw.
  }
}
