'use client';

import { useState } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import { Button } from '@project-atlas/ui';
import { Input } from '@project-atlas/ui';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  const { supabase } = useSupabase();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('Supabase not configured');
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    
    // Successful login - redirect to dashboard
    router.push('/');
    router.refresh(); // Refresh to update server-side auth state
    setLoading(false);
  };

  const handleMagicLink = async () => {
    if (!supabase) {
      setError('Supabase not configured');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) setError(error.message);
    else setError('Magic link sent to your email');
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-atmosphere">

      <div className="relative w-full max-w-md">
        {/* Glassmorphism Card */}
        <form
          onSubmit={handleLogin}
          className="panel-atlas rounded-2xl p-8 shadow-2xl space-y-6"
        >
          {/* Full Logo */}
          <div className="flex justify-center mb-6">
            <div className="relative w-64 h-20">
              <Image
                src="/brand/logo-full.svg"
                alt="Project Atlas"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>

          {/* Welcome Message */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-gradient-atlas">Welcome to Project Atlas</h1>
            <p className="text-[var(--atlas-cyan-soft)] text-sm">AI Operating System for Insurance Restoration</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-destructive/20 border border-destructive/50 rounded-lg p-3">
              <p className="text-sm text-destructive text-center">{error}</p>
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block mb-2 text-sm font-medium text-[var(--foreground)]">Email</label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full"
              />
            </div>
            <div>
              <label htmlFor="password" className="block mb-2 text-sm font-medium text-[var(--foreground)]">Password</label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full"
              />
            </div>
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center space-x-2 text-[var(--foreground)]/80 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-white/20 bg-white/10 text-[var(--primary)] focus:ring-[var(--primary)]"
              />
              <span>Remember me</span>
            </label>
            <a
              href="/auth/reset-password"
              className="text-[var(--brand-cyan)] hover:text-[var(--brand-cyan-light)] transition-colors"
            >
              Forgot password?
            </a>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            variant="primary" size="lg" className="w-full"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>

          {/* Magic Link */}
          <Button
            type="button"
            variant="ghost"
            onClick={handleMagicLink}
            disabled={loading}
            className="w-full text-sm"
          >
            Or sign in with magic link
          </Button>

          {/* Sign Up Link */}
          <p className="text-center text-sm text-white/70">
            Don&apos;t have an account?{''}
            <a href="/auth/signup" className="text-[var(--brand-cyan)] hover:text-[var(--brand-cyan-light)] transition-colors font-medium">
              Sign Up
            </a>
          </p>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-white/40 mt-6">
          © 2026 Project Atlas. All rights reserved.
        </p>
      </div>
    </div>
  );
}
