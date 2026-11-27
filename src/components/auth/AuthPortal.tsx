import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, Sprout } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { LanguageSelector } from '../LanguageSelector';

type Mode = 'signin' | 'register';
type Method = 'mobile' | 'email';

/**
 * Sign in / create account. Farm details are collected once, after sign-up, by the farm
 * setup screen (real district or village coordinates, the real sowing date), not here.
 */
export const AuthPortal: React.FC = () => {
  const { login, register, updateProfile } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [method, setMethod] = useState<Method>('mobile');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contact = method === 'mobile' ? `+91${identifier}` : identifier.trim();

  const onMobile = (v: string) => {
    let d = v.replace(/\D/g, '');
    if (d.startsWith('91') && d.length > 10) d = d.slice(2);
    setIdentifier(d.slice(0, 10));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (method === 'mobile' && identifier.length !== 10) return setError('Enter your 10-digit mobile number.');
    if (method === 'email' && !/^\S+@\S+\.\S+$/.test(identifier.trim())) return setError('Enter a valid email address.');
    if (mode !== 'signin' && password.length < 8) return setError('Password needs at least 8 characters.');
    if (!password) return setError('Enter your password.');
    if (mode === 'register' && !fullName.trim()) return setError('Enter your name.');
    setBusy(true);
    try {
      if (mode === 'signin') {
        await login(contact, password);
      } else {
        await register(contact, password, method);
        await updateProfile({ name: fullName.trim(), location: '', farmType: '' });
      }
    } catch (err: any) {
      setError(err?.message || (mode === 'signin' ? 'Sign in failed. Check your details.' : 'Could not create the account.'));
    } finally {
      setBusy(false);
    }
  };

  const field = 'w-full h-12 rounded-xl border border-line bg-surface px-4 text-base text-ink placeholder:text-ink-muted';

  return (
    <div className="min-h-screen bg-ground grid lg:grid-cols-[1.1fr_1fr]">
      <section className="bg-brand text-white px-6 py-10 sm:px-12 lg:py-16 flex flex-col justify-between gap-10">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-accent text-brand flex items-center justify-center">
            <Sprout size={22} aria-hidden />
          </span>
          <span className="text-xl font-semibold">Smart Agriculture</span>
        </div>
        <div className="max-w-lg">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">
            Advice for your field, your crop and this week’s weather.
          </h1>
          <p className="mt-5 text-lg text-white/80 leading-relaxed">
            Crop stage, water need, mandi prices and disease checks in one place, grounded in ICAR guidance.
            When data is missing, we say so instead of guessing.
          </p>
        </div>
        <p className="text-sm text-white/70">No sponsored products. Your farm data is used only for your advice.</p>
      </section>

      <section className="px-6 py-10 sm:px-12 flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-8">
            <div role="tablist" aria-label="Account" className="inline-flex rounded-full bg-ash p-1">
              {(['signin', 'register'] as Mode[]).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  type="button"
                  onClick={() => { setMode(m); setError(null); }}
                  className={`h-10 px-5 rounded-full text-sm font-semibold transition-colors ${
                    mode === m ? 'bg-surface text-ink' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {m === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>
            <LanguageSelector variant="light" />
          </div>

          <h2 className="text-2xl font-semibold text-ink">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="mt-1 text-ink-soft">
            {mode === 'signin' ? 'Sign in with your mobile number or email.' : 'Next, you’ll add your farm and crop.'}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
            {mode === 'register' && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-ink mb-1.5">Your name</label>
                <input id="name" className={field} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
              </div>
            )}

            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <label htmlFor="contact" className="text-sm font-medium text-ink">
                  {method === 'mobile' ? 'Mobile number' : 'Email'}
                </label>
                <button
                  type="button"
                  className="text-sm text-brand font-medium underline underline-offset-4"
                  onClick={() => { setMethod(method === 'mobile' ? 'email' : 'mobile'); setIdentifier(''); }}
                >
                  Use {method === 'mobile' ? 'email' : 'mobile'} instead
                </button>
              </div>
              {method === 'mobile' ? (
                <div className="flex">
                  <span className="h-12 px-3 flex items-center rounded-l-xl border border-r-0 border-line bg-ash text-ink-soft num">+91</span>
                  <input
                    id="contact"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    className={`${field} rounded-l-none num`}
                    value={identifier}
                    onChange={(e) => onMobile(e.target.value)}
                  />
                </div>
              ) : (
                <input id="contact" type="email" autoComplete="email" className={field} value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink mb-1.5">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  aria-describedby={mode === 'register' ? 'pw-rule' : undefined}
                  className={`${field} pr-12`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1 w-10 h-10 flex items-center justify-center text-ink-soft hover:text-ink"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {mode === 'register' && <p id="pw-rule" className="mt-1.5 text-sm text-ink-muted">At least 6 characters.</p>}
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-bad-bg text-bad px-4 py-3 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full h-12 rounded-full bg-brand text-white font-semibold hover:bg-brand-dark disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {busy && <Loader2 size={18} className="animate-spin" aria-hidden />}
              {mode === 'signin' ? (busy ? 'Signing in…' : 'Sign in') : (busy ? 'Creating account…' : 'Create account')}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};
