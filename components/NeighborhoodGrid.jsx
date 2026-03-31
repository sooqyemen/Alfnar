'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { NEIGHBORHOODS } from '@/lib/taxonomy';

export default function NeighborhoodGrid({ title = 'الأحياء', showViewAll = true }) {
  const router = useRouter();

  const items = Array.isArray(NEIGHBORHOODS)
    ? NEIGHBORHOODS.map((name) => ({ key: name, label: name }))
    : [];

  function go(label) {
    router.push(`/listings?neighborhood=${encodeURIComponent(label)}`);
  }

  return (
    <section className="nbStrip">
      <div className="nbHead">
        <h3 className="nbTitle">{title}</h3>

        {showViewAll ? (
          <Link className="nbAll" href="/neighborhoods">
            عرض الكل
          </Link>
        ) : null}
      </div>

      <div className="nbRow" role="list" aria-label="شريط الأحياء">
        {items.map((n) => (
          <button
            key={n.key}
            type="button"
            className="nbChip"
            onClick={() => go(n.label)}
            role="listitem"
            title={n.label}
          >
            {n.label}
          </button>
        ))}
      </div>
    </section>
  );
}
