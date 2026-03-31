'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import ListingCard from '@/components/ListingCard';
import NeighborhoodGrid from '@/components/NeighborhoodGrid';
import { fetchLatestListings } from '@/lib/listings';

function QuickLinks() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dealType = searchParams.get('dealType') || '';

  const links = [
    { href: '/listings', label: 'كل العقارات', value: '' },
    { href: '/listings?dealType=sale', label: 'بيع', value: 'sale' },
    { href: '/listings?dealType=rent', label: 'إيجار', value: 'rent' },
    { href: '/map', label: 'الخريطة', value: 'map' },
  ];

  const isActive = (link) => {
    if (link.href.startsWith('/listings')) {
      return pathname === '/listings' && dealType === link.value;
    }
    return pathname === link.href;
  };

  return (
    <div className="quickBarHome">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`pill ${isActive(link) ? 'active' : ''}`}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}

export default function HomePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetchLatestListings(12);
        if (!alive) return;
        setItems(res || []);
      } catch {
        if (!alive) return;
        setErr('تعذر تحميل أحدث العقارات.');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const safeItems = useMemo(() => {
    return (items || []).map((it, index) => ({
      __key: it?.id || it?.docId || `idx-${index}`,
      ...it,
    }));
  }, [items]);

  return (
    <div className="container">
      {/* ✅ أحياء */}
      <NeighborhoodGrid />

      {/* ✅ اختصارات سريعة */}
      <Suspense fallback={null}>
        <QuickLinks />
      </Suspense>

      <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
        <div className="sectionTitle" style={{ margin: 0 }}>
          أحدث العقارات
        </div>
        <Link href="/listings" className="btn">
          تصفح الكل
        </Link>
      </div>

      {err ? (
        <div className="card" style={{ padding: 14, marginTop: 12 }}>
          {err}
        </div>
      ) : null}

      {loading ? (
        <div className="card" style={{ padding: 14, marginTop: 12 }}>
          جاري التحميل…
        </div>
      ) : safeItems.length === 0 ? (
        <div className="card" style={{ padding: 14, marginTop: 12 }}>
          لا توجد عقارات حتى الآن.
        </div>
      ) : (
        <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
          {safeItems.map((it) => (
            <ListingCard key={it.__key} item={it} />
          ))}
        </div>
      )}
    </div>
  );
}
