'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

const PARTICLE_COLORS = ['var(--color-accent-blue)', 'var(--color-accent-teal)', 'var(--color-accent-purple)'];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const particles = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
    size: 2 + Math.random() * 4,
    left: Math.random() * 100,
    top: Math.random() * 100,
    color: PARTICLE_COLORS[i % 3],
    opacity: 0.3 + Math.random() * 0.4,
    delay: Math.random() * 3,
    duration: 3 + Math.random() * 4,
  })), []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      setLoading(false);
    } else {
      // Full reload so the proxy/server components pick up the new session cookie.
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: 'var(--color-bg-primary)' }}>
      {/* Animated gradient mesh background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full"
          style={{
            background: `
              radial-gradient(ellipse 800px 600px at 20% 30%, rgba(59, 130, 246, 0.12) 0%, transparent 70%),
              radial-gradient(ellipse 600px 800px at 80% 70%, rgba(139, 92, 246, 0.10) 0%, transparent 70%),
              radial-gradient(ellipse 900px 500px at 50% 90%, rgba(20, 184, 166, 0.08) 0%, transparent 70%)
            `,
          }} />

        {/* Floating particles */}
        {mounted && particles.map((p, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-float"
            style={{
              width: `${p.size}px`,
              height: `${p.size}px`,
              left: `${p.left}%`,
              top: `${p.top}%`,
              background: p.color,
              opacity: p.opacity,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}

        {/* Grid lines */}
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(148, 163, 184, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }} />
      </div>

      {/* Login Card */}
      <div
        className={`relative w-full max-w-md mx-4 glass-strong rounded-2xl p-8 ${shaking ? 'animate-shake' : ''} ${mounted ? 'animate-fade-in-scale' : 'opacity-0'}`}
        style={{ boxShadow: '0 25px 50px rgba(0, 0, 0, 0.4)' }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 text-2xl font-bold"
            style={{ background: 'linear-gradient(135deg, var(--color-accent-blue), var(--color-accent-teal))' }}>
            D
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>DataEcho</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Enterprise Bidirectional Data Platform</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              Email
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="input-field"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-field"
            />
          </div>

          {error && (
            <div className="text-sm text-center py-2 px-4 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-accent-coral)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 cursor-pointer disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, var(--color-accent-blue), #2563eb)',
              color: 'white',
              boxShadow: '0 4px 16px var(--color-accent-blue-glow)',
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" style={{ animation: 'spin-slow 1s linear infinite' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4m-3.93 7.07l-2.83-2.83M7.76 7.76L4.93 4.93" />
                </svg>
                Signing in...
              </span>
            ) : 'Sign In'}
          </button>
        </form>

        {/* Features */}
        <div className="mt-8 pt-6 grid grid-cols-3 gap-4 text-center" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
          {[
            { icon: '🔐', label: 'MCP Secure' },
            { icon: '↕️', label: 'Bidirectional' },
            { icon: '🧠', label: 'AI-Powered' },
          ].map((f) => (
            <div key={f.label}>
              <span className="text-lg">{f.icon}</span>
              <p className="text-[10px] mt-1 font-medium" style={{ color: 'var(--color-text-muted)' }}>{f.label}</p>
            </div>
          ))}
        </div>
        {/* Credits */}
        <div className="mt-8 pt-4 text-center" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
          <p className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Created by</p>
          <p className="text-sm font-bold text-gradient mt-1">Dr. Timothy Tok</p>
        </div>
      </div>
    </div>
  );
}
