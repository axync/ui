import type { MetadataRoute } from "next";

// TODO: Fetch active listings from the API (GET /api/v1/nft-listings) and
// generate dynamic /listing/[id] entries so search engines can discover
// individual deal pages. Example:
//   const { listings } = await fetch(`${API_BASE_URL}/api/v1/nft-listings`).then(r => r.json())
//   const listingEntries = listings.map(l => ({
//     url: `https://app.axync.xyz/listing/${l.id}`,
//     lastModified: new Date(l.created_at * 1000),
//     changeFrequency: 'daily' as const,
//     priority: 0.9,
//   }))
// Then spread [...staticRoutes, ...listingEntries] in the return.

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://app.axync.xyz",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: "https://app.axync.xyz/list",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: "https://app.axync.xyz/portfolio",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];
}
