'use client';

import Link from 'next/link';

export default function AdminShell({ title, description, actions, children }) {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <nav style={navStyle}>
        <NavLink href="/admin">الرئيسية</NavLink>
        <NavLink href="/admin/requests">الطلبات</NavLink>
        <NavLink href="/admin/inbox">الوارد الذكي</NavLink>
        <NavLink href="/admin/search">البحث الذكي</NavLink>
        <NavLink href="/add">إضافة إعلان</NavLink>
      </nav>
      <div style={heroStyle}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, color: '#0f172a' }}>{title}</h2>
          {description ? <p style={{ color: '#475569', marginTop: 10, lineHeight: 1.9 }}>{description}</p> : null}
        </div>
        {actions ? <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

function NavLink({ href, children }) {
  return <Link href={href} style={linkStyle}>{children}</Link>;
}

const navStyle = { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 };
const linkStyle = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 999, border: '1px solid #cbd5e1', textDecoration: 'none', color: '#0f172a', background: '#fff' };
const heroStyle = { background: '#fff', borderRadius: 18, border: '1px solid #e5e7eb', padding: 20, marginBottom: 18, boxShadow: '0 10px 25px rgba(15, 23, 42, 0.04)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' };
