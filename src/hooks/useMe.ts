import { useOutletContext } from "react-router";
import type { Doc } from "../../convex/_generated/dataModel";

// Child routes under <Protected /> read the current user from the outlet
// context instead of re-querying Convex. Keeps the /app subtree cheap and lets
// every page assume a non-null user.
export type ProtectedContext = { me: Doc<"users"> };

export function useMe(): Doc<"users"> {
  return useOutletContext<ProtectedContext>().me;
}
