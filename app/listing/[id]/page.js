'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

import { buildWhatsAppLink } from '@/components/WhatsAppBar';
import { fetchListingById } from '@/lib/listings';
import { formatPriceSAR, statusBadge } from '@/lib/format';

export default function ListingDetails({ params }) {
  const routeParams = useParams();

  // بعض الأحيان params ما توصل في صفحات الـ client، فنأخذها من useParams()
  const raw = params?.id ?? routeParams?.id;
  const rawId = Array.isArray(raw) ? raw[0] : raw;

  const id = useMemo(() => {
    try {
      return rawId ? decodeURIComponent(String(rawId)) : '';
    } catch {
      return rawId ? String(rawId) : '';
    }
  }, [rawId]);

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [isSmall, setIsSmall] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 900px)');
    const apply = () => setIsSmall(!!mq.matches);
    apply();

    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
    mq.addListener?.(apply);
    return () => mq.removeListener?.(apply);
  }, []);

  useEffect(() => {
    let live = true;

    // انتظر حتى تتوفر قيمة الـ id (لتفادي false negative)
    if (rawId === undefined) {
      setLoading(false);
      return () => {
        live = false;
      };
    }

    (async () => {
      try {
        setLoading(true);
        setErr('');

        if (!id) {
          if (live) {
            setItem(null);
            setErr('رابط العرض غير صحيح.');
          }
          return;
        }

        const data = await fetchListingById(id);
        if (live) setItem(data || null);
      } catch (e) {
        const msg = String(e?.message || '');
        if (live) {
          setItem(null);
          if (msg.includes('Missing or insufficient permissions') || e?.code === 'permission-denied') {
            setErr('لا توجد صلاحية لعرض هذا العرض الآن.');
          } else {
            setErr(msg || 'تعذر تحميل العرض حالياً.');
          }
        }
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [rawId, id]);

  const whatsappHref = useMemo(() => {
    const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '';
    const text = item
      ? [
          'السلام عليكم، أبغى استفسار عن العرض:',
          item.title || '',
          `الحي: ${item.neighborhood || '—'}`,
          `المخطط: ${item.plan || '—'}`,
          `الجزء: ${item.part || '—'}`,
          `السعر: ${formatPriceSAR(item.price)}`,
        ].join('\n')
      : 'السلام عليكم، أبغى استفسار عن عرض في لؤلؤة الفنار العقارية.';
    return buildWhatsAppLink({ phone, text });
  }, [item]);

  const wrapStyle = {
    display: 'grid',
    gridTemplateColumns: isSmall ? '1fr' : '1fr 1fr',
    gap: 12,
    marginTop: 12,
  };

  const cardPad = { padding: 14 };

  return (
    <div className="container" style={{ paddingTop: 16 }}>
      {loading ? (
        <div className="card" style={cardPad}>
          جاري التحميل…
        </div>
      ) : err ? (
        <div className="card" style={cardPad}>
          {err}
        </div>
      ) : !item ? (
        <div className="card" style={cardPad}>
          العرض غير موجود.
        </div>
      ) : (
        <div style={wrapStyle}>
          {/* تفاصيل */}
          <div className="card" style={cardPad}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 950, lineHeight: 1.25 }}>
                {item.title || 'عرض عقاري'}
              </h1>
              <div>{statusBadge(item.status)}</div>
            </div>

            <div className="muted" style={{ marginTop: 8 }}>
              {(item.neighborhood || '—') + ' • ' + (item.plan || '—') + ' • ' + (item.part || '—')}
            </div>

            <div
              className="row"
              style={{
                marginTop: 12,
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 950 }}>{formatPriceSAR(item.price)}</div>

              <a className="btn btnPrimary" href={whatsappHref} target="_blank" rel="noreferrer">
                تواصل واتساب
              </a>
            </div>

            {item.area ? (
              <div className="muted" style={{ marginTop: 10 }}>
                المساحة: {item.area} م²
              </div>
            ) : null}

            {item.propertyType ? (
              <div className="muted" style={{ marginTop: 6 }}>
                النوع: {item.propertyType}
              </div>
            ) : null}

            {item.description ? (
              <div style={{ marginTop: 12, whiteSpace: 'pre-wrap', lineHeight: 1.9 }}>
                {item.description}
              </div>
            ) : (
              <div className="muted" style={{ marginTop: 12 }}>
                لا يوجد وصف.
              </div>
            )}
          </div>

          {/* الصور */}
          <div className="card" style={cardPad}>
            {Array.isArray(item.images) && item.images.length ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isSmall ? '1fr' : '1fr 1fr',
                  gap: 10,
                }}
              >
                {item.images.map((src, idx) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`${src}-${idx}`}
                    src={src}
                    alt={`صورة ${idx + 1}`}
                    loading="lazy"
                    style={{
                      width: '100%',
                      height: 220,
                      objectFit: 'cover',
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      background: '#f1f5f9',
                      display: 'block',
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="muted">لا توجد صور.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
