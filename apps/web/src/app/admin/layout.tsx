'use client';

import { ReactNode, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import TopNavigation from '@/components/TopNavigation';
import { VoiceProvider, useVoice } from '@project-atlas/voice';
import { ATLAS_VOICE_TOOLS } from '@/lib/register-voice-tools';
import AtlasAssistant from '@/components/AtlasAssistant';

/** Inner component that registers tools once the engine is available. */
function VoiceToolRegistrar() {
  const { engine } = useVoice();
  const registered = useRef(false);

  useEffect(() => {
    if (registered.current) return;
    registered.current = true;
    engine.tools.registerAll(ATLAS_VOICE_TOOLS);
  }, [engine]);

  return null;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const onNavigate = useCallback(
    (path: string) => router.push(path),
    [router]
  );

  return (
    <VoiceProvider onNavigate={onNavigate}>
      <VoiceToolRegistrar />
      <div className="min-h-screen bg-atmosphere text-foreground">
        <Sidebar 
          mobileOpen={mobileMenuOpen} 
          onMobileClose={() => setMobileMenuOpen(false)} 
        />
        <TopNavigation onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main className="ml-0 md:ml-64 mt-16 p-4 md:p-6">
          {children}
        </main>
        {/* Global floating assistant */}
        <AtlasAssistant />
      </div>
    </VoiceProvider>
  );
}
