'use client';

import { useEffect, useState } from 'react';
import { useSupabase } from '@/providers/SupabaseProvider';
import { Button, Input } from '@project-atlas/ui';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function UpdatePasswordPage() {
  const { supabase, session, loading } = useSupabase();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !session) {
      router.push('/login');
    }
  }, [session, loading, router]);

  const handleUpdate = async (e: React.FormEvent) => {
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
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    setMessage('Password updated successfully. Redirecting to sign in...');
    setTimeout(() => {
      supabase.auth.signOut();
      router.push('/login');
    }, 1500);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-atmosphere">
        <p className="text-[var(--foreground)]/70">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-atmosphere">
      <div className="relative w-full max-w-md">
        <form
          onSubmit={handleUpdate}
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
            <h1 className="text-2xl font-bold text-gradient-atlas">Set a new password</h1>
            <p className="text-[var(--atlas-cyan-soft)] text-sm">
              Choose a new password for your account
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
              <label htmlFor="password" className="block mb-2 text-sm font-medium text-[var(--foreground)]">New Password</label>
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
              <label htmlFor="confirmPassword" className="block mb-2 text-sm font-medium text-[var(--foreground)]">Confirm New Password</label>
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
            disabled={submitting}
            variant="primary"
            size="lg"
            className="w-full"
          >
            {submitting ? 'Saving...' : 'Update Password'}
          </Button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-white/40 mt-6">
          © 2026 Project Atlas. All rights reserved.
        </p>
      </div>
    </div>
  );
}
