'use client';

import Link from 'next/link';

export default function Footer() {
  const rawPhone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '0555666850';
  const phone = String(rawPhone).trim();
  const waDigits = phone.replace(/^0/, '966').replace(/\D/g, '');
  const whatsappLink = `https://wa.me/${waDigits}`;

  const mainLinks = [
    { href: '/', label: 'الرئيسية' },
    { href: '/listings', label: 'كل العقارات' },
    { href: '/request', label: 'أرسل طلبك' },
    { href: '/map', label: 'الخريطة' },
    { href: '/neighborhoods', label: 'الأحياء' },
  ];

  return (
    <footer className="footer">
      <div className="container">
        <div className="footerMain">
          <div className="brand">
            <div className="footerLogo">
              <img className="logoIcon" src="/logo-icon-128.png" alt="شعار لؤلؤة الفنار العقارية" />
              <div className="logoText">
                <h3 className="logoTitle">لؤلؤة الفنار العقارية</h3>
                <span className="logoSubtitle">بيع | شراء | إيجار | تسويق عقاري</span>
              </div>
            </div>
            <p style={{ margin: '12px 0 0', color: 'var(--muted)', lineHeight: 1.9, fontSize: 14 }}>
              منصة عقارية لعرض العقارات واستقبال الطلبات والتواصل المباشر مع العملاء عبر واتساب.
            </p>
          </div>
          <div className="contactRow">
            <a href={whatsappLink} className="contactItem" target="_blank" rel="noopener noreferrer">
              <span className="contactLabel">واتساب</span>
              <span className="contactValue">{phone}</span>
            </a>
            <div className="contactItem">
              <span className="contactLabel">الهاتف</span>
              <span className="contactValue">{phone}</span>
            </div>
            <div className="contactItem">
              <span className="contactLabel">الخدمة</span>
              <span className="contactValue">استقبال طلبات البيع والإيجار</span>
            </div>
          </div>
          <div className="quickRow">
            {mainLinks.map((link) => (
              <Link key={link.href} href={link.href} className="quickLink">{link.label}</Link>
            ))}
          </div>
        </div>
        <div className="copyright">
          <p>© {new Date().getFullYear()} لؤلؤة الفنار العقارية. جميع الحقوق محفوظة.</p>
        </div>
      </div>
    </footer>
  );
}
