'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminShell from '@/components/admin/AdminShell';
import { formatPriceSAR, statusBadge } from '@/lib/format';
import { fetchListings, getListingMedia } from '@/lib/listings';

function isVideo(entry) {
  const url = String(entry?.url || '').toLowerCase();
  const kind = String(entry?.kind || '').toLowerCase();
  return kind === 'video' || ['.mp4', '.mov', '.webm', '.m4v'].some((ext) => url.includes(ext));
}

function ListingCard({ item }) {
  const media = getListingMedia(item);
  const coverEntry = media[0] || null;
  const cover = coverEntry?.url || '/placeholder-image.jpg';
  const count = media.length;

  return (
    <article style={cardStyle}>
      <div style={thumbWrapStyle}>
        {isVideo(coverEntry) ? (
          <video src={cover} style={thumbStyle} preload="metadata" muted />
        ) : (
          <img src={cover} alt={item.title || 'صورة الإعلان'} style={thumbStyle} />
        )}
        <div style={countBadgeStyle}>{count} ملف</div>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        <div>
          <div style={titleStyle}>{item.title || 'عرض بدون عنوان'}</div>
          <div style={mutedStyle}>
            {[item.neighborhood, item.plan, item.part].filter(Boolean).join(' — ') || 'بدون موقع تفصيلي'}
          </div>
        </div>

        <div style={metaRowStyle}>
          <span style={metaPillStyle}>{item.dealType === 'rent' ? 'إيجار' : 'بيع'}</span>
          <span style={metaPillStyle}>{item.propertyType || '—'}</span>
          <span>{statusBadge(item.status)}</span>
        </div>

        <div style={{ fontWeight: 900, color: '#0f172a' }}>{formatPriceSAR(item.price)}</div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href={`/admin/listings/${item.id}`} style={primaryBtnStyle}>إدارة الإعلان والصور</Link>
          <Link href={`/listing/${item.id}`} style={secondaryBtnStyle}>فتح الإعلان</Link>
        </div>
      </div>
    </article>
  );
}

export default function AdminListingsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [queryText, setQueryText] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await fetchListings({ onlyPublic: false, max: 300 });
        if (mounted) setItems(data || []);
      } catch (_) {
        if (mounted) setError('تعذر تحميل العروض. تأكد من صلاحيات الأدمن وقواعد Firestore.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = String(queryText || '').trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const hay = `${item.title || ''} ${item.neighborhood || ''} ${item.plan || ''} ${item.part || ''} ${item.propertyType || ''} ${item.dealType || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, queryText]);

  return (
    <AdminGuard title="إدارة العروض والصور">
      <AdminShell
        title="العروض المنشورة"
        description="من هنا تقدر تفتح أي إعلان، تعدل بياناته، وترفع أو تحذف الصور من نفس لوحة الإدارة."
        actions={[
          <Link key="dashboard" href="/admin" style={secondaryBtnStyle}>لوحة التحكم</Link>,
          <Link key="add" href="/add" style={primaryBtnStyle}>إضافة إعلان</Link>,
        ]}
      >
        <section style={panelStyle}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 900, color: '#0f172a' }}>إجمالي العروض: {loading ? '...' : filtered.length}</div>
              <div style={mutedStyle}>ابحث بالعنوان أو الحي أو المخطط ثم افتح الإعلان الذي تريد إدارة صوره.</div>
            </div>
            <input
              className="input"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="ابحث عن إعلان..."
              style={{ minWidth: 260, maxWidth: 340 }}
            />
          </div>
        </section>

        {error ? <div style={errorStyle}>{error}</div> : null}

        {loading ? <section style={panelStyle}>جاري تحميل العروض...</section> : null}

        {!loading && !filtered.length ? (
          <section style={panelStyle}>لا توجد نتائج مطابقة حاليًا.</section>
        ) : null}

        {!loading ? (
          <div style={gridStyle}>
            {filtered.map((item) => (
              <ListingCard key={item.id} item={item} />
            ))}
          </div>
        ) : null}
      </AdminShell>
    </AdminGuard>
  );
}

const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 16 };
const panelStyle = { background: '#fff', borderRadius: 18, padding: 18, border: '1px solid #e5e7eb', boxShadow: '0 10px 25px rgba(15,23,42,0.04)', marginBottom: 18 };
const cardStyle = { background: '#fff', borderRadius: 18, border: '1px solid #e5e7eb', boxShadow: '0 10px 25px rgba(15,23,42,0.04)', overflow: 'hidden', display: 'grid' };
const thumbWrapStyle = { position: 'relative', background: '#f8fafc', aspectRatio: '16 / 10' };
const thumbStyle = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' };
const countBadgeStyle = { position: 'absolute', top: 12, left: 12, background: 'rgba(15,23,42,.76)', color: '#fff', padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 800 };
const titleStyle = { fontSize: 18, fontWeight: 900, color: '#0f172a', margin: '14px 14px 6px' };
const mutedStyle = { color: '#64748b', lineHeight: 1.8, fontSize: 13, margin: '0 14px' };
const metaRowStyle = { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', margin: '0 14px' };
const metaPillStyle = { padding: '6px 10px', borderRadius: 999, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a', fontSize: 12, fontWeight: 700 };
const primaryBtnStyle = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 14px', borderRadius: 12, background: '#0f172a', color: '#fff', textDecoration: 'none' };
const secondaryBtnStyle = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 14px', borderRadius: 12, background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', textDecoration: 'none' };
const errorStyle = { marginBottom: 14, padding: 14, borderRadius: 14, background: '#fee2e2', color: '#991b1b' };
