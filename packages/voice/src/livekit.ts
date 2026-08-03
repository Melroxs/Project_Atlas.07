/**
 * LiveKit realtime transport.
 *
 * The ONLY module in the codebase that talks to LiveKit. The room token is
 * minted server-side by `/api/voice/token` (LIVEKIT_API_KEY/SECRET never
 * touch the browser). If LiveKit isn't configured or the room has no agent,
 * the engine automatically falls back to the browser tier.
 */

type LiveKitRoomLike = {
  connect(url: string, token: string): Promise<void>;
  disconnect(): void;
  localParticipant: {
    setMicrophoneEnabled(enabled: boolean): Promise<boolean>;
    isMicrophoneEnabled: boolean;
  };
  on(event: string, cb: (...args: unknown[]) => void): void;
  off(event: string, cb: (...args: unknown[]) => void): void;
  remoteAudioTracks: Map<string, unknown>;
};

export interface LiveKitHandlers {
  onConnected(): void;
  onDisconnected(): void;
  onAgentAudio(): void;
  onError(message: string): void;
}

export class LiveKitVoiceTransport {
  private room: LiveKitRoomLike | null = null;
  private handlers: LiveKitHandlers | null = null;
  private agentTrackSubscribed = false;

  constructor(private apiBase: string) {}

  /**
   * Attempt to join the Atlas voice room. Resolves 'connected' when the
   * room is joined and mic is publishing, 'unavailable' otherwise.
   */
  async connect(handlers: LiveKitHandlers): Promise<"connected" | "unavailable"> {
    this.handlers = handlers;
    try {
      const { Room, RoomEvent } = await import("livekit-client");

      const tokenRes = await fetch(`${this.apiBase}/api/voice/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!tokenRes.ok) return "unavailable";
      const { url, token } = await tokenRes.json();
      if (!url || !token) return "unavailable";

      const room = new Room({ adaptiveStream: true, dynacast: true });
      this.room = room as unknown as LiveKitRoomLike;

      room.on(RoomEvent.Connected, () => {
        handlers.onConnected();
      });
      room.on(RoomEvent.Disconnected, () => {
        this.agentTrackSubscribed = false;
        handlers.onDisconnected();
      });
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track && (track as { kind?: string }).kind === "audio") {
          this.agentTrackSubscribed = true;
          handlers.onAgentAudio();
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (
          track &&
          (track as { kind?: string }).kind === "audio"
        ) {
          this.agentTrackSubscribed = false;
        }
      });

      await room.connect(url, token);
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
      } catch {
        /* no mic — browser tier still works */
      }
      return "connected";
    } catch (error) {
      handlers.onError(
        error instanceof Error ? error.message : "LiveKit connection failed"
      );
      return "unavailable";
    }
  }

  /** True when a remote (agent) audio track is being received. */
  hasAgentAudio(): boolean {
    return this.agentTrackSubscribed;
  }

  async setMuted(muted: boolean): Promise<void> {
    try {
      await this.room?.localParticipant.setMicrophoneEnabled(!muted);
    } catch {
      /* noop */
    }
  }

  disconnect() {
    try {
      this.room?.disconnect();
    } catch {
      /* noop */
    }
    this.room = null;
  }

  get connected(): boolean {
    return Boolean(this.room);
  }
}
