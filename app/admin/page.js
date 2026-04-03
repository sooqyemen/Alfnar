'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminShell from '@/components/admin/AdminShell';
import { fetchListings } from '@/lib/listings';
import { fetchRequests } from '@/lib/requestService';
import { fetchInboxEntries } from '@/lib/inboxService';

export default function AdminDashboardPage() {
  const [requests, setRequests] = useState([]);
  const [listings, setListings] = useState([]);
  const [inboxEntries, setInboxEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [nextListings, nextRequests, nextInbox] = await Promise.all([
          fetchListings({ onlyPublic: false, max: 120 }),
          fetchRequests(120),
          fetchInboxEntries(60),
        ]);
        if (!mounted) return;
        setListings(nextListings || []);
        setRequests(nextRequests || []);
        setInboxEntries(nextInbox || []);
      } catch (err) {
        if (!mounted) return;
        setError('تعذر تحميل بيانات لوحة التحكم. تأكد من صلاحيات Firestore والفهارس المطلوبة.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const newRequests = requests.filter((item) => (item.status || 'new') === 'new').length;
    const smartPending = inboxEntries.filter((item) => (item.status || 'review') !== 'approved').length;
    const directListings = listings.filter((item) => item.direct).length;
    return [
      { label: 'إجمالي العروض', value: listings.length },
      { label: 'العروض المباشرة', value: directListings },
      { label: 'طلبات جديدة', value: newRequests },
      { label: 'وارد يحتاج مراجعة', value: smartPending },
    ];
  }, [requests, listings, inboxEntries]);

  return (
    <AdminGuard title="لوحة التحكم الداخلية">
      <AdminShell
        title="لوحة إدارة لؤلؤة الفنار"
        description="من هنا تشوف الطلبات، تدخل المحادثات يدويًا أو بملف ZIP، وتعتمد نتائج الاستخراج ثم تبحث في العروض بأسلوب طبيعي."
        actions={[
          <Link key="add" href="/add" style={ctaStyle}>إضافة إعلان</Link>,
          <Link key="req" href="/admin/requests" style={secondaryStyle}>الطلبات</Link>,
          <Link key="inbox" href="/admin/inbox" style={secondaryStyle}>الوارد الذكي</Link>,
          <Link key="search" href="/admin/search" style={secondaryStyle}>البحث الذكي</Link>,
        ]}
      >
        {error ? <div style={errorStyle}>{error}</div> : null}
        <div style={statsGridStyle}>
          {stats.map((item) => (
            <div key={item.label} style={statCardStyle}>
              <div style={statValueStyle}>{loading ? '...' : item.value}</div>
              <div style={statLabelStyle}>{item.label}</div>
            </div>
          ))}
        </div>

        <div style={gridStyle}>
          <section style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <h3 style={sectionTitleStyle}>آخر الطلبات</h3>
              <Link href="/admin/requests" style={linkStyle}>عرض الكل</Link>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {(requests || []).slice(0, 5).map((item) => (
                <div key={item.id} style={itemBoxStyle}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.name || 'بدون اسم'}</div>
                  <div style={mutedStyle}>{[item.dealType, item.propertyType, item.neighborhood].filter(Boolean).join(' — ') || 'طلب بدون تفاصيل كافية'}</div>
                  <div style={{ ...mutedStyle, direction: 'ltr', textAlign: 'left' }}>{item.phone || '—'}</div>
                </div>
              ))}
              {!requests.length && !loading ? <div style={mutedStyle}>لا توجد طلبات بعد.</div> : null}
            </div>
          </section>

          <section style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <h3 style={sectionTitleStyle}>آخر الوارد الذكي</h3>
              <Link href="/admin/inbox" style={linkStyle}>فتح الوارد</Link>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {(inboxEntries || []).slice(0, 5).map((item) => (
                <div key={item.id} style={itemBoxStyle}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.source?.contactName || 'مسوق'}</div>
                  <div style={mutedStyle}>{item.source?.contactPhone || 'بدون رقم'}</div>
                  <div style={mutedStyle}>{item.aiSummary || item.rawText?.slice(0, 120) || '—'}</div>
                </div>
              ))}
              {!inboxEntries.length && !loading ? <div style={mutedStyle}>لا توجد عناصر في الوارد بعد.</div> : null}
            </div>
          </section>
        </div>
      </AdminShell>
    </AdminGuard>
  );
}

const statsGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 18 };
const statCardStyle = { background: '#fff', borderRadius: 18, padding: 18, border: '1px solid #e5e7eb', boxShadow: '0 10px 25px rgba(15,23,42,0.04)' };
const statValueStyle = { fontSize: 32, fontWeight: 800, color: '#0f172a', marginBottom: 8 };
const statLabelStyle = { color: '#64748b' };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 };
const cardStyle = { background: '#fff', borderRadius: 18, padding: 18, border: '1px solid #e5e7eb', boxShadow: '0 10px 25px rgba(15,23,42,0.04)' };
const sectionHeaderStyle = { display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 12, alignItems: 'center' };
const sectionTitleStyle = { margin: 0, color: '#0f172a', fontSize: 18 };
const itemBoxStyle = { padding: 14, borderRadius: 14, border: '1px solid #e5e7eb', background: '#fcfcfd' };
const mutedStyle = { color: '#64748b', lineHeight: 1.8 };
const linkStyle = { color: '#0f172a', textDecoration: 'none' };
const ctaStyle = { display: 'inline-flex', padding: '11px 14px', borderRadius: 12, background: '#0f172a', color: '#fff', textDecoration: 'none' };
const secondaryStyle = { display: 'inline-flex', padding: '11px 14px', borderRadius: 12, background: '#fff', color: '#0f172a', textDecoration: 'none', border: '1px solid #cbd5e1' };
const errorStyle = { marginBottom: 14, padding: 14, borderRadius: 14, background: '#fee2e2', color: '#991b1b' };
