'use client';

import { useState } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import { Button, Input } from '@project-atlas/ui';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function SignUpPage() {
  const { supabase } = useSupabase();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('Supabase not configured');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);

    const redirectTo = `${window.location.origin}/auth/callback?next=/admin`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      // Email confirmation disabled - session created immediately
      router.push('/admin');
      router.refresh();
      return;
    }

    setMessage('Account created! Check your email to confirm your address, then sign in.');
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-atmosphere">
      <div className="relative w-full max-w-md">
        <form
          onSubmit={handleSignUp}
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

          {/* Heading */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-gradient-atlas">Create your account</h1>
            <p className="text-[var(--atlas-cyan-soft)] text-sm">AI Operating System for Insurance Restoration</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-destructive/20 border border-destructive/50 rounded-lg p-3">
              <p className="text-sm text-destructive text-center">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {message && (
            <div className="bg-primary/10 border border-primary/40 rounded-lg p-3">
              <p className="text-sm text-[var(--primary)] text-center">{message}</p>
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
            <div>
              <label htmlFor="confirmPassword" className="block mb-2 text-sm font-medium text-[var(--foreground)]">Confirm Password</label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full"
              />
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            variant="primary"
            size="lg"
            className="w-full"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </Button>

          {/* Sign In Link */}
          <p className="text-center text-sm text-white/70">
            Already have an account?{' '}
            <a href="/login" className="text-[var(--brand-cyan)] hover:text-[var(--brand-cyan-light)] transition-colors font-medium">
              Sign In
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
