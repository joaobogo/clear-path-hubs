import recruiting from "@/assets/page-recruiting-service.jpg";
import committee from "@/assets/page-enterprise-team.jpg";
import recruiter from "@/assets/page-recruiter-evidence.jpg";
import founders from "@/assets/page-founders-team.jpg";
import agents from "@/assets/page-agents-hero.jpg";

export const BUYER_PAGE_PHOTOGRAPHS: Record<string, { src: string; alt: string; width: number; height: number }> = {
  "flat-fee-recruiting": { src: founders, alt: "A founder-led team discussing its next hire together.", width: 1920, height: 1088 },
  "subscription-recruiting": { src: committee, alt: "A hiring committee reviewing its recruiting needs and application documents.", width: 1920, height: 1088 },
  "recruitment-agency-alternative": { src: recruiting, alt: "Recruiting colleagues reviewing evidence and sourcing candidates at a shared desk.", width: 1920, height: 1088 },
  "ai-recruiting-agency": { src: agents, alt: "A recruiter checking candidate evidence while sourcing tools run at her desk.", width: 1600, height: 1008 },
  "recruiting-as-a-service": { src: recruiter, alt: "A senior recruiter reviewing applications against a hiring brief.", width: 1920, height: 1088 },
};