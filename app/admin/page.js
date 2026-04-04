'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminShell from '@/components/admin/AdminShell';
import { fetchListings, getListingMedia } from '@/lib/listings';
import { fetchRequests } from '@/lib/requestService';
import { fetchInboxEntries, fetchExtractedItems } from '@/lib/inboxService';

export default function AdminDashboardPage() {
  const [requests, setRequests] = useState([]);
  const [listings, setListings] = useState([]);
  const [inboxEntries, setInboxEntries] = useState([]);
  const [extractedItems, setExtractedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [nextListings, nextRequests, nextInbox, nextExtracted] = await Promise.all([
        fetchListings({ onlyPublic: false, max: 120 }),
        fetchRequests(120),
        fetchInboxEntries(60),
        fetchExtractedItems(80),
      ]);
      setListings(nextListings || []);
      setRequests(nextRequests || []);
      setInboxEntries(nextInbox || []);
      setExtractedItems(nextExtracted || []);
    } catch (_) {
      setError('تعذر تحميل بيانات لوحة التحكم. تأكد من صلاحيات Firestore والفهارس المطلوبة.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const newRequests = requests.filter((item) => (item.status || 'new') === 'new').length;
    const pendingReview = extractedItems.filter((item) => (item.extractionStatus || 'needs_review') === 'needs_review').length;
    const autoSaved = extractedItems.filter((item) => item.extractionStatus === 'auto_saved').length;
    const directListings = listings.filter((item) => item.direct).length;
    const withImages = listings.filter((item) => getListingMedia(item).length > 0).length;
    return [
      { label: 'إجمالي العروض', value: listings.length },
      { label: 'العروض المباشرة', value: directListings },
      { label: 'طلبات جديدة', value: newRequests },
      { label: 'عناصر للمراجعة', value: pendingReview },
      { label: 'عروض فيها صور', value: withImages },
      { label: 'محفوظ تلقائيًا', value: autoSaved },
    ];
  }, [requests, listings, extractedItems]);

  return (
    <AdminGuard title="لوحة التحكم الداخلية">
      <AdminShell
        title="لوحة إدارة لؤلؤة الفنار"
        description="الآن تقدر من نفس الإدارة تفتح أي إعلان، تعدل بياناته، وترفع أو تحذف صوره بشكل فردي أو جماعي."
        actions={[
          <Link key="add" href="/add" style={ctaStyle}>إضافة إعلان</Link>,
          <Link key="listings" href="/admin/listings" style={secondaryStyle}>إدارة العروض</Link>,
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
            </div>
          </section>

          <section style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <h3 style={sectionTitleStyle}>آخر المراجعات</h3>
              <Link href="/admin/inbox" style={linkStyle}>فتح الوارد</Link>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {(extractedItems || []).slice(0, 5).map((item) => (
                <div key={item.id} style={itemBoxStyle}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.summary || 'بدون ملخص'}</div>
                  <div style={mutedStyle}>{item.source?.contactName || 'مسوق'} — {item.recordType === 'request' ? 'طلب' : item.recordType === 'listing' ? 'عرض' : 'متجاهل'}</div>
                  <div style={mutedStyle}>الحالة: {item.extractionStatus || 'needs_review'}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h3 style={sectionTitleStyle}>العروض الأخيرة</h3>
              <div style={mutedStyle}>اضغط على أي إعلان لفتح صفحة الإدارة الكاملة للصور والبيانات.</div>
            </div>
            <Link href="/admin/listings" style={secondaryStyle}>كل العروض</Link>
          </div>

          <div style={listingGridStyle}>
            {(listings || []).slice(0, 6).map((item) => {
              const mediaCount = getListingMedia(item).length;
              return (
                <div key={item.id} style={listingCardStyle}>
                  <div style={{ fontWeight: 800, color: '#0f172a' }}>{item.title || 'عرض بدون عنوان'}</div>
                  <div style={mutedStyle}>{[item.neighborhood, item.plan, item.part].filter(Boolean).join(' — ') || 'بدون وصف موقع'}</div>
                  <div style={{ ...mutedStyle, fontWeight: 700 }}>الصور: {mediaCount}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                    <Link href={`/admin/listings/${item.id}`} style={ctaStyle}>إدارة الإعلان</Link>
                    <Link href={`/listing/${item.id}`} style={secondaryStyle}>عرض</Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </AdminShell>
    </AdminGuard>
  );
}

const statsGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 18 };
const statCardStyle = { background: '#fff', borderRadius: 18, padding: 18, border: '1px solid #e5e7eb', boxShadow: '0 10px 25px rgba(15,23,42,0.04)' };
const statValueStyle = { fontSize: 32, fontWeight: 800, color: '#0f172a', marginBottom: 8 };
const statLabelStyle = { color: '#64748b' };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 18 };
const cardStyle = { background: '#fff', borderRadius: 18, padding: 18, border: '1px solid #e5e7eb', boxShadow: '0 10px 25px rgba(15,23,42,0.04)' };
const sectionHeaderStyle = { display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' };
const sectionTitleStyle = { margin: 0, color: '#0f172a', fontSize: 18 };
const itemBoxStyle = { padding: 14, borderRadius: 14, border: '1px solid #e5e7eb', background: '#fcfcfd' };
const mutedStyle = { color: '#64748b', lineHeight: 1.8 };
const linkStyle = { color: '#0f172a', textDecoration: 'none' };
const ctaStyle = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 12, background: '#0f172a', color: '#fff', textDecoration: 'none' };
const secondaryStyle = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 12, background: '#fff', color: '#0f172a', textDecoration: 'none', border: '1px solid #cbd5e1' };
const errorStyle = { marginBottom: 14, padding: 14, borderRadius: 14, background: '#fee2e2', color: '#991b1b' };
const listingGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 };
const listingCardStyle = { padding: 14, borderRadius: 14, border: '1px solid #e5e7eb', background: '#fcfcfd', display: 'grid', gap: 8 };
