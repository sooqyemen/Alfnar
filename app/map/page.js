import { Suspense } from 'react';
import MapClient from './MapClient';

function MapLoading() {
  return (
    <div className="container" style={{ paddingTop: 16 }}>
      <section className="card" style={{ padding: 14 }}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>جاري التحميل…</div>
        <div className="muted">يتم تجهيز الخريطة والفلترة.</div>
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<MapLoading />}>
      <MapClient />
    </Suspense>
  );
}
