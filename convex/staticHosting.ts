// Expose internal upload and deployment APIs from @convex-dev/static-hosting.
// These functions are only callable via `npx convex run`, which the component's
// CLI uses during deploy. They are not accessible from the public internet.
// The `getCurrentDeployment` query is used by the optional update banner on
// the frontend to notify connected users when a new build ships.
import {
  exposeUploadApi,
  exposeDeploymentQuery,
} from "@convex-dev/static-hosting";
import { components } from "./_generated/api";

export const { generateUploadUrl, recordAsset, gcOldAssets, listAssets } =
  exposeUploadApi(components.selfHosting);

export const { getCurrentDeployment } = exposeDeploymentQuery(
  components.selfHosting,
);
