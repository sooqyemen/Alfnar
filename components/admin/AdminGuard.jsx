'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirebase } from '@/lib/firebaseClient';
import { isAdminUser } from '@/lib/admin';

export default function AdminGuard({ title = 'لوحة التحكم', children }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const { auth } = getFirebase();
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser || null);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  async function handleLogin(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { auth } = getFirebase();
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (_) {
      setError('فشل تسجيل الدخول. تأكد من البريد وكلمة المرور.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    const { auth } = getFirebase();
    await signOut(auth);
  }

  if (loading) {
    return <div style={boxStyle}>جاري التحقق من صلاحيات الأدمن...</div>;
  }

  if (!user) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={titleStyle}>{title}</h1>
          <p style={mutedStyle}>سجل دخولك ببريد الأدمن حتى تظهر الأدوات الداخلية.</p>
          <form onSubmit={handleLogin} style={{ display: 'grid', gap: 12 }}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="البريد الإلكتروني" style={inputStyle} required />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة المرور" style={inputStyle} required />
            {error ? <div style={errorStyle}>{error}</div> : null}
            <button type="submit" style={buttonStyle} disabled={submitting}>{submitting ? 'جاري تسجيل الدخول...' : 'دخول الأدمن'}</button>
          </form>
          <Link href="/account" style={linkStyle}>العودة إلى الحساب</Link>
        </div>
      </div>
    );
  }

  if (!isAdminUser(user)) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={titleStyle}>صلاحية غير متاحة</h1>
          <p style={mutedStyle}>الحساب الحالي مسجل، لكنه ليس ضمن قائمة بريد الأدمن في NEXT_PUBLIC_ADMIN_EMAILS.</p>
          <button type="button" onClick={handleLogout} style={buttonStyle}>تسجيل الخروج</button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <div style={smallMutedStyle}>مسجل كأدمن</div>
          <h1 style={titleStyle}>{title}</h1>
          <div style={mutedStyle}>{user.email}</div>
        </div>
        <button type="button" onClick={handleLogout} style={secondaryButtonStyle}>تسجيل الخروج</button>
      </div>
      {children}
    </div>
  );
}

const pageStyle = { minHeight: '100vh', background: '#f8fafc', padding: '24px 16px 48px' };
const cardStyle = { maxWidth: 480, margin: '40px auto', background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)', border: '1px solid #e5e7eb' };
const headerStyle = { maxWidth: 1200, margin: '0 auto 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' };
const titleStyle = { margin: 0, fontSize: 28, color: '#0f172a' };
const mutedStyle = { color: '#475569', lineHeight: 1.8 };
const smallMutedStyle = { color: '#64748b', fontSize: 13, marginBottom: 8 };
const boxStyle = { maxWidth: 880, margin: '40px auto', color: '#334155' };
const errorStyle = { color: '#b91c1c', background: '#fee2e2', padding: '10px 12px', borderRadius: 10 };
const inputStyle = { padding: '12px 14px', borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 16 };
const buttonStyle = { padding: '12px 16px', borderRadius: 12, border: 'none', background: '#0f172a', color: '#fff', fontSize: 15, cursor: 'pointer' };
const secondaryButtonStyle = { ...buttonStyle, background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1' };
const linkStyle = { color: '#0f172a', textDecoration: 'none', marginTop: 14, display: 'inline-block' };
