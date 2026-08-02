'use client';

import { useState } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import { Button, Input } from '@project-atlas/ui';
import Image from 'next/image';

export default function ResetPasswordPage() {
  const { supabase } = useSupabase();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('Supabase not configured');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMessage('If an account exists for that email, a password reset link has been sent.');
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-atmosphere">
      <div className="relative w-full max-w-md">
        <form
          onSubmit={handleReset}
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
            <h1 className="text-2xl font-bold text-gradient-atlas">Reset your password</h1>
            <p className="text-[var(--atlas-cyan-soft)] text-sm">
              Enter your email and we&apos;ll send you a reset link
            </p>
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
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            variant="primary"
            size="lg"
            className="w-full"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </Button>

          {/* Back to Login */}
          <p className="text-center text-sm text-white/70">
            <a href="/login" className="text-[var(--brand-cyan)] hover:text-[var(--brand-cyan-light)] transition-colors font-medium">
              Back to Sign In
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
