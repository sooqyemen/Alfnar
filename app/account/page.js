'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getFirebase } from '@/lib/firebaseClient';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { isAdminUser } from '@/lib/admin';

export default function AccountPage() {
  const { auth } = getFirebase();

  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub();
  }, [auth]);

  async function doLogin(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      setPass('');
    } catch {
      setErr('بيانات الدخول غير صحيحة أو لا يوجد حساب.');
    } finally {
      setBusy(false);
    }
  }

  async function doLogout() {
    setBusy(true);
    setErr('');
    try {
      await signOut(auth);
    } catch {
      setErr('تعذر تسجيل الخروج.');
    } finally {
      setBusy(false);
    }
  }

  const isAdmin = isAdminUser(user);

  return (
    <div className="container">
      <div style={{ margin: '16px 0 12px' }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>الحساب</h1>
      </div>

      {user ? (
        <div className="card" style={{ padding: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.email}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                {isAdmin ? 'صلاحية: أدمن' : 'صلاحية: مستخدم'}
              </div>
            </div>

            <button className="btn" onClick={doLogout} disabled={busy}>
              تسجيل خروج
            </button>
          </div>

          {isAdmin ? (
            <div style={{ marginTop: 12 }}>
              <Link href="/admin" className="btn btnPrimary">
                الدخول إلى لوحة الأدمن
              </Link>
            </div>
          ) : null}
        </div>
      ) : (
        <form className="card" style={{ padding: 16 }} onSubmit={doLogin}>
          <label style={{ display: 'block', marginTop: 10, marginBottom: 6, fontWeight: 900 }}>
            البريد
          </label>
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            autoComplete="email"
          />

          <label style={{ display: 'block', marginTop: 10, marginBottom: 6, fontWeight: 900 }}>
            كلمة المرور
          </label>
          <input
            className="input"
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />

          {err ? (
            <div style={{ marginTop: 10, color: 'var(--danger)', fontWeight: 900 }}>{err}</div>
          ) : null}

          <button
            className="btn btnPrimary"
            style={{ marginTop: 12, width: '100%' }}
            type="submit"
            disabled={busy || !email || !pass}
          >
            {busy ? '...' : 'تسجيل دخول'}
          </button>
        </form>
      )}
    </div>
  );
}
