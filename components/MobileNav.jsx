'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// شريط الجوال السفلي (نص فقط)
// - بدون رموز
// - يخفي نفسه عند ملء شاشة الخريطة
// - بدون <style jsx> لتقليل فلاش التنسيق
export default function MobileNav() {
  const pathname = usePathname() || '/';
  const router = useRouter();

  const [hiddenByFullscreen, setHiddenByFullscreen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    // إخفاء الشريط إذا كانت الخريطة في وضع ملء الشاشة
    const tick = () => {
      try {
        setHiddenByFullscreen(document.body.classList.contains('isMapFullscreen'));
      } catch {
        setHiddenByFullscreen(false);
      }
    };

    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    // بديل media query بدون style jsx
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mq = window.matchMedia('(min-width: 900px)');
    const apply = () => setIsDesktop(!!mq.matches);

    apply();

    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }

    // Safari القديم
    mq.addListener?.(apply);
    return () => mq.removeListener?.(apply);
  }, []);

  const items = [
    { href: '/', label: 'الرئيسية' },
    { href: '/neighborhoods', label: 'الأحياء' },
    { href: '/map', label: 'الخريطة' },
    { href: '/request', label: 'أرسل طلبك' },
  ];

  const isActive = (href) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  if (isDesktop) return null;

  return (
    <nav
      aria-label="قائمة الجوال"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        padding: '10px 12px 14px',
        transition: 'transform 180ms ease, opacity 180ms ease',
        transform: hiddenByFullscreen ? 'translateY(120%)' : 'translateY(0)',
        opacity: hiddenByFullscreen ? 0 : 1,
        pointerEvents: hiddenByFullscreen ? 'none' : 'auto',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 10,
          background: 'rgba(255,255,255,0.94)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 10,
          backdropFilter: 'blur(16px)',
          boxShadow: '0 -8px 24px rgba(15, 23, 42, 0.10)',
        }}
      >
        {items.map((it) => {
          const active = isActive(it.href);
          const isPrimary = it.href === '/request';

          return (
            <button
              key={it.href}
              type="button"
              onClick={() => router.push(it.href)}
              aria-current={active ? 'page' : undefined}
              style={{
                border: active
                  ? '1px solid rgba(214,179,91,0.55)'
                  : '1px solid var(--border)',
                background: isPrimary
                  ? 'linear-gradient(135deg, var(--primary), var(--primary2))'
                  : active
                    ? 'rgba(214,179,91,0.12)'
                    : '#ffffff',
                color: isPrimary ? '#1f2937' : 'var(--text)',
                borderRadius: 14,
                padding: '10px 8px',
                fontWeight: 950,
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                lineHeight: 1.2,
              }}
              title={it.label}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
