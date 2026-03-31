'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const LOGO_SOURCES = ['/logo-mark.svg?v=2', '/logo-icon-256.png?v=2', '/logo.svg?v=2'];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();

  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [logoIndex, setLogoIndex] = useState(0);
  const [logoDead, setLogoDead] = useState(false);

  const prevBodyOverflowRef = useRef('');
  const prevHtmlOverflowRef = useRef('');

  const navLinks = useMemo(
    () => [
      { href: '/', label: 'الرئيسية' },
      { href: '/listings', label: 'كل العقارات' },
      { href: '/map', label: 'الخريطة' },
      { href: '/neighborhoods', label: 'الأحياء' },
      { href: '/request', label: 'أرسل طلبك' },
    ],
    []
  );

  const actionLinks = useMemo(
    () => [
      { href: '/add', label: 'إضافة عقار', kind: 'primary' },
      { href: '/account', label: 'تسجيل / دخول', kind: 'secondary' },
    ],
    []
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let raf = 0;
    const handleScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setIsScrolled(window.scrollY > 10));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const html = document.documentElement;
    const body = document.body;

    if (menuOpen) {
      prevHtmlOverflowRef.current = html.style.overflow || '';
      prevBodyOverflowRef.current = body.style.overflow || '';
      html.style.overflow = 'hidden';
      body.style.overflow = 'hidden';
    } else {
      html.style.overflow = prevHtmlOverflowRef.current;
      body.style.overflow = prevBodyOverflowRef.current;
    }

    return () => {
      html.style.overflow = prevHtmlOverflowRef.current;
      body.style.overflow = prevBodyOverflowRef.current;
    };
  }, [menuOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  function onSearch(e) {
    e.preventDefault();
    const value = (q || '').trim();
    router.push(value ? `/listings?q=${encodeURIComponent(value)}` : '/listings');
  }

  function isActive(href) {
    if (href === '/') return pathname === '/';
    if (href === '/account') return pathname === '/account' || pathname === '/admin';
    return pathname?.startsWith(href);
  }

  function handleLogoError() {
    if (logoIndex < LOGO_SOURCES.length - 1) {
      setLogoIndex((v) => v + 1);
    } else {
      setLogoDead(true);
    }
  }

  function Logo({ variant = 'lg' }) {
    if (logoDead) {
      return (
        <span className={variant === 'sm' ? 'logoFallbackSm' : 'logoFallback'} aria-hidden="true">
          ع
        </span>
      );
    }

    return (
      <img
        src={LOGO_SOURCES[logoIndex]}
        alt="لؤلؤة الفنار العقارية"
        className={variant === 'sm' ? 'logoSm' : 'logo'}
        width={variant === 'sm' ? 40 : 42}
        height={variant === 'sm' ? 40 : 42}
        decoding="async"
        draggable={false}
        onError={handleLogoError}
      />
    );
  }

  return (
    <>
      <header className={`hdr ${isScrolled ? 'scrolled' : ''}`} dir="rtl">
        <div className="hdrInner">
          <button
            className="menuBtn"
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="فتح القائمة"
            aria-expanded={menuOpen ? 'true' : 'false'}
          >
            القائمة
          </button>

          <Link href="/" className="brand" aria-label="الانتقال للرئيسية">
            <Logo variant="lg" />
            <div className="brandText">
              <div className="title">لؤلؤة الفنار العقارية</div>
              <div className="sub">عروض عقارية وتسويق احترافي</div>
            </div>
          </Link>

          <form className="search" onSubmit={onSearch} role="search">
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث عن حي / مخطط / جزء…"
              aria-label="بحث"
            />
            <button className="btn btnPrimary" type="submit">
              بحث
            </button>
          </form>

          <nav className="navDesktop" aria-label="روابط الموقع">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`navLink ${isActive(link.href) ? 'active' : ''}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="headerActions" aria-label="إجراءات الحساب">
            {actionLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`headerAction ${link.kind} ${isActive(link.href) ? 'active' : ''}`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      {menuOpen ? (
        <div className="drawerRoot" dir="rtl">
          <div className="overlay" onClick={() => setMenuOpen(false)} />
          <aside className="drawer" aria-label="قائمة الجوال">
            <div className="drawerTop">
              <div className="drawerBrand">
                <Logo variant="sm" />
                <div>
                  <div className="drawerTitle">لؤلؤة الفنار العقارية</div>
                  <div className="drawerSub">القائمة</div>
                </div>
              </div>

              <button className="btn" type="button" onClick={() => setMenuOpen(false)}>
                إغلاق
              </button>
            </div>

            <div className="drawerActions">
              {actionLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`drawerAction ${l.kind}`}
                  onClick={() => setMenuOpen(false)}
                >
                  {l.label}
                </Link>
              ))}
            </div>

            <div className="drawerLinks">
              {navLinks.map((l) => (
                <Link key={l.href} href={l.href} className="drawerLink" onClick={() => setMenuOpen(false)}>
                  {l.label}
                </Link>
              ))}
            </div>

            <div className="drawerHint">استخدم البحث للوصول السريع للعقارات.</div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
