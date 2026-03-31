'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

function normalizeSaudiPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('966')) return digits;
  if (digits.startsWith('05')) return `966${digits.slice(1)}`;
  if (digits.startsWith('5') && digits.length === 9) return `966${digits}`;
  return digits;
}

export function buildWhatsAppLink({ phone, text }) {
  const digits = normalizeSaudiPhone(phone);
  if (!digits) return '#';
  const msg = encodeURIComponent(text || '');
  return `https://wa.me/${digits}?text=${msg}`;
}

export default function WhatsAppBar() {
  const [isVisible, setIsVisible] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasNotification, setHasNotification] = useState(false);
  const [isMobileSmall, setIsMobileSmall] = useState(false);
  const [customText, setCustomText] = useState('السلام عليكم، أريد استفسارًا عن عقارات لؤلؤة الفنار العقارية.');
  const hideTimerRef = useRef(null);
  const notificationTimerRef = useRef(null);
  const lastScrollYRef = useRef(0);
  const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '0555666850';
  const whatsappHref = useMemo(() => buildWhatsAppLink({ phone, text: customText }), [phone, customText]);
  const quickLinks = useMemo(() => ([
    { label: 'عقارات للبيع', text: 'السلام عليكم، أريد عقارات للبيع من لؤلؤة الفنار العقارية.' },
    { label: 'عقارات للإيجار', text: 'السلام عليكم، أريد عقارات للإيجار من لؤلؤة الفنار العقارية.' },
    { label: 'استفسار عام', text: 'السلام عليكم، عندي استفسار عن خدمات لؤلؤة الفنار العقارية.' },
    { label: 'طلب خاص', text: 'السلام عليكم، عندي طلب عقاري خاص وأحتاج خدمتكم.' },
  ]), []);
  useEffect(() => { if (typeof window === 'undefined') return; const onScroll = () => { const current = window.scrollY || 0; const last = lastScrollYRef.current; if (current > last && current > 300) { setIsVisible(false); setIsExpanded(false); } else if (current < last) { setIsVisible(true); } lastScrollYRef.current = current; }; window.addEventListener('scroll', onScroll, { passive: true }); onScroll(); return () => window.removeEventListener('scroll', onScroll); }, []);
  useEffect(() => { if (typeof window === 'undefined') return; const apply = () => setIsMobileSmall(window.innerWidth <= 480); apply(); window.addEventListener('resize', apply); return () => window.removeEventListener('resize', apply); }, []);
  useEffect(() => { if (typeof window === 'undefined') return; try { const seen = window.localStorage.getItem('whatsapp_notification_seen'); if (!seen) { const t = setTimeout(() => { setHasNotification(true); setUnreadCount(1); try { window.localStorage.setItem('whatsapp_notification_seen', 'true'); } catch {} }, 3000); return () => clearTimeout(t); } } catch {} }, []);
  useEffect(() => { if (!hasNotification) return; notificationTimerRef.current = setTimeout(() => setHasNotification(false), 8000); return () => { if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current); }; }, [hasNotification]);
  useEffect(() => () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current); }, []);
  const dismissNotification = () => { setHasNotification(false); setUnreadCount(0); if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current); };
  const toggleExpand = () => { setIsExpanded((v) => !v); if (hasNotification) dismissNotification(); };
  const handleMouseLeave = () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); hideTimerRef.current = setTimeout(() => setIsExpanded(false), 500); };
  const handleMouseEnter = () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  const desktopBarStyle = { position: 'fixed', left: 24, bottom: 24, zIndex: isExpanded ? 101 : 100, transition: 'transform 240ms ease, opacity 240ms ease', transform: isVisible ? 'translateY(0)' : 'translateY(100px)', opacity: isVisible ? 1 : 0, pointerEvents: isVisible ? 'auto' : 'none', display: isMobileSmall ? 'none' : 'block', direction: 'rtl' };
  const panelWidth = typeof window !== 'undefined' && window.innerWidth <= 768 ? Math.max(280, window.innerWidth - 32) : 380;
  return (<>
    <div style={desktopBarStyle} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} aria-label="زر واتساب للتواصل">
      {hasNotification && !isExpanded && <div style={{ position: 'absolute', bottom: 'calc(100% + 16px)', left: 0, minWidth: 320, maxWidth: Math.min(360, panelWidth), background: 'linear-gradient(135deg, var(--primary), var(--primary2))', borderRadius: 16, padding: 16, boxShadow: '0 18px 40px rgba(15,23,42,0.14)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 999, background: '#25D366', boxShadow: '0 0 0 4px rgba(37,211,102,0.18)', flex: '0 0 auto' }} /><div style={{ flex: 1, display: 'grid', gap: 4 }}><strong style={{ fontWeight: 900, fontSize: 15 }}>راسلنا الآن</strong><span style={{ fontSize: 13, opacity: 0.95 }}>خدمة مباشرة للطلبات والاستفسارات العقارية</span></div><button type="button" onClick={dismissNotification} aria-label="إغلاق الإشعار" style={{ width: 32, height: 32, borderRadius: 999, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.12)', color: '#fff', cursor: 'pointer' }}>×</button></div></div>}
      <div style={{ width: isExpanded ? panelWidth : 64, transition: 'width 240ms ease' }}>
        {isExpanded ? <div className="card" style={{ padding: 14, borderRadius: 18 }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><strong style={{ fontSize: 15 }}>واتساب لؤلؤة الفنار العقارية</strong><button type="button" className="btn" onClick={toggleExpand}>إغلاق</button></div><div style={{ marginTop: 10, display: 'grid', gap: 8 }}>{quickLinks.map((item) => <button key={item.label} type="button" className="btn" onClick={() => setCustomText(item.text)}>{item.label}</button>)}</div><textarea className="input" style={{ marginTop: 10, minHeight: 110 }} value={customText} onChange={(e) => setCustomText(e.target.value)} /><a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn btnPrimary" style={{ marginTop: 10, width: '100%', display: 'inline-flex', justifyContent: 'center' }}>فتح واتساب</a></div> : <button type="button" onClick={toggleExpand} aria-label="فتح واتساب" style={{ width: 64, height: 64, borderRadius: 999, border: 0, background: 'linear-gradient(135deg, #25D366, #179c52)', boxShadow: '0 16px 28px rgba(37,211,102,0.28)', color: '#fff', fontSize: 24, cursor: 'pointer', position: 'relative' }}>و{unreadCount > 0 ? <span style={{ position: 'absolute', top: -4, left: -4, minWidth: 24, height: 24, borderRadius: 999, background: '#ef4444', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, padding: '0 6px' }}>{unreadCount}</span> : null}</button>}
      </div>
    </div>
  </>);
}
