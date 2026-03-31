'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo } from 'react';

function hashHue(text) {
  const s = String(text || '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

function IconBadge({ emoji, label }) {
  const hue = useMemo(() => hashHue(label), [label]);

  return (
    <span
      aria-hidden="true"
      style={{
        width: 36,
        height: 36,
        borderRadius: 14,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        border: `1px solid hsla(${hue}, 70%, 60%, 0.35)`,
        background: `hsla(${hue}, 70%, 55%, 0.18)`,
        flex: '0 0 auto',
      }}
    >
      {emoji}
    </span>
  );
}

export default function MobileDrawer({ open, onClose }) {
  const pathname = usePathname() || '/';

  const links = useMemo(
    () => [
      { href: '/', label: 'الرئيسية', emoji: '🏠' },
      { href: '/listings', label: 'كل العروض', emoji: '📋' },
      { href: '/listings?dealType=sale', label: 'بيع', emoji: '💰' },
      { href: '/listings?dealType=rent', label: 'إيجار', emoji: '🏷️' },
      { href: '/map', label: 'الخريطة', emoji: '🗺️' },
      { href: '/neighborhoods', label: 'الأحياء', emoji: '🏘️' },
      { href: '/request', label: 'أرسل طلبك', emoji: '📨', primary: true },
    ],
    []
  );

  const onBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  useEffect(() => {
    if (!open) return;
    try {
      const el = document.getElementById('mobile-drawer');
      el?.focus?.();
    } catch {}
  }, [open]);

  // قفل تمرير الصفحة عند فتح القائمة
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;

    if (open) {
      html.style.overflow = 'hidden';
      body.style.overflow = 'hidden';
    }

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [open]);

  // إخفاء كامل في الشاشات الكبيرة (بديل media query)
  const desktopHiddenStyle =
    typeof window !== 'undefined' && window.innerWidth >= 1024 ? { display: 'none' } : null;

  return (
    <div
      className={`mobileDrawerRoot ${open ? 'open' : ''}`}
      onMouseDown={onBackdrop}
      aria-hidden={!open}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10050,
        pointerEvents: open ? 'auto' : 'none',
        ...desktopHiddenStyle,
      }}
    >
      {/* الخلفية */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.42)',
          opacity: open ? 1 : 0,
          transition: 'opacity 180ms ease',
        }}
      />

      {/* الدرج */}
      <aside
        id="mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="قائمة الجوال"
        tabIndex={-1}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 0,
          width: 'min(86vw, 340px)',
          background: '#ffffff',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-22px 0 50px rgba(15, 23, 42, 0.18)',
          transform: open ? 'translateX(0)' : 'translateX(110%)',
          transition: 'transform 220ms ease',
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          outline: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '4px 2px 10px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              fontWeight: 950,
              fontSize: 16,
              color: 'var(--text)',
            }}
          >
            القائمة
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق القائمة"
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: '#fff',
              color: 'var(--text)',
              fontWeight: 950,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        <div
          role="navigation"
          aria-label="روابط"
          style={{
            display: 'grid',
            gap: 10,
            paddingTop: 10,
          }}
        >
          {links.map((it) => {
            const active = it.href === '/' ? pathname === '/' : pathname.startsWith(it.href.split('?')[0]);

            return (
              <Link
                key={it.href}
                href={it.href}
                onClick={onClose}
                aria-current={active ? 'page' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 12px',
                  borderRadius: 16,
                  border: active
                    ? '1px solid rgba(214, 179, 91, 0.55)'
                    : '1px solid var(--border)',
                  background: it.primary
                    ? 'linear-gradient(135deg, var(--primary), var(--primary2))'
                    : active
                      ? 'rgba(214, 179, 91, 0.12)'
                      : '#ffffff',
                  color: it.primary ? '#1f2937' : 'var(--text)',
                  fontWeight: 950,
                  textDecoration: 'none',
                }}
              >
                <IconBadge emoji={it.emoji} label={it.label} />
                <span
                  style={{
                    fontSize: 14,
                    whiteSpace: 'nowrap',
                    lineHeight: 1.2,
                  }}
                >
                  {it.label}
                </span>
              </Link>
            );
          })}
        </div>

        <div
          className="muted"
          style={{
            marginTop: 'auto',
            fontSize: 12,
            opacity: 0.9,
            padding: '8px 2px 0',
          }}
        >
          اسحب للأسفل أو اضغط ✕ للإغلاق.
        </div>
      </aside>
    </div>
  );
}
