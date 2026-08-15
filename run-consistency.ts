import { runConsistencyCheck } from "./src/lib/qa/consistency.server";

async function main() {
  console.log("Starting consistency check...");
  try {
    const results = await runConsistencyCheck();
    console.log("CONSISTENCY CHECK RESULTS:");
    console.log(JSON.stringify(results, null, 2));
    
    // Assert basic consistency
    const failures = [];
    if (!results.a_client_alignment.every((c: any) => c.consistent)) failures.push("Client alignment failure");
    if (!results.b_exception_digest.consistent) failures.push("Exception digest inconsistency");
    if (!results.c_public_board.ruleAsserted) failures.push("Public board rule not asserted");
    if (!results.d_scoring_vs_publish.consistent) failures.push("Scoring vs Publish inconsistency");
    
    if (failures.length > 0) {
      console.error("CONSISTENCY CHECK FAILED:", failures.join(", "));
      process.exit(1);
    } else {
      console.log("ALL CONSISTENCY CHECKS PASSED.");
    }
  } catch (error) {
    console.error("Execution error:", error);
    process.exit(1);
  }
}

main();
