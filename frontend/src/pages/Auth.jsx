import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { compact } from '../lib/format.js';
import { MailCheck } from 'lucide-react';
import { authClient } from '../lib/auth.js';
import { useSession } from '../lib/session.js';
import { Logo } from '../components/Layout.jsx';
import { Spinner } from '../components/ui.jsx';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function AuthShell({ title, subtitle, children, footer }) {
  const stats = useQuery({ queryKey: ['stats'], queryFn: () => api.get('/stats') });
  return (
    <div className="container-page grid gap-5 pt-4 lg:grid-cols-2">
      <div className="card flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm animate-rise">
          <h1 className="text-[40px] leading-[1.05] tracking-[-0.04em] sm:text-[48px]">{title}</h1>
          <p className="mt-2 text-ink-soft">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-8 text-center text-sm text-muted">{footer}</p>
        </div>
      </div>
      <div className="card-brand relative hidden min-h-[640px] flex-col overflow-hidden p-10 lg:flex">
        <div className="hatch pointer-events-none absolute -right-16 -top-16 size-80 rounded-full text-white opacity-15" />
        <Logo light />
        <p className="relative mt-auto max-w-md font-display text-[44px] font-semibold leading-[1.05] tracking-[-0.04em]">
          Buy it once. Download it whenever you need it.
        </p>
        <div className="relative mt-8 grid grid-cols-3 gap-3">
          {[
            [stats.data?.products ?? '—', 'Products'],
            [stats.data ? compact(stats.data.sales) : '—', 'Downloads sold'],
            [stats.data?.sellers ?? '—', 'Studios'],
          ].map(([v, l]) => (
            <div key={l} className="rounded-[var(--radius-inner)] bg-white/12 p-4 backdrop-blur">
              <p className="numeral text-2xl text-white">{v}</p>
              <p className="mt-1 text-xs text-white/70">{l}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function useAuthRedirect() {
  const [params] = useSearchParams();
  const next = params.get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

function SocialButton({ next }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  return (
    <>
      <button
        type="button"
        className="btn-ghost btn-lg w-full"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError('');
          const { error } = await authClient.signIn.social({ provider: 'google', callbackURL: `${window.location.origin}${next}` });
          if (error) {
            setError(error.message ?? 'Google sign-in is not available right now.');
            setPending(false);
          }
        }}
      >
        {pending ? <Spinner className="size-4" /> : <GoogleIcon />} Continue with Google
      </button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="my-6 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}

export function SignIn() {
  const { isSignedIn } = useSession();
  const next = useAuthRedirect();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  if (isSignedIn) return <Navigate to={next} replace />;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to download your purchases and pick up where you left off."
      footer={<>New to Facet? <Link to={`/sign-up?next=${encodeURIComponent(next)}`} className="font-medium text-iris">Create an account</Link></>}
    >
      <SocialButton next={next} />
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError('');
          try {
            const res = await authClient.signIn.email(form);
            if (res?.error) {
              setError(res.error.message ?? 'Check your email and password and try again.');
              return;
            }
            qc.invalidateQueries();
            navigate(next, { replace: true });
          } catch (err) {
            setError(err?.message ?? 'Invalid email or password.');
          } finally {
            setPending(false);
          }
        }}

      >
        <div>
          <label htmlFor="email" className="field-label">Email</label>
          <input id="email" type="email" autoComplete="email" required className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label htmlFor="password" className="field-label">Password</label>
          <input id="password" type="password" autoComplete="current-password" required className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        {error && <p className="rounded-xl bg-danger/8 px-3.5 py-2.5 text-sm text-danger" role="alert">{error}</p>}
        <button className="btn-primary btn-lg w-full" disabled={pending}>
          {pending && <Spinner className="size-4 text-white" />} Sign in
        </button>
        {false && authClient.demoCredentials && (
          <button type="button" className="btn-ghost w-full" onClick={() => setForm(authClient.demoCredentials)}>
            Use demo account
          </button>
        )}
      </form>
    </AuthShell>
  );
}

export function SignUp() {
  const { isSignedIn } = useSession();
  const next = useAuthRedirect();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState(false);

  if (isSignedIn) return <Navigate to={next} replace />;

  if (verifyEmail) {
    return (
      <AuthShell title="Check your inbox" subtitle={`We sent a verification link to ${form.email}.`} footer={<Link to="/sign-in" className="font-medium text-iris">Back to sign in</Link>}>
        <div className="flex items-start gap-3 rounded-2xl bg-wash p-4 text-sm text-ink-soft">
          <MailCheck className="size-5 shrink-0 text-iris" />
          Open the link in that email to verify your address, then sign in.
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="One account to buy, download and sell on Facet."
      footer={<>Already have an account? <Link to={`/sign-in?next=${encodeURIComponent(next)}`} className="font-medium text-iris">Sign in</Link></>}
    >
      <SocialButton next={next} />
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError('');
          try {
            const res = await authClient.signUp.email(form);
            if (res?.error) {
              setError(res.error.message ?? 'We could not create that account.');
              return;
            }
            const { data: session } = await authClient.getSession();
            if (!session) {
              setVerifyEmail(true);
              return;
            }
            qc.invalidateQueries();
            navigate(next, { replace: true });
          } catch (err) {
            setError(err?.message ?? 'We could not create that account.');
          } finally {
            setPending(false);
          }
        }}

      >
        <div>
          <label htmlFor="name" className="field-label">Name</label>
          <input id="name" autoComplete="name" required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label htmlFor="email" className="field-label">Email</label>
          <input id="email" type="email" autoComplete="email" required className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label htmlFor="password" className="field-label">Password</label>
          <input id="password" type="password" autoComplete="new-password" minLength={8} required className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <p className="field-hint">At least 8 characters.</p>
        </div>
        {error && <p className="rounded-xl bg-danger/8 px-3.5 py-2.5 text-sm text-danger" role="alert">{error}</p>}
        <button className="btn-primary btn-lg w-full" disabled={pending}>
          {pending && <Spinner className="size-4 text-white" />} Create account
        </button>
      </form>
    </AuthShell>
  );
}
