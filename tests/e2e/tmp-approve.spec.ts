import { test } from "@playwright/test";
import { loginAs, seedFixtures, createCvApplication, runPipelineForMatch, pipelineSnapshot, QA_PASSWORD } from "./helpers/qa";
function pdf(lines: string[]) {
  const content = ["BT","/F1 11 Tf","14 TL","40 760 Td",...lines.map(l=>`(${l}) Tj T*`),"ET"].join("\n");
  const objs = ["<</Type/Catalog/Pages 2 0 R>>","<</Type/Pages/Kids[3 0 R]/Count 1>>","<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>",`<</Length ${content.length}>>\nstream\n${content}\nendstream`,"<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>"];
  let out = "%PDF-1.4\n"; const offs:number[]=[];
  objs.forEach((o,i)=>{offs.push(out.length); out += `${i+1} 0 obj\n${o}\nendobj\n`;});
  const x = out.length;
  out += `xref\n0 ${objs.length+1}\n0000000000 65535 f \n` + offs.map(o=>`${String(o).padStart(10,"0")} 00000 n \n`).join("") + `trailer\n<</Size ${objs.length+1}/Root 1 0 R>>\nstartxref\n${x}\n%%EOF`;
  return Buffer.from(out, "latin1").toString("base64");
}
test("dbg approve", async ({ page }) => {
  const f = await seedFixtures();
  const stamp = Date.now();
  const created = await createCvApplication({ positionId: f.position_id, email: `qa+apply-APR${stamp}@taasflow.test`, fullName: `QA Approve ${stamp}`,
    cvBase64: pdf([
      "QA Approve - Client Success Manager, EMEA",
      "Seven years of professional experience owning mid-market B2B SaaS accounts.",
      "Currently responsible for 24 accounts worth EUR 1.8M ARR at 109% net revenue retention.",
      "Runs onboarding, quarterly business reviews and renewal negotiation end to end.",
      "Skills: account management, renewals, QBRs, HubSpot, Zendesk, churn analysis.",
      "Senior Client Success Manager - Solvia Software, Lisbon, 2021-04 to present.",
      "Client Success Manager - Beacon Analytics, Lisbon, 2018-09 to 2021-03.",
      "Education: BA Management, ISCTE Lisbon, 2014-2017.",
    ]), cvFilename: "apr.pdf" });
  await runPipelineForMatch(created.candidate_match_id);
  console.log("state", JSON.stringify((await pipelineSnapshot(created.candidate_match_id)).match));
  const bad: string[] = [];
  page.on("console", (m) => bad.push(`${m.type()}: ${m.text().slice(0,300)}`));
  page.on("pageerror", (e) => bad.push("pageerror: "+String(e).slice(0,400)));
  await loginAs(page, "admin", f.users["platform_admin"]!.email, QA_PASSWORD);
  await page.goto(`/admin/candidates/${created.candidate_match_id}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  const btn = page.locator('[data-qa-action="primary-approve-score"]');
  console.log("count", await btn.count(), "disabled", await btn.first().isDisabled().catch(()=>"n/a"), "label", await btn.first().textContent().catch(()=>""));
  await btn.first().click();
  await page.waitForTimeout(7000);
  console.log("after", JSON.stringify((await pipelineSnapshot(created.candidate_match_id)).match));
  console.log("failure panel", await page.locator('[data-qa="approve-failure"]').textContent().catch(()=>"none"));
  console.log("preflight", await page.locator('[data-qa="approve-preflight-block"]').textContent().catch(()=>"none"));
  console.log("SIGNALS\n"+bad.filter(b=>b.startsWith("error")||b.startsWith("pageerror")).join("\n"));
});
