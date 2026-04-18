import { ConvexReactClient } from "convex/react";

// Singleton Convex client. Shared by ConvexProvider and the Robel auth client so
// they both read from the same WebSocket connection and token state.
const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  throw new Error(
    "VITE_CONVEX_URL is missing. Run `npx convex dev` to create a deployment and copy the URL into .env.local.",
  );
}

export const convex = new ConvexReactClient(convexUrl);
