import { siteConfig } from "@/lib/constants";

export function JsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    "@id": siteConfig.url,
    name: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.url,
    email: siteConfig.supportEmail,
    areaServed: {
      "@type": "State",
      name: "California",
      containedInPlace: {
        "@type": "Country",
        name: "United States",
      },
    },
    medicalSpecialty: ["Addiction Medicine", "Internal Medicine"],
    availableService: [
      {
        "@type": "MedicalTherapy",
        name: "Alcohol Use Disorder Treatment",
        url: `${siteConfig.url}/alcohol-treatment`,
      },
    ],
    priceRange: "$25–$50/month",
    hasCredential: siteConfig.license,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
