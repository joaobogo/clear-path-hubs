/**
 * The wording pair (engine v1.8.0, scoring fix spec of 26 Nov 2026).
 *
 * ORIGINAL is a real applicant's CV for the Enterprise Sales Director role,
 * as the product stored it, with the identity details replaced by
 * placeholders: name, phone, email, LinkedIn address and the personal
 * interests line. Every professional fact and its wording is unchanged.
 *
 * REWORDED states the same facts in other words, and only where the wording
 * table (wording-equivalence.json) says two wordings are one thing:
 *   new-logo acquisition        -> net-new customer acquisition
 *   ACV                         -> annual contract value
 *   quota                       -> sales target
 *   Exceeded                    -> Over-achieved
 *   MEDDPICC                    -> MEDDICC
 *   new-business                -> new business
 * Nothing else differs, so the two must score the same.
 */
import type { RequirementInput } from "@/lib/scoring-engine.server";

export const ENTERPRISE_SALES_CV_ORIGINAL = `ALEX MORGAN
HEAD OF EMEA SALES | SALES DIRECTOR | VP of SALES
Hertfordshire, UK • +44 7700 900123
alex.morgan@example.com
https://www.linkedin.com/in/example-profile/
EXECUTIVE SUMMARY
EMEA SaaS and enterprise software sales leader with a track record of scaling recurring revenue, building regional teams and securing
complex, high-value customer wins. At OpsRamp (Acquired by HPE), helped grow EMEA ARR from $3m to $20m and expand regional
headcount to 14 following acquisition. Combines hands-on enterprise deal leadership ($300k–$500k average ACV, with multiple $1m+
deals) with go-to-market strategy, forecast ownership and board-level engagement. Experienced across high-growth technology
businesses and global enterprise environments.
EXPERTISE IN:
SaaS • Artificial Intelligence • Open Source • Full Stack Observability • AIOps • Open Telemetry • Application Performance Monitoring •
Infrastructure Monitoring • Event Management • Smart Provisioning & Orchestration • Automated Backup & Recovery • Content
Delivery Networks • Unified Communications
$3m → $20m
EMEA ARR GROWTH
14
REGIONAL TEAM COUNT
$300k–$1m+
AVERAGE DEAL SIZE
PROFESSIONAL EXPERIENCE
OpsRamp / Hewlett Packard Enterprise | Head of EMEA Sales / Sales Director, EMEA Jul 2021 – Present
• Grew EMEA ARR from $3m to $20m and expanded regional headcount to 14 following the 2023 HPE acquisition.
• Lead regional go-to-market, new-logo acquisition, forecasting and executive sponsorship of strategic accounts.
• Coach Account Executives and Solution Consultants using MEDDPICC to improve qualification and deal progression.
• Oversee enterprise opportunities averaging from $300k to $2m ACV.
• Own regional P&L forecasts and contribute to executive and investor meetings.
• Annual quota achieved every year.
• Top Sales Director globally for 2024 and 2026.
Instart Logic | Sales Director, EMEA Jan 2019 – May 2021
• Led EMEA new-business growth, pipeline forecasting and a four-person team.
• Won eBay / Gumtree ($875k ACV) and AVIS ($795k ACV); supported growth ahead of M&A.
• Presented commercial strategy and performance to executives and investors.
Dynatrace | Enterprise Account Director Oct 2015 – Dec 2018
• Won British Airways (£1.4m ACV) and TUI (£750k ACV).
• Led enterprise sales, tenders and proofs of value alongside strategic technology partners.
• President’s Club winner.
• 2016 – 140% of Annual quota ($1.2m ACV)
• 2017 – 125% of Annual quota ($1.4m ACV)
• 2018 – 110% of Annual quota (£1.6m ACV)

EARLIER CAREER
Vodafone UK | Enterprise Solutions Specialist Jan 2014 – Oct 2015
• Achieved 104% of 2014/15 KPIs against a £1.2m annual order-value target.
• Led enterprise tenders and pitches for security, cloud and communications solutions.
The Cloud (BSkyB) | Sales Manager May 2011 – Jan 2014
• Created a retail go-to-market plan that expanded Wi-Fi hotspots from 4,000 to 15,000 in 12 months.
• Delivered 111% of target in 2011 (£800k), followed by 100% in 2012 (£1.2m) and 2013 (£1.35m).
EE | Senior Business Manager Dec 2006 – Apr 2011
• Exceeded KPIs in multiple years, including 147% in 2008 and 170% in 2010.
• Won and developed enterprise accounts and coached business development teams.
Phones4U Corporate | Area Business Manager Jun 2002 – Nov 2006
• Led regional SME business development and sales-team coaching.
CORE EXPERTISE
EMEA GTM Strategy • ARR Growth • Enterprise SaaS Sales • New Logo Acquisition • Sales Leadership & Hiring • P&L and Forecasting •
Board & Investor Engagement • MEDDPICC • Strategic Partnerships
EDUCATION & TRAINING
Advanced NVQ — Business Studies & Information Technology
Challenger Sale • MEDDIC • Leadership for Managers • Financial Awareness for Selling
PERSONAL INTERESTS
Cycling and martial arts`;

export const ENTERPRISE_SALES_CV_REWORDED = `ALEX MORGAN
HEAD OF EMEA SALES | SALES DIRECTOR | VP of SALES
Hertfordshire, UK • +44 7700 900123
alex.morgan@example.com
https://www.linkedin.com/in/example-profile/
EXECUTIVE SUMMARY
EMEA SaaS and enterprise software sales leader with a track record of scaling recurring revenue, building regional teams and securing
complex, high-value customer wins. At OpsRamp (Acquired by HPE), helped grow EMEA ARR from $3m to $20m and expand regional
headcount to 14 following acquisition. Combines hands-on enterprise deal leadership ($300k–$500k average annual contract value, with multiple $1m+
deals) with go-to-market strategy, forecast ownership and board-level engagement. Experienced across high-growth technology
businesses and global enterprise environments.
EXPERTISE IN:
SaaS • Artificial Intelligence • Open Source • Full Stack Observability • AIOps • Open Telemetry • Application Performance Monitoring •
Infrastructure Monitoring • Event Management • Smart Provisioning & Orchestration • Automated Backup & Recovery • Content
Delivery Networks • Unified Communications
$3m → $20m
EMEA ARR GROWTH
14
REGIONAL TEAM COUNT
$300k–$1m+
AVERAGE DEAL SIZE
PROFESSIONAL EXPERIENCE
OpsRamp / Hewlett Packard Enterprise | Head of EMEA Sales / Sales Director, EMEA Jul 2021 – Present
• Grew EMEA ARR from $3m to $20m and expanded regional headcount to 14 following the 2023 HPE acquisition.
• Lead regional go-to-market, net-new customer acquisition, forecasting and executive sponsorship of strategic accounts.
• Coach Account Executives and Solution Consultants using MEDDICC to improve qualification and deal progression.
• Oversee enterprise opportunities averaging from $300k to $2m annual contract value.
• Own regional P&L forecasts and contribute to executive and investor meetings.
• Annual sales target achieved every year.
• Top Sales Director globally for 2024 and 2026.
Instart Logic | Sales Director, EMEA Jan 2019 – May 2021
• Led EMEA new business growth, pipeline forecasting and a four-person team.
• Won eBay / Gumtree ($875k annual contract value) and AVIS ($795k annual contract value); supported growth ahead of M&A.
• Presented commercial strategy and performance to executives and investors.
Dynatrace | Enterprise Account Director Oct 2015 – Dec 2018
• Won British Airways (£1.4m annual contract value) and TUI (£750k annual contract value).
• Led enterprise sales, tenders and proofs of value alongside strategic technology partners.
• President’s Club winner.
• 2016 – 140% of annual sales target ($1.2m annual contract value)
• 2017 – 125% of annual sales target ($1.4m annual contract value)
• 2018 – 110% of annual sales target (£1.6m annual contract value)

EARLIER CAREER
Vodafone UK | Enterprise Solutions Specialist Jan 2014 – Oct 2015
• Achieved 104% of 2014/15 KPIs against a £1.2m annual order-value target.
• Led enterprise tenders and pitches for security, cloud and communications solutions.
The Cloud (BSkyB) | Sales Manager May 2011 – Jan 2014
• Created a retail go-to-market plan that expanded Wi-Fi hotspots from 4,000 to 15,000 in 12 months.
• Delivered 111% of target in 2011 (£800k), followed by 100% in 2012 (£1.2m) and 2013 (£1.35m).
EE | Senior Business Manager Dec 2006 – Apr 2011
• Over-achieved KPIs in multiple years, including 147% in 2008 and 170% in 2010.
• Won and developed enterprise accounts and coached business development teams.
Phones4U Corporate | Area Business Manager Jun 2002 – Nov 2006
• Led regional SME business development and sales-team coaching.
CORE EXPERTISE
EMEA GTM Strategy • ARR Growth • Enterprise SaaS Sales • Net-New Customer Acquisition • Sales Leadership & Hiring • P&L and Forecasting •
Board & Investor Engagement • MEDDICC • Strategic Partnerships
EDUCATION & TRAINING
Advanced NVQ — Business Studies & Information Technology
Challenger Sale • MEDDIC • Leadership for Managers • Financial Awareness for Selling
PERSONAL INTERESTS
Cycling and martial arts`;

/** The role's requirements as the client wrote them: six must-haves, six nice-to-haves. */
export const ENTERPRISE_SALES_MUST_HAVES = [
  "Proven new-logo enterprise sales (hunting) in data, cloud or IT services",
  "Has personally closed enterprise deals of $2M+ in total contract value",
  "Consistently met or exceeded multi-million new-business bookings targets",
  "Deep knowledge of the cloud data ecosystem: Snowflake, Databricks, BigQuery and Microsoft",
  "Established network of senior data/technology buyers (CIO, CDO, Head of Data) in UK enterprises",
  "Based in or commutable to London, and able to travel up to 50%",
] as const;

export const ENTERPRISE_SALES_NICE_TO_HAVES = [
  "Has sold data-platform migration or modernisation (e.g. Teradata, Oracle, Netezza, Hadoop to cloud)",
  "Co-sold with hyperscaler or platform partner teams (Snowflake, Databricks, Google Cloud, Microsoft, dbt Labs)",
  "Sold for an automation- or IP-led services firm and won against large systems integrators",
  "Uses a formal qualification method (MEDDPICC, MEDDIC or similar)",
  "Has built a territory or a pipeline engine from scratch at a scale-up",
  "Coverage of Irish enterprises as well as UK",
] as const;

export const ENTERPRISE_SALES_REQUIREMENTS: RequirementInput[] = [
  ...ENTERPRISE_SALES_MUST_HAVES.map((text, i) => ({ id: `req-${i}`, text, required: true, keywords: [] })),
  ...ENTERPRISE_SALES_NICE_TO_HAVES.map((text, i) => ({ id: `pref-${i}`, text, required: false, keywords: [] })),
];
