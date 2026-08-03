/**
 * React hook & utility for components to expose page context to the voice
 * assistant. Every module that wants voice-aware tool execution calls
 * `useVoiceContext()` on mount to register its current entity.
 */

"use client";

import { useEffect, useCallback } from "react";
import { useVoice } from "./provider";
import type { VoiceMode } from "./types";

/**
 * Mounted by each page/module to tell the assistant what the user is looking
 * at so commands resolve to the current entity automatically.
 *
 * @example
 *   useVoiceContext({ mode: "claim", claimId: params.id, claimNumber: "CL-..." });
 */
export function useVoiceContext(ctx: {
  mode: VoiceMode;
  page?: string;
  claimId?: string;
  claimNumber?: string;
  decisionId?: string;
  documentId?: string;
  supplementId?: string;
  interviewId?: string;
  extra?: Record<string, string>;
}) {
  const { actions } = useVoice();

  useEffect(() => {
    actions.setMode(ctx.mode);
    actions.setContext({
      page: ctx.page ?? window.location.pathname,
      claimId: ctx.claimId,
      claimNumber: ctx.claimNumber,
      decisionId: ctx.decisionId,
      documentId: ctx.documentId,
      supplementId: ctx.supplementId,
      interviewId: ctx.interviewId,
      extra: ctx.extra,
    });
    // Cleanup: reset to general and drop entity ids so stale context never
    // leaks into the next page's commands.
    return () => {
      actions.setMode("general");
      actions.clearContext();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ctx.mode,
    ctx.claimId,
    ctx.claimNumber,
    ctx.decisionId,
    ctx.documentId,
    ctx.supplementId,
    ctx.interviewId,
  ]);
}
