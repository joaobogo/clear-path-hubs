// Structured data for public role pages (schema.org/JobPosting).
// Built only from real role fields — nothing is invented or padded.

type LocationRow = {
  city: string | null;
  region: string | null;
  country: string | null;
  work_model: string | null;
};

export type JobPostingSource = {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  preferred_requirements: string[];
  employment_type: string | null;
  work_model: string | null;
  location: string | null;
  locations: LocationRow[];
  published_at: string | null;
  application_deadline: string | null;
  organization_name: string;
  organization_logo_url: string | null;
  openings: number;
};

const EMPLOYMENT_TYPE: Record<string, string> = {
  full_time: "FULL_TIME",
  part_time: "PART_TIME",
  contract: "CONTRACTOR",
  temporary: "TEMPORARY",
  internship: "INTERN",
};

function bulletBlock(heading: string, items: string[]) {
  if (items.length === 0) return "";
  return `\n\n${heading}\n${items.map((i) => `- ${i}`).join("\n")}`;
}

type Place = { "@type": "Place"; address: Record<string, string> & { "@type": "PostalAddress" } };

function placeFrom(row: LocationRow): Place | null {
  const address: Record<string, string> = {};
  if (row.city) address.addressLocality = row.city;
  if (row.region) address.addressRegion = row.region;
  if (row.country) address.addressCountry = row.country;
  if (Object.keys(address).length === 0) return null;
  return { "@type": "Place", address: { "@type": "PostalAddress", ...address } };
}

export function buildJobPostingJsonLd(pos: JobPostingSource, canonicalUrl: string) {
  const description =
    pos.description +
    bulletBlock("What you need:", pos.requirements) +
    bulletBlock("Nice to have:", pos.preferred_requirements);

  const places = pos.locations.map(placeFrom).filter((p): p is Place => p !== null);
  if (places.length === 0 && pos.location) {
    places.push({
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: pos.location },
    });
  }

  const remote =
    pos.work_model === "remote" ||
    pos.locations.some((l) => l.work_model === "remote");

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    identifier: { "@type": "PropertyValue", name: "TaaSFlow", value: pos.id },
    title: pos.title,
    description,
    url: canonicalUrl,
    directApply: true,
    hiringOrganization: {
      "@type": "Organization",
      name: pos.organization_name,
      ...(pos.organization_logo_url ? { logo: pos.organization_logo_url } : {}),
    },
  };

  if (pos.published_at) jsonLd.datePosted = pos.published_at;
  if (pos.application_deadline) jsonLd.validThrough = `${pos.application_deadline}T23:59:59`;
  if (pos.employment_type && EMPLOYMENT_TYPE[pos.employment_type]) {
    jsonLd.employmentType = EMPLOYMENT_TYPE[pos.employment_type];
  }
  if (places.length > 0) jsonLd.jobLocation = places.length === 1 ? places[0] : places;
  if (remote) jsonLd.jobLocationType = "TELECOMMUTE";
  if (pos.openings > 1) jsonLd.totalJobOpenings = pos.openings;

  return jsonLd;
}
