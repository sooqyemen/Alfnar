'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import ChipsRow from '@/components/ChipsRow';
import ListingCard from '@/components/ListingCard';
import { fetchListings } from '@/lib/listings';
import { NEIGHBORHOODS } from '@/lib/taxonomy';

function escapeHtml(s) {
  return String(s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/** تنسيق السعر بالعربية (مثل: 1.4 مليون, 650 ألف) */
function formatPrice(price) {
  if (price == null) return '?';
  const num = Number(price);
  if (Number.isNaN(num)) return '?';

  if (num >= 1_000_000) {
    const millions = (num / 1_000_000).toFixed(1);
    return `${millions} مليون`;
  }
  if (num >= 1_000) {
    const thousands = Math.round(num / 1_000);
    return `${thousands} ألف`;
  }
  return String(num);
}

function normalizeDealType(v) {
  if (v === 'sale' || v === 'rent') return v;
  return '';
}

/** Escape للنص داخل SVG */
function escapeXml(s) {
  return String(s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * ✅ إنشاء أيقونة SVG مستطيلة خضراء تعرض السعر داخلها
 * - بدون دبوس
 * - العرض يتكيّف تقريبياً حسب طول النص
 */
function buildPriceBadgeIcon(maps, priceText) {
  const text = String(priceText || '?');

  // تقدير عرض مناسب حسب طول النص (تقريب)
  const charW = 8; // متوسط عرض الحرف/الرقم
  const padX = 12;
  const h = 30;
  const minW = 56;
  const maxW = 160;
  const w = Math.max(minW, Math.min(maxW, text.length * charW + padX * 2));

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="12"
        fill="#16a34a" stroke="rgba(255,255,255,0.95)" stroke-width="2"/>
      <text x="${w / 2}" y="${h / 2 + 5}"
        text-anchor="middle"
        font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial"
        font-size="13"
        font-weight="900"
        fill="#ffffff"
        direction="rtl"
        unicode-bidi="plaintext">${escapeXml(text)}</text>
    </svg>
  `.trim();

  const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

  return {
    url,
    scaledSize: new maps.Size(w, h),
    // نخلي نقطة المكان عند أسفل المنتصف (الـ badge يكون فوق الإحداثية)
    anchor: new maps.Point(Math.round(w / 2), h),
  };
}

let __gmapsPromise = null;
function loadGoogleMaps(apiKey) {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.google && window.google.maps) return Promise.resolve(window.google.maps);

  if (__gmapsPromise) return __gmapsPromise;

  __gmapsPromise = new Promise((resolve, reject) => {
    const cbName = `__gmaps_cb_${Date.now()}`;
    window[cbName] = () => {
      try {
        resolve(window.google.maps);
      } catch (e) {
        reject(e);
      } finally {
        try {
          delete window[cbName];
        } catch {}
      }
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&libraries=places&callback=${cbName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error('تعذر تحميل سكربت Google Maps.'));
    document.head.appendChild(script);
  });

  return __gmapsPromise;
}

export default function MapClient() {
  const searchParams = useSearchParams();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [neighborhood, setNeighborhood] = useState(searchParams.get('neighborhood') || '');
  const [dealType, setDealType] = useState(normalizeDealType(searchParams.get('dealType') || ''));

  const [mapReady, setMapReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const infoRef = useRef(null);

  const prevHtmlOverflowRef = useRef('');
  const prevBodyOverflowRef = useRef('');

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  // فلترة
  const filters = useMemo(() => {
    return {
      neighborhood: neighborhood || '',
      dealType: dealType || '',
    };
  }, [neighborhood, dealType]);

  const neighborhoodOptions = useMemo(() => {
    const opts = [{ value: '', label: 'كل الأحياء' }];
    (NEIGHBORHOODS || []).forEach((n) => opts.push({ value: n, label: n }));
    return opts;
  }, []);

  const dealTypeOptions = [
    { value: '', label: 'كل الأنواع' },
    { value: 'sale', label: 'بيع' },
    { value: 'rent', label: 'إيجار' },
  ];

  // ✅ نقل تنسيقات style jsx إلى inline (لتقليل فلاش/تأخر التنسيق)
  const topBarStyle = {
    marginTop: 12,
    background: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
    ...(isFullscreen
      ? {
          position: 'fixed',
          top: 'calc(12px + env(safe-area-inset-top))',
          left: 'calc(12px + env(safe-area-inset-left))',
          right: 'calc(12px + env(safe-area-inset-right))',
          zIndex: 1000002,
        }
      : null),
  };

  const xBtnStyle = {
    width: 44,
    height: 44,
    borderRadius: 14,
    border: '1px solid var(--border)',
    background: '#f8fafc',
    color: 'var(--text)',
    fontWeight: 950,
    cursor: 'pointer',
    fontSize: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const barCenterStyle = { flex: 1, minWidth: 0 };

  const mapHostStyle = {
    marginTop: 12,
    height: isFullscreen ? '100dvh' : '60vh',
    minHeight: isFullscreen ? '100dvh' : 380,
    borderRadius: isFullscreen ? 0 : 16,
    overflow: 'hidden',
    border: isFullscreen ? 'none' : '1px solid var(--border)',
    background: '#f1f5f9',
    position: isFullscreen ? 'fixed' : 'relative',
    inset: isFullscreen ? 0 : undefined,
    zIndex: isFullscreen ? 1000000 : undefined,
  };

  const mapBoxStyle = { width: '100%', height: '100%' };

  const mapLoadingStyle = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 950,
    color: 'var(--text)',
    background: 'rgba(255, 255, 255, 0.8)',
    zIndex: 5,
    backdropFilter: 'blur(4px)',
  };

  const mapTapFsStyle = {
    position: 'absolute',
    inset: 0,
    border: 0,
    padding: 0,
    margin: 0,
    background: 'transparent',
    cursor: 'zoom-in',
    zIndex: 6,
  };

  const mapItems = useMemo(() => {
    return (items || []).filter((it) => {
      const lat = Number(it.lat);
      const lng = Number(it.lng);
      return Number.isFinite(lat) && Number.isFinite(lng);
    });
  }, [items]);

  async function load() {
    setErr('');
    setLoading(true);
    try {
      const data = await fetchListings({
        onlyPublic: true,
        filters,
        includeLegacy: false,
        max: 500,
      });
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(String(e?.message || 'حصل خطأ أثناء جلب العروض.'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // تهيئة الخريطة مع إزالة جميع عناصر التحكم الافتراضية
  useEffect(() => {
    let alive = true;

    async function initMap() {
      try {
        if (!apiKey) throw new Error('تعذر تحميل خريطة Google. تأكد من المفتاح وتفعيل Google Maps JavaScript API.');
        const maps = await loadGoogleMaps(apiKey);
        if (!alive) return;

        const mapDiv = mapDivRef.current;
        if (!mapDiv) return;

        // افتراضي: شمال جدة (أبحر)
        const center = { lat: 21.7628, lng: 39.0994 };

        const map = new maps.Map(mapDiv, {
          center,
          zoom: 12,
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          rotateControl: false,
          scaleControl: false,
          clickableIcons: false,
          gestureHandling: 'greedy',
        });

        mapRef.current = map;
        infoRef.current = new maps.InfoWindow();

        setMapReady(true);

        // تحديث المقاس بعد وقت قصير لتفادي مشكلة التحميل/الحجم
        setTimeout(() => {
          try {
            maps.event.trigger(map, 'resize');
            map.setCenter(center);
          } catch {}
        }, 250);
      } catch (e) {
        if (!alive) return;
        setErr(String(e?.message || 'تعذر تحميل الخريطة.'));
        setMapReady(false);
      }
    }

    initMap();

    return () => {
      alive = false;
    };
  }, [apiKey]);

  // تحديث الماركرز كلما تغيّرت النتائج
  useEffect(() => {
    if (!mapReady) return;
    if (!mapRef.current) return;
    if (!window.google || !window.google.maps) return;

    const maps = window.google.maps;
    const map = mapRef.current;

    // إزالة الماركرز السابقة
    markersRef.current.forEach((m) => {
      try {
        m.setMap(null);
      } catch {}
    });
    markersRef.current = [];

    // إضافة ماركرز
    const bounds = new maps.LatLngBounds();

    mapItems.forEach((it) => {
      const lat = Number(it.lat);
      const lng = Number(it.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const pos = { lat, lng };
      bounds.extend(pos);

      const priceText = formatPrice(it.price);

      // ✅ مستطيل أخضر فيه السعر
      const icon = buildPriceBadgeIcon(maps, priceText);

      const marker = new maps.Marker({
        position: pos,
        map,
        title: it.title || 'عرض',
        icon,
        // هذا يساعد أحياناً على وضوح SVG على بعض المتصفحات
        optimized: true,
      });

      marker.addListener('click', () => {
        try {
          const title = escapeHtml(it.title || 'عرض');
          const n = escapeHtml(it.neighborhood || '');
          const link = `/listing/${encodeURIComponent(String(it.id || it.docId || ''))}`;

          const html = `
            <div style="direction:rtl; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; min-width:220px">
              <div style="font-weight:900; margin:0 0 6px">${title}</div>
              <div style="color:#475569; font-weight:700; font-size:12px; margin:0 0 8px">
                ${n ? `الحي: ${n}` : ''}
              </div>
              <a href="${link}" style="display:inline-block; padding:8px 12px; border-radius:12px; text-decoration:none;
                 background: linear-gradient(135deg, var(--primary), var(--primary2)); color:#1f2937; font-weight:900;">
                 فتح التفاصيل
              </a>
            </div>
          `;

          infoRef.current.setContent(html);
          infoRef.current.open({ anchor: marker, map, shouldFocus: false });
        } catch {}
      });

      markersRef.current.push(marker);
    });

    if (mapItems.length) {
      try {
        map.fitBounds(bounds, 60);
      } catch {}
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, mapItems]);

  // قفل تمرير الصفحة عند ملء الشاشة + إضافة كلاس
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const html = document.documentElement;
    const body = document.body;

    if (isFullscreen) {
      prevHtmlOverflowRef.current = html.style.overflow || '';
      prevBodyOverflowRef.current = body.style.overflow || '';

      html.style.overflow = 'hidden';
      body.style.overflow = 'hidden';
      body.classList.add('isMapFullscreen');

      setTimeout(() => {
        try {
          window.google?.maps?.event?.trigger(mapRef.current, 'resize');
        } catch {}
      }, 200);
    } else {
      html.style.overflow = prevHtmlOverflowRef.current;
      body.style.overflow = prevBodyOverflowRef.current;
      body.classList.remove('isMapFullscreen');

      setTimeout(() => {
        try {
          window.google?.maps?.event?.trigger(mapRef.current, 'resize');
        } catch {}
      }, 200);
    }

    return () => {
      html.style.overflow = prevHtmlOverflowRef.current;
      body.style.overflow = prevBodyOverflowRef.current;
      body.classList.remove('isMapFullscreen');
    };
  }, [isFullscreen]);

  return (
    <div className="container">
      <h1 className="h1" style={{ marginTop: 14, marginBottom: 0 }}>
        الخريطة
      </h1>
      <div className="muted" style={{ marginTop: 6 }}>
        اختر الحي أو نوع الصفقة، ثم استعرض العروض على الخريطة.
      </div>

      {loading ? (
        <section className="card" style={{ marginTop: 12, padding: 14 }}>
          جاري التحميل…
        </section>
      ) : null}

      {err ? (
        <section className="card" style={{ marginTop: 12, padding: 14 }}>
          <div className="badge err">{err}</div>
        </section>
      ) : null}

      <div style={topBarStyle}>
        <button
          style={xBtnStyle}
          onClick={() => (isFullscreen ? setIsFullscreen(false) : window.history.back())}
          aria-label="إغلاق"
        >
          ✕
        </button>

        <div style={barCenterStyle}>
          <ChipsRow value={neighborhood} options={neighborhoodOptions} onChange={setNeighborhood} />
          <div style={{ marginTop: 8 }}>
            <ChipsRow value={dealType} options={dealTypeOptions} onChange={setDealType} />
          </div>
        </div>

        <div style={{ width: 44 }} />
      </div>

      <div style={mapHostStyle}>
        <div ref={mapDivRef} style={mapBoxStyle} />

        {!mapReady ? <div style={mapLoadingStyle}>جاري تحميل الخريطة…</div> : null}

        {!isFullscreen ? (
          <button
            type="button"
            style={mapTapFsStyle}
            onClick={() => setIsFullscreen(true)}
            aria-label="فتح الخريطة ملء الشاشة"
          />
        ) : null}
      </div>

      {!isFullscreen ? (
        <section style={{ marginTop: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 950 }}>
              العروض <span className="muted">({items.length})</span>
            </div>

            <Link className="btn" href="/listings">
              فتح كل العروض
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {(items || []).slice(0, 12).map((it, idx) => (
              <ListingCard key={it.id || it.docId || `idx-${idx}`} item={it} compact />
            ))}
          </div>

          {items.length > 12 ? (
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <Link className="btn btnPrimary" href="/listings">
                مشاهدة المزيد
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
