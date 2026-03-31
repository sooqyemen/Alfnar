'use client';

import { useEffect, useMemo, useState } from 'react';

import ListingCard from '@/components/ListingCard';
import { fetchListings } from '@/lib/listings';
import {
  DEAL_TYPES,
  NEIGHBORHOODS,
  PROPERTY_CLASSES,
  getPropertyTypesByClass,
  inferPropertyClass,
} from '@/lib/taxonomy';

function parseQuery() {
  if (typeof window === 'undefined') return {};
  const sp = new URLSearchParams(window.location.search);
  return {
    neighborhood: sp.get('neighborhood') || '',
    dealType: sp.get('dealType') || '',
    propertyClass: sp.get('propertyClass') || '',
    propertyType: sp.get('propertyType') || '',
    q: sp.get('q') || '',
  };
}

export default function ListingsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // filters
  const [neighborhood, setNeighborhood] = useState('');
  const [dealType, setDealType] = useState('');
  const [propertyClass, setPropertyClass] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [q, setQ] = useState('');

  const [sheetOpen, setSheetOpen] = useState(false);

  // init from url once
  useEffect(() => {
    const init = parseQuery();
    setNeighborhood(init.neighborhood);
    setDealType(init.dealType);
    setPropertyClass(init.propertyClass);
    setPropertyType(init.propertyType);
    setQ(init.q);
  }, []);

  const propertyTypes = useMemo(() => getPropertyTypesByClass(propertyClass), [propertyClass]);

  const filters = useMemo(() => {
    const cls = propertyClass || (propertyType ? inferPropertyClass(propertyType) : '');
    return {
      neighborhood: neighborhood || '',
      dealType: dealType || '',
      propertyClass: cls || '',
      propertyType: propertyType || '',
      q: q || '',
    };
  }, [neighborhood, dealType, propertyClass, propertyType, q]);

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const res = await fetchListings({ filters, onlyPublic: true, includeLegacy: true, max: 240 });
      setItems(res || []);
    } catch (e) {
      setErr('تعذر تحميل العروض.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // لا تبدأ قبل ما نقرأ params
    const t = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.neighborhood, filters.dealType, filters.propertyClass, filters.propertyType, filters.q]);

  function clearFilters() {
    setNeighborhood('');
    setDealType('');
    setPropertyClass('');
    setPropertyType('');
    setQ('');
  }

  const activeChips = useMemo(() => {
    const chips = [];
    if (q) chips.push({ key: 'q', label: `بحث: ${q}` });
    if (neighborhood) chips.push({ key: 'neighborhood', label: neighborhood });
    if (dealType) chips.push({ key: 'dealType', label: (DEAL_TYPES.find((d) => d.key === dealType)?.label || dealType) });
    if (propertyClass) chips.push({ key: 'propertyClass', label: (PROPERTY_CLASSES.find((c) => c.key === propertyClass)?.label || propertyClass) });
    if (propertyType) chips.push({ key: 'propertyType', label: propertyType });
    return chips;
  }, [q, neighborhood, dealType, propertyClass, propertyType]);

  return (
    <div className="container">
      <div
        style={{
          margin: '16px 0 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>كل العروض</h1>
        <button className="btn" onClick={() => setSheetOpen(true)}>
          فلترة
        </button>
      </div>

      {activeChips.length ? (
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          {activeChips.map((c) => (
            <span
              key={c.key}
              style={{
                background: 'rgba(30,115,216,.10)',
                border: '1px solid rgba(30,115,216,.18)',
                color: 'var(--primary2)',
                padding: '6px 10px',
                borderRadius: 999,
                fontWeight: 900,
                fontSize: 12,
              }}
            >
              {c.label}
            </span>
          ))}

          <button
            onClick={clearFilters}
            style={{
              background: 'transparent',
              border: '1px dashed rgba(15,23,42,.25)',
              padding: '6px 10px',
              borderRadius: 999,
              fontWeight: 900,
              fontSize: 12,
              cursor: 'pointer',
              color: 'rgba(15,23,42,.7)',
            }}
          >
            مسح
          </button>
        </div>
      ) : (
        <div className="muted" style={{ marginTop: 6 }}>
          اختر فلترًا أو ابحث من شريط البحث بالأعلى.
        </div>
      )}

      {err ? (
        <div className="card" style={{ padding: 14, marginTop: 12 }}>
          {err}
        </div>
      ) : null}

      {loading ? (
        <div className="muted" style={{ padding: '12px 0' }}>
          جاري التحميل...
        </div>
      ) : items.length === 0 ? (
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          لا توجد إعلانات ضمن الفلاتر الحالية.
        </div>
      ) : (
        <div
          style={{
            marginTop: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            marginBottom: 18,
          }}
        >
          {items.map((it, idx) => (
            <ListingCard key={it.id || it.docId || `idx-${idx}`} item={it} compact />
          ))}
        </div>
      )}

      {/* Bottom Sheet */}
      {sheetOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="فلترة"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 70,
            display: 'flex',
            alignItems: 'flex-end',
          }}
        >
          <div
            onClick={() => setSheetOpen(false)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,.45)',
            }}
          />

          <div
            style={{
              position: 'relative',
              width: '100%',
              maxHeight: '86vh',
              background: 'var(--bg2)',
              borderRadius: '18px 18px 0 0',
              border: '1px solid var(--border)',
              boxShadow: '0 -18px 40px rgba(0,0,0,.16)',
              overflow: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '14px 14px 10px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{ fontWeight: 900 }}>فلترة</div>

              <button
                onClick={() => setSheetOpen(false)}
                aria-label="إغلاق"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'var(--card)',
                  cursor: 'pointer',
                  fontWeight: 900,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 14 }}>
              <label
                style={{
                  display: 'block',
                  marginTop: 10,
                  marginBottom: 6,
                  fontWeight: 900,
                }}
              >
                بحث
              </label>
              <input
                className="input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="مثال: 99جس أو الياقوت..."
              />

              <label
                style={{
                  display: 'block',
                  marginTop: 10,
                  marginBottom: 6,
                  fontWeight: 900,
                }}
              >
                الحي
              </label>
              <select
                className="input"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
              >
                <option value="">كل الأحياء</option>
                {NEIGHBORHOODS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>

              <label
                style={{
                  display: 'block',
                  marginTop: 10,
                  marginBottom: 6,
                  fontWeight: 900,
                }}
              >
                نوع التعامل
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {DEAL_TYPES.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setDealType(dealType === d.key ? '' : d.key)}
                    style={{
                      border: dealType === d.key
                        ? '1px solid rgba(30,115,216,.26)'
                        : '1px solid var(--border)',
                      background: dealType === d.key ? 'rgba(30,115,216,.10)' : 'var(--card)',
                      borderRadius: 999,
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontWeight: 900,
                      fontSize: 13,
                      color: dealType === d.key ? 'var(--primary2)' : 'var(--text)',
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              <label
                style={{
                  display: 'block',
                  marginTop: 10,
                  marginBottom: 6,
                  fontWeight: 900,
                }}
              >
                تصنيف العقار
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PROPERTY_CLASSES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => {
                      const next = propertyClass === c.key ? '' : c.key;
                      setPropertyClass(next);
                      setPropertyType('');
                    }}
                    style={{
                      border: propertyClass === c.key
                        ? '1px solid rgba(30,115,216,.26)'
                        : '1px solid var(--border)',
                      background: propertyClass === c.key ? 'rgba(30,115,216,.10)' : 'var(--card)',
                      borderRadius: 999,
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontWeight: 900,
                      fontSize: 13,
                      color: propertyClass === c.key ? 'var(--primary2)' : 'var(--text)',
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <label
                style={{
                  display: 'block',
                  marginTop: 10,
                  marginBottom: 6,
                  fontWeight: 900,
                }}
              >
                الفئة
              </label>
              <select
                className="input"
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                disabled={!propertyClass}
              >
                <option value="">
                  {propertyClass ? 'كل الفئات' : 'اختر التصنيف أولاً'}
                </option>
                {propertyTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button className="btn" type="button" onClick={clearFilters} style={{ flex: 1 }}>
                  مسح
                </button>
                <button
                  className="btn btnPrimary"
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  style={{ flex: 1 }}
                >
                  تطبيق
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
