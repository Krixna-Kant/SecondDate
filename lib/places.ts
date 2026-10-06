const PLACES: { test: RegExp; lat: number; lng: number }[] = [
  { test: /mawdesley/i, lat: 53.62, lng: -2.84 },
  { test: /seattle/i, lat: 47.61, lng: -122.33 },
  { test: /san francisco/i, lat: 37.77, lng: -122.42 },
  { test: /new york/i, lat: 40.71, lng: -74.0 },
  { test: /houston/i, lat: 29.76, lng: -95.37 },
  { test: /washington/i, lat: 38.91, lng: -77.04 },
  { test: /las vegas/i, lat: 36.17, lng: -115.14 },
  { test: /boston/i, lat: 42.36, lng: -71.06 },
  { test: /columbus/i, lat: 39.96, lng: -82.99 },
  { test: /austin/i, lat: 30.27, lng: -97.74 },
  { test: /sydney/i, lat: -33.87, lng: 151.21 },
  { test: /los angeles/i, lat: 34.05, lng: -118.24 },
  { test: /miami/i, lat: 25.76, lng: -80.19 },
  { test: /united states/i, lat: 39.5, lng: -98.35 },
];

function jitter(slug: string): { lat: number; lng: number } {
  let hash = 0;
  for (const char of slug) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return {
    lat: ((hash % 100) / 100 - 0.5) * 1.6,
    lng: (((hash / 100) % 100) / 100 - 0.5) * 2,
  };
}

export function placeFor(city: string, slug: string): { lat: number; lng: number } | null {
  const hit = PLACES.find((place) => place.test.test(city));
  if (!hit) return null;
  const shift = jitter(slug);
  return { lat: hit.lat + shift.lat, lng: hit.lng + shift.lng };
}
