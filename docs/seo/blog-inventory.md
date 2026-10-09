# General blog post inventory

Scope: the 73 live blog posts in `INCLUDED_BLOG_SLUGS` (`src/lib/marketing/blog-manifest.ts`) that are not industry-tagged. Industry-tagged posts are handled in a separate pass and are not listed here.

Last updated: 7 October 2026. Detection is scripted (regular expressions over the post markdown) and the rewrites were done by hand.

## Data gaps

- **No Search Console data.** Impressions, clicks, queries and average position per URL were not available, so no decision here uses traffic.
- **No backlink data.** Referring domains per URL were not available, so no decision here weighs inbound links. Before any post is redirected or removed, check backlinks for it first.
- **No analytics.** Engagement and conversion by post are unknown.
- **No external sources were added.** Outbound requests to source pages were blocked in this environment and the search tool was unavailable, so no citation could be verified. Every statistic that could not be sourced was removed or recast, never cited from memory. No post contains an external source link.
- Published dates and the author (`TaaSFlow Editorial Team`) were left unchanged, and no author or reviewer was added.

## Method

- **Percent and dollar figures** counts matches of percentages and dollar amounts. **Other figures** counts multipliers (3x), ratios (N of M), durations (days, weeks, months, hours) and large numbers. Counts are before the pass (git HEAD) and after it. Durations in recommendations (for example a 30-60-90 plan) and figures inside labelled illustrative examples remain, so after-counts are not zero.
- **Invented or unlinked claims** records posts with a made-up anecdote, a composite client, a claim about TaaSFlow data or results, or a named research body cited without a link. The same column lists third-party bodies named in the original text that carried no link.
- **Decisions:** Improve (done), Retain (CTA labels only), Consolidate into `<slug>`, Noindex pending review. The blog route has no per-post robots field, so every Consolidate and Noindex decision is **not applied**. See Needs noindex support below.

## Totals

| Measure | Count |
| :--- | ---: |
| Live non-industry posts | 73 |
| Improved (statistics, anecdotes, CTAs fixed) | 32 |
| Retained with CTA labels only | 2 |
| Flagged: consolidate | 13 |
| Flagged: noindex pending review | 26 |
| Percent and dollar figures before / after | 910 / 53 |
| Other numeric figures before / after | 281 / 56 |

Each post has exactly one decision, so the four decision rows sum to 73. All 71 posts other than the two retained were rewritten; 39 of them are also flagged for consolidation or noindex because they are thin or duplicate another post. Counts exclude the standard pilot call-to-action block.

## Inventory

| Slug | Title | Date | Words before | Words after | % and $ before | Other before | % and $ after | Other after | Invented or unlinked claims | External source link | Decision | Notes |
| :--- | :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | :--- | ---: | :--- | :--- |
| `30-60-90-onboarding-plan-2026` | Executive 30 60 90 Onboarding Plan 2026: Metric-Driven Guide | 2026-02-26 | 1894 | 1791 | 4 | 7 | 0 | 3 | Yes: "Data compiled by TaaSFlow" 43% claim and unsourced leadership-search benchmark | 0 | Improve (done) | Substantive. Statistics, anecdotes and unsourced benchmarks removed or recast. |
| `accounting-firm-recruitment-strategies` | Accounting Firm Recruitment: How Top Firms Win Campus and Lateral Talent | 2026-02-18 | 393 | 459 | 11 | 0 | 0 | 0 | No | 0 | Noindex pending review | Thin after cleanup; distinct intent (campus and lateral). Needs noindex support. |
| `accounting-talent-shortage-big-four` | Why Big Four Firms Are Losing the Pipeline War: The Accounting Talent Shortage | 2026-03-06 | 272 | 350 | 16 | 0 | 0 | 0 | Yes: AICPA figures and Big Four incentive claims without link Named without link: AICPA. | 0 | Consolidate into accounting-talent-shortage-solutions | Thin; duplicates the shortage theme. Needs noindex or redirect support. |
| `accounting-talent-shortage-guide` | The Accounting Talent Shortage: Why Firms Struggle to Hire and What to Do About It | 2026-03-05 | 422 | 494 | 23 | 1 | 0 | 0 | Yes: AICPA/exodus figures without link | 0 | Consolidate into accounting-talent-shortage-solutions | Duplicates the shortage theme. Needs noindex or redirect support. |
| `accounting-talent-shortage-solutions` | Accounting Talent Shortage Solutions: Modern Hiring | 2026-01-18 | 1936 | 1795 | 6 | 7 | 0 | 0 | Yes: Named-city "case study" in which TaaSFlow placed help; invented "National Pipeline Advisory Group" benchmark Named without link: AICPA, National Pipeline Advisory Group. | 0 | Improve (done) | Substantive. Statistics, anecdotes and unsourced benchmarks removed or recast. |
| `ai-impact-on-jobs-hiring` | AI Impact on Jobs Hiring: The 2026 Reality for TA Leaders | 2026-03-05 | 1910 | 1831 | 3 | 1 | 0 | 0 | Yes: Invented "42% reduction" benchmark | 0 | Improve (done) | Substantive. Statistics, anecdotes and unsourced benchmarks removed or recast. |
| `ai-in-recruitment` | AI in Recruitment: Measuring What Automation Actually Changes | 2025-12-10 | 1824 | 1578 | 7 | 13 | 0 | 0 | Yes: Invented city-specific cost anecdotes; unlinked SHRM and benchmark claims | 0 | Improve (done) | Substantive. Statistics, anecdotes and unsourced benchmarks removed or recast. |
| `ai-ml-engineering-hiring-guide` | Hiring AI and ML Engineers: A Practical Guide for 2026 | 2026-02-28 | 420 | 503 | 34 | 0 | 0 | 0 | No | 0 | Improve (done) | Role taxonomy and interview structure remain useful; no figures left. |
| `ai-replacing-vs-augmenting-recruiters` | AI Replacing Vs Augmenting Recruiters: Key Differences | 2026-03-10 | 1808 | 1715 | 0 | 8 | 0 | 0 | Yes: Invented Austin firm anecdote and "41 percent" benchmark | 0 | Improve (done) | Substantive. Statistics, anecdotes and unsourced benchmarks removed or recast. |
| `ai-reshaping-every-industry-hiring` | How AI Is Reshaping Hiring Across Every Industry: A 2026 Analysis | 2026-03-04 | 415 | 392 | 7 | 0 | 0 | 0 | Yes: Invented accuracy and adoption figures; claims about "every candidate our clients receive" | 0 | Consolidate into ai-impact-on-jobs-hiring | Thin; overlaps. Needs noindex or redirect support. |
| `ai-screening-ethics` | AI Screening Ethics: Balancing Efficiency With Fairness | 2026-01-19 | 234 | 238 | 0 | 0 | 0 | 0 | No | 0 | Noindex pending review | Very thin; overlaps /ai-in-hiring page. Needs noindex support. |
| `ai-workforce-planning-2030` | AI Workforce Planning 2030: The 3 CFO Questions | 2026-03-02 | 1405 | 1325 | 5 | 15 | 0 | 0 | Yes: Invented "34 percent / $142,000" benchmark | 0 | Improve (done) | Substantive. Statistics, anecdotes and unsourced benchmarks removed or recast. |
| `ambient-computing-workplace-transformation` | Ambient Computing and the Workplace: How Always-On AI Changes Job Requirements | 2026-03-04 | 274 | 262 | 5 | 1 | 0 | 0 | No Named without link: Google. | 0 | Noindex pending review | Thin; speculative topic. Needs noindex support. |
| `ats-implementation-guide` | ATS Implementation Guide: Avoiding the 7 Most Common Mistakes | 2026-01-02 | 415 | 422 | 1 | 0 | 0 | 0 | No | 0 | Noindex pending review | Thin; partly overlaps ats-optimization-guide. Needs noindex support. |
| `ats-optimization-guide` | ATS Optimization Guide: Metrics-Driven Recruiting Setup | 2026-01-14 | 1768 | 1604 | 4 | 5 | 0 | 0 | No | 0 | Improve (done) | Substantive. Statistics, anecdotes and unsourced benchmarks removed or recast. |
| `background-check-best-practices` | Background Check Best Practices for Modern Hiring Teams | 2025-12-10 | 2063 | 1769 | 8 | 6 | 0 | 0 | Yes: PBSA benchmark attributed without link; TaaSFlow-analysis claim Named without link: PBSA, Professional Background Screening. | 0 | Improve (done) | Substantive. Statistics, anecdotes and unsourced benchmarks removed or recast. |
| `behavioral-health-hiring-challenges` | Solving Behavioral Health Hiring Challenges: What to Stop Doing | 2026-02-28 | 1741 | 1446 | 8 | 9 | 0 | 0 | Yes: Benchmark attributed to an organization without link Named without link: National Council for Mental Wellbeing. | 0 | Improve (done) | Substantive. Statistics, anecdotes and unsourced benchmarks removed or recast. |
| `behavioral-interview-guide-employers` | Behavioral Interview Guide for Employers: Making the Financial Case for Structured Hiring | 2026-02-18 | 2099 | 1817 | 17 | 22 | 7 | 8 | Yes: "Historical hiring data" ROI benchmark; research coefficients without link Named without link: Schmidt. | 0 | Improve (done) | Substantive. Statistics, anecdotes and unsourced benchmarks removed or recast. |
| `biotech-startup-hiring-strategy` | Biotech Startup Hiring Strategy: The Power of Subtraction | 2025-12-24 | 1808 | 1674 | 1 | 7 | 0 | 0 | Yes: "Life science hiring data" benchmark with no source | 0 | Improve (done) | Substantive. Statistics, anecdotes and unsourced benchmarks removed or recast. |
| `blockchain-credentials-hiring` | Verifiable Digital Credentials: What They Could Mean for Hiring | 2026-03-07 | 253 | 346 | 8 | 1 | 0 | 0 | Yes: National Student Clearinghouse figure and adoption table without link; "fraud impossible" claim Named without link: National Student Clearinghouse. | 0 | Noindex pending review | Thin; speculative; owner to decide whether the topic fits positioning (TaaSFlow does not verify credentials). Needs noindex support. |
| `boomerang-employees` | Boomerang Employees: Welcoming Back Former Team Members | 2025-11-08 | 215 | 306 | 2 | 0 | 0 | 0 | No | 0 | Noindex pending review | Very thin. Needs noindex support. |
| `building-high-performance-culture-remotely` | Building High Performance Culture Remotely | 2026-03-09 | 1787 | 1764 | 3 | 0 | 0 | 0 | Yes: "Internal placement metrics at TaaSFlow" and "2025 study of 450 firms" with no source | 0 | Improve (done) | Substantive. Statistics, anecdotes and unsourced benchmarks removed or recast. |
| `building-high-performance-teams` | Building High-Performance Teams: Lessons From Well-Known Operating Models | 2026-02-27 | 371 | 433 | 0 | 0 | 0 | 0 | No Named without link: Google. | 0 | Noindex pending review | Thin; generic. Needs noindex support. |
| `building-talent-pipeline` | Building Talent Pipeline: A Practical 90-Day Rollout Plan | 2025-12-15 | 2032 | 1935 | 5 | 7 | 0 | 1 | Yes: Invented benchmark | 0 | Improve (done) | Substantive. Statistics, anecdotes and unsourced benchmarks removed or recast. |
| `candidate-communication-cadence` | Candidate Communication Cadence: Making the Business Case | 2026-01-04 | 1869 | 1726 | 7 | 12 | 0 | 5 | Yes: Talent Board claim unlinked; invented Chicago case Named without link: Glassdoor, Talent Board. | 0 | Improve (done) | Substantive. Statistics, anecdotes and unsourced benchmarks removed or recast. |
| `candidate-experience-audit-checklist` | The Candidate Experience Audit: A 50-Point Checklist for Recruiting | 2026-01-22 | 446 | 517 | 1 | 3 | 0 | 0 | No Named without link: Glassdoor, Indeed, Virgin Media. | 0 | Improve (done) | Distinct format (checklist). Slightly over 500 words. |
| `candidate-experience-competitive-weapon` | Candidate Experience Competitive Weapon: 5-Stage Playbook | 2026-02-05 | 2115 | 1805 | 0 | 0 | 0 | 0 | Yes: Invented named candidate ("Sarah") and two cities; Talent Board claim unlinked Named without link: Talent Board. | 0 | Consolidate into candidate-experience-optimization | Same intent. Invented anecdote removed. Needs noindex or redirect support. |
| `candidate-experience-matters` | Candidate Experience Matters: The CFO Guide to Recruiting ROI | 2026-01-05 | 1809 | 1721 | 26 | 16 | 13 | 10 | Yes: Invented Charlotte bank and Austin cases; Talent Board claim unlinked Named without link: Talent Board. | 0 | Consolidate into candidate-experience-optimization | Same intent (candidate experience business case). Worked arithmetic kept as labelled illustration. Needs noindex or redirect support. |
| `candidate-experience-optimization` | Candidate Experience Optimization: A Practical 90-Day Implementation Guide | 2026-01-13 | 2043 | 1915 | 3 | 7 | 2 | 0 | Yes: Invented Chicago engineer story Named without link: Glassdoor. | 0 | Improve (done) | Canonical candidate-experience post; absorbs the two posts below. |
| `candidate-ghosting-prevention` | Why Candidates Ghost, and 7 Tactics to Prevent It | 2025-12-08 | 437 | 468 | 8 | 4 | 0 | 1 | Yes: Indeed and other survey figures without link Named without link: Indeed. | 0 | Noindex pending review | Thin after cleanup; distinct intent. Needs noindex support. |
| `career-change-guide-professionals` | Career Change Guide: How Professionals Switch Industries and How Employers Can Hire Them | 2026-01-27 | 455 | 501 | 1 | 3 | 0 | 0 | No Named without link: LinkedIn data. | 0 | Consolidate into career-pivot-guide-professionals | Overlaps career-pivot guide. Needs noindex or redirect support. |
| `career-pathing-employee-retention` | Career Pathing: A Retention Strategy Built on Visible Growth | 2026-02-13 | 353 | 383 | 4 | 1 | 0 | 0 | No Named without link: LinkedIn's Workforce. | 0 | Noindex pending review | Thin; title previously made a 30% claim. Needs noindex support. |
| `career-pivot-guide-professionals` | Career Pivot Guide for Professionals: Translate Your Skills and Close the Vacancy Gap | 2026-03-10 | 1698 | 1634 | 5 | 9 | 0 | 0 | Yes: Invented "real example" teacher in Denver; invented hiring-data benchmark Named without link: Glassdoor, Google. | 0 | Improve (done) | Substantive. Statistics, anecdotes and unsourced benchmarks removed or recast. |
| `ceo-guide-talent-strategy` | CEO Guide Talent Strategy: Fixing Reactive Hiring | 2026-03-10 | 1817 | 1778 | 5 | 4 | 0 | 0 | Yes: Invented VP of Engineering scenario; "top-performing scale-ups" benchmark | 0 | Improve (done) | Substantive. Statistics, anecdotes and unsourced benchmarks removed or recast. |
| `chief-of-staff-role-guide` | Chief of Staff Role Guide: How to Hire for High-Agency Generalists | 2026-02-28 | 2195 | 2091 | 16 | 14 | 7 | 7 | Yes: "140 growth-stage firms" analysis with no source | 0 | Improve (done) | Substantive. Statistics, anecdotes and unsourced benchmarks removed or recast. |
| `chief-people-officer-evolution` | The Evolution of the Chief People Officer: From HR Admin to Strategic Partner | 2026-03-07 | 299 | 308 | 8 | 0 | 0 | 0 | Yes: "Interviews with 30 board members" with no source | 0 | Noindex pending review | Thin; opinion piece without evidence. Needs noindex support. |
| `reducing-cost-per-hire` | Cost-Per-Hire: How to Find and Fix Your True Hiring Costs | 2025-11-28 | 433 | 558 | 17 | 7 | 14 | 8 | Yes: SHRM figure without link; "TaaS clients typically see" claims; priced plan quote Named without link: SHRM. | 0 | Improve (done) | Illustrative worked example retained and labelled. |
| `reducing-time-to-hire-without-sacrificing-quality` | How to Reduce Time-to-Hire Without Sacrificing Quality | 2026-02-20 | 443 | 503 | 4 | 18 | 0 | 0 | Yes: "Our analysis of 10,000+ hiring processes" with no source | 0 | Improve (done) | Slightly under 550 words; title no longer promises "50%". |
| `reference-check-mastery` | Reference Check Mastery: Getting Honest Insights That Matter | 2026-01-22 | 247 | 269 | 1 | 0 | 0 | 0 | No | 0 | Retain (CTA labels only) | No statistics or claims; only the retired CTA block was replaced. Thin (under 300 words): needs noindex support if owner wants it out of the index. |
| `rejection-with-grace` | Rejecting Candidates With Grace: Protecting Your Brand While Saying No | 2026-01-17 | 280 | 272 | 0 | 1 | 0 | 1 | No Named without link: Glassdoor. | 0 | Retain (CTA labels only) | No statistics or claims; only the retired CTA block was replaced. Thin (under 300 words): needs noindex support if owner wants it out of the index. |
| `remote-first-compensation-guide` | Remote-First Compensation: How to Pay Fairly Across Geographies | 2026-02-24 | 1055 | 1094 | 8 | 3 | 1 | 0 | Yes: FAQ claim of "30+ countries" sourcing Named without link: Glassdoor. | 0 | Improve (done) | Pay tiers shown only as placeholders. |
| `remote-hiring-best-practices` | Remote Hiring Best Practices 2026: How to Build and Scale Distributed Teams | 2025-12-05 | 374 | 408 | 2 | 1 | 0 | 1 | No Named without link: Flex Index. | 0 | Consolidate into remote-hiring-best-practices-2026 | Duplicate intent. Needs noindex or redirect support. |
| `remote-hiring-best-practices-2026` | Remote Hiring in 2026: Best Practices for Distributed Team Building | 2026-02-02 | 394 | 466 | 6 | 1 | 0 | 0 | No Named without link: Google. | 0 | Improve (done) | Canonical remote hiring post; thin, so consider expanding. |
| `remote-interview-best-practices` | Remote Interviewing: Best Practices for Video Interviews | 2026-02-10 | 483 | 544 | 2 | 2 | 0 | 0 | No Named without link: Google. | 0 | Improve (done) | Distinct intent (video interviews). |
| `remote-vs-hybrid-talent-strategy` | Remote vs. Hybrid vs. On-Site: A Framework for Talent Strategy | 2026-02-20 | 395 | 428 | 9 | 2 | 0 | 0 | Yes: "Internal TaaS analysis of 50,000 placements" with no source | 0 | Noindex pending review | Thin after the invented analysis was removed. Needs noindex support. |
| `renewable-energy-talent-hiring` | Renewable Energy Hiring: Building the Clean Energy Workforce | 2026-01-06 | 319 | 359 | 21 | 0 | 0 | 0 | Yes: Workforce forecast, survey and wage-growth figures without link Named without link: DOE. | 0 | Noindex pending review | Thin after cleanup. Needs noindex support. |
| `retention-economics-guide` | The Economics of Retention: Why Keeping Talent Often Costs Less Than Replacing It | 2026-01-10 | 443 | 516 | 20 | 16 | 9 | 8 | Yes: SHRM figures and ROI multiples with no source Named without link: Glassdoor, SHRM. | 0 | Improve (done) | Illustrative worked example retained and labelled. |
| `return-to-office-hiring` | Return to Office: Hiring Implications of the Great Debate | 2025-11-22 | 235 | 306 | 3 | 1 | 0 | 0 | Yes: Candidate-preference survey with no source | 0 | Consolidate into return-to-office-talent-impact | Duplicate intent; thin. Needs noindex or redirect support. |
| `return-to-office-talent-impact` | Return-to-Office Mandates and Their Impact on Talent: What to Measure | 2026-02-07 | 346 | 390 | 19 | 2 | 0 | 0 | Yes: "Stanford research shows 30%" and subgroup figures with no link Named without link: Stanford. | 0 | Noindex pending review | Thin after the unsourced research was removed. Needs noindex support. |
| `revenue-operations-role-breakdown` | Revenue Operations (RevOps): The Role That Unifies Sales, Marketing and CS | 2026-02-26 | 350 | 396 | 18 | 0 | 0 | 0 | No | 0 | Noindex pending review | Thin after salary and outcome figures were removed. Needs noindex support. |
| `saas-engineering-team-scaling` | Scaling SaaS Engineering Teams: A Phase-by-Phase Hiring Guide | 2026-01-12 | 399 | 448 | 19 | 1 | 0 | 0 | No | 0 | Noindex pending review | Thin after compensation table removed. Needs noindex support. |
| `saas-go-to-market-hiring` | Building Your SaaS Go-to-Market Team: A Hiring Playbook | 2025-12-30 | 413 | 433 | 28 | 0 | 0 | 0 | No | 0 | Consolidate into saas-go-to-market-hiring-guide | Duplicate intent. Needs noindex or redirect support. |
| `saas-go-to-market-hiring-guide` | SaaS Go-to-Market Hiring: Building Revenue Teams That Scale | 2026-02-09 | 381 | 453 | 45 | 1 | 0 | 0 | No | 0 | Noindex pending review | Thin after numeric tables removed. Needs noindex support. |
| `salary-compression-guide` | Salary Compression: The Hidden Retention Risk and How to Fix It | 2026-01-28 | 430 | 430 | 10 | 3 | 0 | 0 | Yes: WorldatWork and "3.1x" figures with no link Named without link: WorldatWork. | 0 | Noindex pending review | Thin after unsourced figures removed. Needs noindex support. |
| `salary-negotiation-from-employer-perspective` | Salary Negotiation: The Employer's Guide to Fair and Effective Compensation Talks | 2026-01-18 | 393 | 399 | 3 | 1 | 0 | 0 | No | 0 | Noindex pending review | Thin. Needs noindex support. |
| `salary-negotiation-masterclass` | Salary Negotiation Masterclass: Practical Tactics and a Script | 2026-03-08 | 333 | 445 | 19 | 3 | 0 | 1 | Yes: "Study of 10,000 negotiations" with no source | 0 | Improve (done) | Fabricated study removed; now general advice. Borderline length. |
| `salary-trends-2026-comprehensive` | Salary Benchmarks: How to Build a Reliable Compensation Reference | 2026-02-21 | 364 | 361 | 137 | 0 | 0 | 0 | No | 0 | Noindex pending review | Originally a data-only salary report with no sources; now a short how-to with no data. Owner decision: delete, replace with a sourced report, or keep. Needs noindex support. |
| `sales-hiring-playbook` | A Practical Playbook for Hiring Sales Talent | 2025-12-22 | 401 | 429 | 9 | 0 | 0 | 0 | Yes: "Analysing thousands of placements" and "we verify quota achievement" claims; HubSpot figure without link Named without link: HubSpot research. | 0 | Improve (done) | Borderline length. |
| `sales-leadership-hiring` | Finding the Player-Coach Who Can Scale: Hiring Sales Leaders | 2025-12-18 | 249 | 286 | 2 | 1 | 0 | 1 | No | 0 | Consolidate into sales-leadership-hiring-playbook | Duplicate intent; thin. Needs noindex or redirect support. |
| `sales-leadership-hiring-playbook` | Hiring Sales Leaders: The VP Sales Playbook for High-Growth Companies | 2026-02-18 | 366 | 381 | 29 | 1 | 0 | 0 | No | 0 | Noindex pending review | Thin after compensation table removed; canonical for sales leadership. Consider expanding rather than noindexing. Needs noindex support. |
| `sales-team-building-guide` | Building a High-Performing Sales Team: Hiring, Compensation and Enablement | 2026-03-06 | 424 | 416 | 51 | 7 | 0 | 0 | No | 0 | Noindex pending review | Thin after salary tables removed. Needs noindex support. |
| `sdr-bdr-hiring-scaling-guide` | Scaling Your SDR/BDR Team: Hiring, Training, and Promoting Sales Development Reps | 2026-02-24 | 389 | 443 | 23 | 3 | 0 | 0 | No | 0 | Consolidate into sdr-hiring-at-scale-2026 | Duplicate intent. Needs noindex or redirect support. |
| `sdr-hiring-at-scale` | Building Your Business Development Machine: SDR Hiring at Scale | 2026-01-15 | 226 | 302 | 6 | 0 | 0 | 1 | No | 0 | Consolidate into sdr-hiring-at-scale-2026 | Duplicate intent; very thin. Needs noindex or redirect support. |
| `sdr-hiring-at-scale-2026` | SDR Hiring at Scale: Building a Predictable Pipeline Machine | 2026-03-04 | 1220 | 1120 | 26 | 8 | 0 | 0 | Yes: Churn, cost and conversion figures and FAQ claims about TaaS plan tiers | 0 | Improve (done) | Substantive. Statistics, anecdotes and unsourced benchmarks removed or recast. |
| `second-chance-hiring-guide` | Second-Chance Hiring: The Business Case for Fair-Chance Employment | 2025-11-28 | 323 | 388 | 8 | 2 | 0 | 0 | Yes: "77 million", manager-survey and WOTC figures without link | 0 | Noindex pending review | Thin after unsourced figures removed. Needs noindex support. |
| `series-a-gtm-team-building` | Series A to B: Building Your First Go-to-Market Team | 2026-02-28 | 1073 | 1043 | 44 | 4 | 0 | 0 | Yes: Cost-of-mistake and compensation figures; FAQ claim of "5-8 candidates per position within days" | 0 | Improve (done) | Substantive. Statistics, anecdotes and unsourced benchmarks removed or recast. |
| `skilled-trades-hiring-crisis` | The Skilled Trades Hiring Crisis: How Construction Employers Are Responding | 2026-02-10 | 309 | 342 | 33 | 1 | 0 | 0 | Yes: ABC workforce figure and wage tables without link Named without link: Associated Builders. | 0 | Noindex pending review | Thin after unsourced wage and workforce figures removed. Needs noindex support. |
| `skills-based-hiring-implementation` | Skills-Based Hiring: How to Drop Degree Requirements Without Lowering the Bar | 2026-01-15 | 506 | 587 | 5 | 4 | 0 | 0 | Yes: Named-company outcomes and a validity coefficient without link; "evidence" table Named without link: Google. | 0 | Improve (done) | Canonical skills-based hiring post. |
| `skills-based-hiring-revolution` | Skills-Based Hiring: Moving Beyond Degrees and Pedigree | 2026-01-20 | 266 | 343 | 2 | 0 | 0 | 0 | Yes: Named-company claim; "30% of our model" internal scoring detail Named without link: Google. | 0 | Consolidate into skills-based-hiring-implementation | Duplicate intent; thin. Needs noindex or redirect support. |
| `skills-based-organizations-future` | Skills-Based Organizations: Why Job Titles Matter Less Than Skills | 2026-03-08 | 302 | 372 | 15 | 2 | 0 | 0 | Yes: Deloitte figures and comparison table without link Named without link: Deloitte. | 0 | Noindex pending review | Thin after unsourced figures removed. Needs noindex support. |
| `skills-gap-analysis-guide` | Skills Gap Analysis: How to Identify and Close Your Team's Capability Gaps | 2026-01-28 | 354 | 396 | 1 | 1 | 0 | 0 | No Named without link: World Economic Forum. | 0 | Noindex pending review | Thin. Needs noindex support. |
| `skills-taxonomy-building-guide` | Building a Skills Taxonomy: The Foundation of Modern Workforce Intelligence | 2026-02-25 | 428 | 449 | 3 | 1 | 0 | 0 | No Named without link: Deloitte. | 0 | Noindex pending review | Thin. Needs noindex support. |
| `what-is-talent-as-a-service` | What Is Talent as a Service (TaaS)? The Complete Guide | 2026-09-10 | 1504 | 1599 | 0 | 0 | 0 | 0 | No | 0 | Improve (done) | Substantive. Statistics, anecdotes and unsourced benchmarks removed or recast. |

## Needs noindex support

`src/routes/blog.$slug.tsx` builds its head from `marketingHead(...)` without passing the `robots` option, and no blog JSON field or manifest entry carries a robots flag. `marketingHead` already accepts `robots`, so the missing piece is a per-slug lookup (for example a `NOINDEX_BLOG_SLUGS` list in `blog-manifest.ts` read by the route). That is route and manifest code, out of scope for this pass, so nothing was marked. The posts below are waiting on that support or on a redirect decision.

### Consolidate (13)

- `accounting-talent-shortage-big-four`: Consolidate into accounting-talent-shortage-solutions
- `accounting-talent-shortage-guide`: Consolidate into accounting-talent-shortage-solutions
- `ai-reshaping-every-industry-hiring`: Consolidate into ai-impact-on-jobs-hiring
- `candidate-experience-competitive-weapon`: Consolidate into candidate-experience-optimization
- `candidate-experience-matters`: Consolidate into candidate-experience-optimization
- `career-change-guide-professionals`: Consolidate into career-pivot-guide-professionals
- `remote-hiring-best-practices`: Consolidate into remote-hiring-best-practices-2026
- `return-to-office-hiring`: Consolidate into return-to-office-talent-impact
- `saas-go-to-market-hiring`: Consolidate into saas-go-to-market-hiring-guide
- `sales-leadership-hiring`: Consolidate into sales-leadership-hiring-playbook
- `sdr-bdr-hiring-scaling-guide`: Consolidate into sdr-hiring-at-scale-2026
- `sdr-hiring-at-scale`: Consolidate into sdr-hiring-at-scale-2026
- `skills-based-hiring-revolution`: Consolidate into skills-based-hiring-implementation

### Noindex pending review (26)

- `accounting-firm-recruitment-strategies`
- `ai-screening-ethics`
- `ambient-computing-workplace-transformation`
- `ats-implementation-guide`
- `blockchain-credentials-hiring`
- `boomerang-employees`
- `building-high-performance-teams`
- `candidate-ghosting-prevention`
- `career-pathing-employee-retention`
- `chief-people-officer-evolution`
- `remote-vs-hybrid-talent-strategy`
- `renewable-energy-talent-hiring`
- `return-to-office-talent-impact`
- `revenue-operations-role-breakdown`
- `saas-engineering-team-scaling`
- `saas-go-to-market-hiring-guide`
- `salary-compression-guide`
- `salary-negotiation-from-employer-perspective`
- `salary-trends-2026-comprehensive`
- `sales-leadership-hiring-playbook`
- `sales-team-building-guide`
- `second-chance-hiring-guide`
- `skilled-trades-hiring-crisis`
- `skills-based-organizations-future`
- `skills-gap-analysis-guide`
- `skills-taxonomy-building-guide`

### Under 500 words after cleanup (41)

`accounting-firm-recruitment-strategies`, `accounting-talent-shortage-big-four`, `accounting-talent-shortage-guide`, `ai-reshaping-every-industry-hiring`, `ai-screening-ethics`, `ambient-computing-workplace-transformation`, `ats-implementation-guide`, `blockchain-credentials-hiring`, `boomerang-employees`, `building-high-performance-teams`, `candidate-ghosting-prevention`, `career-pathing-employee-retention`, `chief-people-officer-evolution`, `reference-check-mastery`, `rejection-with-grace`, `remote-hiring-best-practices`, `remote-hiring-best-practices-2026`, `remote-vs-hybrid-talent-strategy`, `renewable-energy-talent-hiring`, `return-to-office-hiring`, `return-to-office-talent-impact`, `revenue-operations-role-breakdown`, `saas-engineering-team-scaling`, `saas-go-to-market-hiring`, `saas-go-to-market-hiring-guide`, `salary-compression-guide`, `salary-negotiation-from-employer-perspective`, `salary-negotiation-masterclass`, `salary-trends-2026-comprehensive`, `sales-hiring-playbook`, `sales-leadership-hiring`, `sales-leadership-hiring-playbook`, `sales-team-building-guide`, `sdr-bdr-hiring-scaling-guide`, `sdr-hiring-at-scale`, `second-chance-hiring-guide`, `skilled-trades-hiring-crisis`, `skills-based-hiring-revolution`, `skills-based-organizations-future`, `skills-gap-analysis-guide`, `skills-taxonomy-building-guide`
