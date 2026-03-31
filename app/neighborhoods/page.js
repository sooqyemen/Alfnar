import Link from 'next/link';
import { NEIGHBORHOODS } from '@/lib/taxonomy';

export default function NeighborhoodsPage() {
  const items = Array.isArray(NEIGHBORHOODS) ? NEIGHBORHOODS : [];

  return (
    <div className="container nbPage">
      <div className="nbHead">
        <h1 className="nbH1">الأحياء</h1>
        <p className="muted nbDesc">اختر حيًا لتصفح العروض</p>
      </div>

      <div className="nbChips" role="list" aria-label="قائمة الأحياء">
        {items.map((label) => (
          <Link
            key={label}
            href={`/listings?neighborhood=${encodeURIComponent(label)}`}
            className="nbChip"
            role="listitem"
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
