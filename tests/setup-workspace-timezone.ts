import { setWorkspaceTimezone } from "@/lib/format/datetime";

// Every date assertion in the suite is written from the workspace's own clock,
// so the tests run pinned to it instead of the machine's zone.
setWorkspaceTimezone("America/Sao_Paulo");
