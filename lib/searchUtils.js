import { normalizeSaudiPhone } from './contactUtils';

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function includesArabic(haystack, needle) {
  return String(haystack || '').trim().includes(String(needle || '').trim());
}

export function matchListingToFilters(listing, filters = {}) {
  if (!listing) return false;
  if (filters.neighborhood && !includesArabic(listing.neighborhood, filters.neighborhood)) return false;
  if (filters.propertyType && !includesArabic(listing.propertyType, filters.propertyType)) return false;
  if (filters.propertyClass && !includesArabic(listing.propertyClass, filters.propertyClass)) return false;
  if (filters.dealType && !includesArabic(listing.dealType, filters.dealType)) return false;
  if (filters.directOnly && !listing.direct) return false;

  const price = toNumber(listing.price);
  if (filters.priceMin != null && price != null && price < filters.priceMin) return false;
  if (filters.priceMax != null && price != null && price > filters.priceMax) return false;

  const area = toNumber(listing.area);
  if (filters.areaMin != null && area != null && area < filters.areaMin) return false;
  if (filters.areaMax != null && area != null && area > filters.areaMax) return false;

  return true;
}

export function rankListings(listings = [], filters = {}) {
  const target = Number(filters.priceTarget || 0);
  return [...listings].sort((a, b) => {
    const directA = a.direct ? 1 : 0;
    const directB = b.direct ? 1 : 0;
    if (directA !== directB) return directB - directA;

    const priceA = Number(a.price || 0);
    const priceB = Number(b.price || 0);
    if (target) {
      const diffA = Math.abs(priceA - target);
      const diffB = Math.abs(priceB - target);
      if (diffA !== diffB) return diffA - diffB;
    }

    const timeA = typeof a.createdAt?.toMillis === 'function' ? a.createdAt.toMillis() : 0;
    const timeB = typeof b.createdAt?.toMillis === 'function' ? b.createdAt.toMillis() : 0;
    return timeB - timeA;
  });
}

export function formatSearchResult(listing) {
  return {
    ...listing,
    sourceContactPhone: normalizeSaudiPhone(listing.sourceContactPhone || ''),
    sourceContactName: listing.sourceContactName || 'مسوق',
    sourceContactRole: listing.sourceContactRole || 'مسوق',
    sourceType: listing.sourceType || 'إدخال يدوي',
  };
}
