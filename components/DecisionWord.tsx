import { decisionLabel } from "@/lib/rank";
import type { Decision } from "@/lib/types";

export function DecisionWord({ decision }: { decision: Decision }) {
  return <span className={`decision ${decision}`}>{decisionLabel(decision)}</span>;
}
