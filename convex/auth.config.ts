// Tell Convex which JWT issuer to trust when verifying `ctx.auth` tokens.
// Robel signs JWTs with:
//   iss = CONVEX_SITE_URL (e.g. https://honorable-mammoth-130.convex.site)
//   aud = "convex"
// and serves JWKS at `${CONVEX_SITE_URL}/.well-known/jwks.json`.
// See: node_modules/@robelest/convex-auth/dist/server/tokens.js
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL!,
      applicationID: "convex",
    },
  ],
};
