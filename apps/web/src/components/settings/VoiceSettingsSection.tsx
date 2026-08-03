'use client';

// apps/web/src/components/settings/VoiceSettingsSection.tsx
// Voice configuration for the Atlas Voice Orchestration Engine.
// Preferences are stored client-side (per browser) so they survive
// navigation and reloads; they are read by the global floating assistant.

import { useVoice } from '@project-atlas/voice';

const VOICE_PRESETS = [
  { label: 'Default', value: '' },
  { label: 'Female (EN)', value: 'en-female' },
  { label: 'Male (EN)', value: 'en-male' },
];

const LANGUAGES = [
  { label: 'English (US)', value: 'en-US' },
  { label: 'English (UK)', value: 'en-GB' },
  { label: 'Spanish', value: 'es-ES' },
  { label: 'French', value: 'fr-FR' },
  { label: 'German', value: 'de-DE' },
];

const TOGGLES: Array<{
  key: 'wakeWord' | 'autoListen' | 'pushToTalk' | 'continuous';
  label: string;
  hint: string;
}> = [
  { key: 'wakeWord', label: 'Wake word ("Atlas")', hint: 'Start hands-free by saying "Atlas"' },
  { key: 'autoListen', label: 'Auto-listen', hint: 'Restart listening after each response' },
  { key: 'pushToTalk', label: 'Push-to-talk', hint: 'Hold Spacebar / mic button to talk' },
  { key: 'continuous', label: 'Continuous conversation', hint: 'Keep the mic hot between turns' },
];

export default function VoiceSettingsSection() {
  const { state, actions } = useVoice();
  const prefs = state.preferences;

  const setPref = (key: keyof typeof prefs, value: boolean | string | number) => {
    actions.updatePreferences({ [key]: value } as Partial<typeof prefs>);
  };

  return (
    <div className="bg-surface rounded-lg border p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Voice Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure the Atlas Voice Orchestration Engine — applied instantly to the floating assistant.
          </p>
        </div>
        <span className="text-2xl" aria-hidden>🎙️</span>
      </div>

      <div className="space-y-5">
        {/* Voice preset */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Voice</label>
          <div className="flex flex-wrap gap-2">
            {VOICE_PRESETS.map((v) => (
              <button
                key={v.value}
                type="button"
                onClick={() => setPref('voice', v.value)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  prefs.voice === v.value
                    ? 'border-primary text-primary bg-primary/10'
                    : 'border-input text-muted-foreground hover:border-primary'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Language</label>
          <select
            value={prefs.language}
            onChange={(e) => setPref('language', e.target.value)}
            className="w-full px-3 py-2 bg-muted dark:bg-card border border-input rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>

        {/* Speed / Pitch / Volume */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="flex justify-between text-sm font-medium text-foreground mb-1">
              <span>Speed</span>
              <span className="text-muted-foreground">{prefs.rate.toFixed(2)}×</span>
            </div>
            <input
              type="range" min={0.5} max={2} step={0.05} value={prefs.rate}
              onChange={(e) => setPref('rate', Number(e.target.value))}
              className="w-full accent-primary"
              aria-label="Speech speed"
            />
          </div>
          <div>
            <div className="flex justify-between text-sm font-medium text-foreground mb-1">
              <span>Pitch</span>
              <span className="text-muted-foreground">{prefs.pitch.toFixed(2)}</span>
            </div>
            <input
              type="range" min={0} max={2} step={0.1} value={prefs.pitch}
              onChange={(e) => setPref('pitch', Number(e.target.value))}
              className="w-full accent-primary"
              aria-label="Speech pitch"
            />
          </div>
          <div>
            <div className="flex justify-between text-sm font-medium text-foreground mb-1">
              <span>Volume</span>
              <span className="text-muted-foreground">{Math.round(prefs.volume * 100)}%</span>
            </div>
            <input
              type="range" min={0} max={1} step={0.05} value={prefs.volume}
              onChange={(e) => setPref('volume', Number(e.target.value))}
              className="w-full accent-primary"
              aria-label="Output volume"
            />
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-3">
          {TOGGLES.map(({ key, label, hint }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">{label}</div>
                <div className="text-sm text-muted-foreground">{hint}</div>
              </div>
              <button
                type="button"
                onClick={() => setPref(key, !prefs[key])}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${prefs[key] ? "bg-blue-600" : "bg-gray-300"}`}
                aria-pressed={Boolean(prefs[key])}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-surface transition-transform ${prefs[key] ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>
          ))}
        </div>

        {/* Reset */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => actions.resetPreferences()}
            className="px-4 py-2 text-sm text-muted-foreground border border-input rounded-lg hover:border-destructive hover:text-destructive transition-colors"
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  );
}
