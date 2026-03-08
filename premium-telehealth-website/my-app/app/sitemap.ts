import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/constants";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url;
  const now = new Date();

  return [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/how-it-works`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/alcohol-treatment`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/get-started`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/hipaa`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
  ];
}
