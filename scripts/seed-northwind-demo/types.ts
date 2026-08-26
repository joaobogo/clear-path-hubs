/**
 * Dossier shape for the Northwind demo cohort.
 *
 * A dossier is data only: identity, the CV as structured blocks, the screening
 * answers and the profile facts the seeder writes back after hydration. No
 * scores, no evidence rows — those are produced by the product's own pipeline.
 */

export type Verdict = "M" | "P" | "X";

export type CvExperience = {
  /** "Title — Employer, City" */
  heading: string;
  /** "Mar 2022 – Present" */
  dates: string;
  bullets: string[];
};

/** Visual template: Classic serif, Modern sidebar, Senior compact. */
export type CvLayout = "T1" | "T2" | "T3";

export type CvDoc = {
  /** Which visual template renders this CV. Defaults to "T1". */
  layout?: CvLayout;
  /** Honest length: 1 page for short careers, 2 for the rest. Defaults to 2. */
  targetPages?: 1 | 2;
  /** "numeric" writes "03/2022 - Present" instead of "Mar 2022 - Present". */
  dateStyle?: "numeric" | "month";
  /** Puts education (and certifications) before experience. */
  educationFirst?: boolean;
  /** Heading over the summary; defaults to "Summary". */
  summaryLabel?: string;
  /** Full name, rendered as the document title. */
  name: string;
  /** One-line role title. No technology names. */
  title: string;
  /** "City, Country · email · phone[ · linkedin]" */
  contact: string;
  /** 3-4 sentences, rendered as one paragraph. */
  summary: string;
  /** Short single line, placed after the summary. */
  coreSkills: string;
  experience: CvExperience[];
  selectedWork: Array<{ heading: string; body: string }>;
  education: string[];
  certifications: string[];
  /** Language lines; the English line carries the R6 evidence sentence. */
  languages: string[];
  /** One human line (volunteering, sport, side interest). Optional. */
  interests?: string;
};

export type ProfileExperience = {
  company: string;
  title: string;
  start: string;
  end: string | null;
  summary: string;
  location?: string;
};

export type Dossier = {
  slug: string;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  region: string;
  country: string;
  timezone: string;
  linkedin_url: string | null;
  portfolio_url: string | null;

  headline: string;
  years_experience: number;
  /** Screening Q1 answer, and the React/TypeScript span visible in the CV. */
  react_ts_years: number;
  /** Screening Q2 answer. */
  eu_right_to_work: boolean;
  visa_required: boolean;
  work_authorization_notes: string;
  /** Screening Q3 answer — must use the question's own option strings. */
  multi_choice: string[];
  /** Screening Q4 answer, 60-120 words. */
  q4: string;
  /** Two short paragraphs, or null for candidates without one. */
  cover_letter: string | null;

  availability: string;
  compensation: {
    target: number;
    expected_min: number;
    expected_max: number;
    display: string;
  };

  skills: string[];
  languages: string[];
  education: Array<{ institution: string; degree: string; end: string }>;
  certifications: string[];
  experience: ProfileExperience[];
  /** 2-3 sentence recruiter summary; restates CV facts only. */
  recruiter_summary: string;

  /** The candidate's own file name, as a person would save it. */
  cv_filename: string;

  cv: CvDoc;
  /**
   * The dedicated evidence sentences from CV rule (c). Each one must appear
   * verbatim in the extracted text after whitespace normalisation.
   */
  evidence_sentences: string[];

  targets: {
    band: string;
    verdicts: Record<
      "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "P1" | "P2" | "P3" | "P4",
      Verdict
    >;
  };
};
