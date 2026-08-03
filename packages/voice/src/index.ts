export { VoiceEngine, ToolRegistry } from "./client";
export { VoiceProvider, useVoice } from "./provider";
export { useVoiceContext } from "./hooks";
export { parseCommand } from "./commands";
export { shouldReduceMotion, detectWakeWord, stripWakeWord } from "./speech";

export type {
  VoiceTier,
  VoiceStatus,
  VoiceMode,
  VoiceConfig,
  VoiceMessage,
  TranscriptSegment,
  VoiceContext as VoicePageContext,
  ToolContext,
  ToolDefinition,
  ToolResult,
  VoiceActions,
  EngineState,
  EngineEvent,
} from "./types";
