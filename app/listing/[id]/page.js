'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { buildWhatsAppLink } from '@/components/WhatsAppBar';
import { fetchListingById } from '@/lib/listings';
import { formatPriceSAR, statusBadge } from '@/lib/format';

function InfoItem({ label, value, full = false }) {
  if (value === undefined || value === null || value === '') return null;

  return (
    <div className={`infoItem ${full ? 'full' : ''}`}>
      <div className="infoLabel">{label}</div>
      <div className="infoValue">{value}</div>
    </div>
  );
}

function normalizeStatusLabel(item) {
  const status = String(item?.status || 'available');
  const isRent = String(item?.dealType || '').toLowerCase() === 'rent';

  if (status === 'sold') return isRent ? 'مؤجر' : 'مباع';
  if (status === 'reserved') return 'محجوز';
  if (status === 'canceled' || status === 'hidden') return 'غير متاح';
  return 'متاح';
}

function normalizeDealTypeLabel(value) {
  const v = String(value || '').toLowerCase();
  if (v === 'rent') return 'إيجار';
  if (v === 'sale') return 'بيع';
  return '';
}

function formatArea(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `${n.toLocaleString('ar-SA')} م²`;
}

function getLocationText(item) {
  return [item?.neighborhood, item?.plan, item?.part].filter(Boolean).join(' • ') || 'غير محدد';
}

function isFiniteCoord(v) {
  const n = Number(v);
  return Number.isFinite(n);
}

function getMapHref(item) {
  const lat = Number(item?.lat);
  const lng = Number(item?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function getSafeImages(item) {
  if (!Array.isArray(item?.images)) return [];
  return item.images.filter(Boolean);
}

export default function ListingDetailsPage({ params }) {
  const routeParams = useParams();

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
  const [activeImage, setActiveImage] = useState(0);
  const [shareMsg, setShareMsg] = useState('');

  useEffect(() => {
    let live = true;

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
        setShareMsg('');

        if (!id) {
          if (live) {
            setItem(null);
            setErr('رابط العرض غير صحيح.');
          }
          return;
        }

        const data = await fetchListingById(id);

        if (live) {
          setItem(data || null);
          setActiveImage(0);
        }
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

  const images = useMemo(() => getSafeImages(item), [item]);
  const selectedImage = images[activeImage] || images[0] || '';
  const dealTypeLabel = useMemo(() => normalizeDealTypeLabel(item?.dealType), [item]);
  const statusText = useMemo(() => normalizeStatusLabel(item), [item]);
  const areaLabel = useMemo(() => formatArea(item?.area), [item]);
  const mapHref = useMemo(() => getMapHref(item), [item]);
  const locationText = useMemo(() => getLocationText(item), [item]);

  const whatsappHref = useMemo(() => {
    const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '';

    const text = item
      ? [
          'السلام عليكم، أرغب في الاستفسار عن هذا العرض:',
          item.title || 'عرض عقاري',
          `السعر: ${formatPriceSAR(item.price)}`,
          `الحي: ${item.neighborhood || '—'}`,
          `المخطط: ${item.plan || '—'}`,
          `الجزء: ${item.part || '—'}`,
          `نوع الصفقة: ${dealTypeLabel || '—'}`,
          `نوع العقار: ${item.propertyType || '—'}`,
          item.direct ? 'مباشر' : '',
          typeof window !== 'undefined' ? `الرابط: ${window.location.href}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      : 'السلام عليكم، أرغب في الاستفسار عن أحد العروض العقارية.';

    return buildWhatsAppLink({ phone, text });
  }, [item, dealTypeLabel]);

  async function handleShare() {
    try {
      setShareMsg('');

      const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
      const shareTitle = item?.title || 'عرض عقاري';
      const shareText = `${shareTitle} - ${formatPriceSAR(item?.price)}`;

      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        return;
      }

      if (navigator.clipboard && shareUrl) {
        await navigator.clipboard.writeText(shareUrl);
        setShareMsg('تم نسخ رابط الإعلان.');
        setTimeout(() => setShareMsg(''), 2500);
      }
    } catch {
      setShareMsg('');
    }
  }

  return (
    <div className="container listingPageWrap">
      {loading ? (
        <div className="card stateCard">جاري تحميل الإعلان…</div>
      ) : err ? (
        <div className="card stateCard">{err}</div>
      ) : !item ? (
        <div className="card stateCard">العرض غير موجود.</div>
      ) : (
        <>
          <div className="topNavRow">
            <Link href="/listings" className="backLink">
              العودة إلى العروض
            </Link>

            <button type="button" className="shareBtn" onClick={handleShare}>
              مشاركة
            </button>
          </div>

          <section className="heroCard card">
            <div className="heroMain">
              <div className="heroText">
                <div className="badgesRow">
                  <div className="badgeWrap">
                    {statusBadge(item.status)}
                    <span className="pill">{statusText}</span>
                  </div>

                  {dealTypeLabel ? <span className="pill deal">{dealTypeLabel}</span> : null}
                  {item.direct ? <span className="pill direct">مباشر</span> : null}
                </div>

                <h1 className="pageTitle">{item.title || 'عرض عقاري'}</h1>

                <div className="locationLine">{locationText}</div>

                <div className="priceBlock">
                  {formatPriceSAR(item.price)}
                  {String(item?.dealType || '').toLowerCase() === 'rent' ? (
                    <span className="rentHint"> / سنوي</span>
                  ) : null}
                </div>

                <div className="heroFacts">
                  <InfoItem label="نوع العقار" value={item.propertyType} />
                  <InfoItem label="المساحة" value={areaLabel} />
                  <InfoItem label="الحي" value={item.neighborhood} />
                  <InfoItem label="المخطط" value={item.plan} />
                </div>
              </div>

              <div className="heroActions">
                <a className="btn btnPrimary actionBtn" href={whatsappHref} target="_blank" rel="noreferrer">
                  تواصل واتساب
                </a>

                {mapHref ? (
                  <a className="btn actionBtn" href={mapHref} target="_blank" rel="noreferrer">
                    فتح الموقع على الخريطة
                  </a>
                ) : null}
              </div>
            </div>
          </section>

          <section className="contentGrid">
            <div className="mainCol">
              <div className="card galleryCard">
                {selectedImage ? (
                  <div className="mainImageWrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedImage}
                      alt={item.title || 'صورة العقار'}
                      className="mainImage"
                    />
                  </div>
                ) : (
                  <div className="emptyMedia">لا توجد صور لهذا الإعلان.</div>
                )}

                {images.length > 1 ? (
                  <div className="thumbsRow">
                    {images.map((src, idx) => (
                      <button
                        type="button"
                        key={`${src}-${idx}`}
                        className={`thumbBtn ${idx === activeImage ? 'active' : ''}`}
                        onClick={() => setActiveImage(idx)}
                        aria-label={`عرض الصورة ${idx + 1}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={`صورة ${idx + 1}`} className="thumbImage" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="card sectionCard">
                <h2 className="sectionHeading">تفاصيل الإعلان</h2>

                <div className="detailsGrid">
                  <InfoItem label="حالة العرض" value={statusText} />
                  <InfoItem label="نوع الصفقة" value={dealTypeLabel} />
                  <InfoItem label="نوع العقار" value={item.propertyType} />
                  <InfoItem label="المساحة" value={areaLabel} />
                  <InfoItem label="الحي" value={item.neighborhood} />
                  <InfoItem label="المخطط" value={item.plan} />
                  <InfoItem label="الجزء" value={item.part} />
                  <InfoItem label="رقم العرض" value={item.id || id} />
                  <InfoItem label="مباشر" value={item.direct ? 'نعم' : ''} />
                  <InfoItem
                    label="الإحداثيات"
                    value={
                      isFiniteCoord(item?.lat) && isFiniteCoord(item?.lng)
                        ? `${Number(item.lat)}, ${Number(item.lng)}`
                        : ''
                    }
                    full
                  />
                </div>
              </div>

              <div className="card sectionCard">
                <h2 className="sectionHeading">وصف العقار</h2>
                <div className="descriptionText">
                  {item.description || 'لا يوجد وصف مضاف لهذا الإعلان.'}
                </div>
              </div>
            </div>

            <aside className="sideCol">
              <div className="card sideCard">
                <h2 className="sideHeading">ملخص سريع</h2>

                <div className="sideList">
                  <div className="sideRow">
                    <span>السعر</span>
                    <strong>{formatPriceSAR(item.price)}</strong>
                  </div>

                  <div className="sideRow">
                    <span>الحالة</span>
                    <strong>{statusText}</strong>
                  </div>

                  {dealTypeLabel ? (
                    <div className="sideRow">
                      <span>الصفقة</span>
                      <strong>{dealTypeLabel}</strong>
                    </div>
                  ) : null}

                  {item.propertyType ? (
                    <div className="sideRow">
                      <span>النوع</span>
                      <strong>{item.propertyType}</strong>
                    </div>
                  ) : null}

                  {areaLabel ? (
                    <div className="sideRow">
                      <span>المساحة</span>
                      <strong>{areaLabel}</strong>
                    </div>
                  ) : null}

                  {item.neighborhood ? (
                    <div className="sideRow">
                      <span>الحي</span>
                      <strong>{item.neighborhood}</strong>
                    </div>
                  ) : null}

                  {item.direct ? (
                    <div className="sideRow">
                      <span>الحالة</span>
                      <strong>مباشر</strong>
                    </div>
                  ) : null}
                </div>

                <div className="stickyActions">
                  <a className="btn btnPrimary actionBtn" href={whatsappHref} target="_blank" rel="noreferrer">
                    تواصل واتساب
                  </a>

                  {mapHref ? (
                    <a className="btn actionBtn" href={mapHref} target="_blank" rel="noreferrer">
                      فتح الخريطة
                    </a>
                  ) : null}

                  <button type="button" className="btn actionBtn" onClick={handleShare}>
                    مشاركة الإعلان
                  </button>

                  {shareMsg ? <div className="shareMsg">{shareMsg}</div> : null}
                </div>
              </div>
            </aside>
          </section>
        </>
      )}

      <style jsx>{`
        .listingPageWrap {
          padding-top: 14px;
          padding-bottom: 14px;
        }

        .stateCard {
          padding: 18px;
        }

        .topNavRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }

        .backLink,
        .shareBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          padding: 0 14px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: #fff;
          color: var(--text);
          text-decoration: none;
          font-weight: 800;
          cursor: pointer;
        }

        .heroCard {
          padding: 18px;
          margin-bottom: 14px;
        }

        .heroMain {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
        }

        .heroText {
          flex: 1;
          min-width: 0;
        }

        .badgesRow {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }

        .badgeWrap {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 32px;
          padding: 0 12px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: #fff;
          color: var(--text);
          font-size: 13px;
          font-weight: 800;
        }

        .pill.deal {
          background: var(--primary-light);
          border-color: rgba(214, 179, 91, 0.25);
        }

        .pill.direct {
          background: rgba(214, 179, 91, 0.12);
          border-color: rgba(214, 179, 91, 0.28);
        }

        .pageTitle {
          margin: 0;
          font-size: clamp(22px, 3vw, 32px);
          line-height: 1.35;
          font-weight: 950;
          color: var(--text);
        }

        .locationLine {
          margin-top: 8px;
          color: var(--muted);
          line-height: 1.8;
        }

        .priceBlock {
          margin-top: 14px;
          font-size: clamp(24px, 3.1vw, 34px);
          font-weight: 950;
          color: #0f172a;
        }

        .rentHint {
          font-size: 16px;
          font-weight: 800;
          color: var(--muted);
        }

        .heroFacts {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-top: 16px;
        }

        .heroActions {
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 240px;
          flex-shrink: 0;
        }

        .actionBtn {
          width: 100%;
          text-align: center;
          text-decoration: none;
        }

        .contentGrid {
          display: grid;
          grid-template-columns: minmax(0, 1.55fr) minmax(290px, 0.9fr);
          gap: 14px;
          align-items: start;
        }

        .mainCol,
        .sideCol {
          min-width: 0;
        }

        .galleryCard,
        .sectionCard,
        .sideCard {
          padding: 14px;
          margin-bottom: 14px;
        }

        .mainImageWrap {
          width: 100%;
          aspect-ratio: 16 / 10;
          overflow: hidden;
          border-radius: 18px;
          border: 1px solid var(--border);
          background: #f1f5f9;
        }

        .mainImage {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
        }

        .emptyMedia {
          min-height: 240px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          text-align: center;
          color: var(--muted);
          border: 1px dashed var(--border2, var(--border));
          border-radius: 18px;
          background: #f8fafc;
        }

        .thumbsRow {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
          gap: 10px;
          margin-top: 12px;
        }

        .thumbBtn {
          border: 1px solid var(--border);
          border-radius: 14px;
          background: #fff;
          padding: 0;
          overflow: hidden;
          cursor: pointer;
          aspect-ratio: 1;
        }

        .thumbBtn.active {
          border-color: rgba(214, 179, 91, 0.8);
          box-shadow: 0 0 0 3px rgba(214, 179, 91, 0.18);
        }

        .thumbImage {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .sectionHeading,
        .sideHeading {
          margin: 0 0 12px;
          font-size: 18px;
          font-weight: 900;
          color: var(--text);
        }

        .detailsGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .infoItem {
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 12px;
          background: #fff;
          min-width: 0;
        }

        .infoItem.full {
          grid-column: 1 / -1;
        }

        .infoLabel {
          color: var(--muted);
          font-size: 13px;
          margin-bottom: 6px;
        }

        .infoValue {
          font-weight: 850;
          line-height: 1.7;
          word-break: break-word;
          color: var(--text);
        }

        .descriptionText {
          white-space: pre-wrap;
          line-height: 1.95;
          color: var(--text);
        }

        .sideCard {
          position: sticky;
          top: 90px;
        }

        .sideList {
          display: grid;
          gap: 2px;
        }

        .sideRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 11px 0;
          border-bottom: 1px solid var(--border);
        }

        .sideRow:last-child {
          border-bottom: 0;
        }

        .stickyActions {
          display: grid;
          gap: 10px;
          margin-top: 14px;
        }

        .shareMsg {
          font-size: 13px;
          color: var(--muted);
          text-align: center;
        }

        @media (max-width: 900px) {
          .listingPageWrap {
            padding-top: 10px;
          }

          .heroCard {
            padding: 14px;
          }

          .heroMain {
            flex-direction: column;
          }

          .heroActions {
            width: 100%;
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .heroFacts {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .contentGrid {
            grid-template-columns: 1fr;
          }

          .sideCard {
            position: static;
          }
        }

        @media (max-width: 640px) {
          .listingPageWrap {
            width: min(100%, calc(100% - 18px));
          }

          .topNavRow {
            flex-wrap: wrap;
          }

          .heroCard,
          .galleryCard,
          .sectionCard,
          .sideCard {
            padding: 12px;
            border-radius: 16px;
          }

          .pageTitle {
            font-size: 21px;
          }

          .priceBlock {
            font-size: 26px;
            margin-top: 10px;
          }

          .heroFacts,
          .detailsGrid {
            grid-template-columns: 1fr;
          }

          .heroActions {
            grid-template-columns: 1fr;
          }

          .mainImageWrap {
            aspect-ratio: 4 / 3;
            border-radius: 14px;
          }

          .thumbsRow {
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 8px;
          }

          .emptyMedia {
            min-height: 180px;
          }

          .sideRow {
            align-items: flex-start;
            flex-direction: column;
            gap: 6px;
          }
        }
      `}</style>
    </div>
  );
}
