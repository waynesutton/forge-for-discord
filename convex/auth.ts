// Robel Convex Auth setup. Upstream:
// https://auth.estifanos.com/getting-started/installation/
//
// `@robelest/convex-auth@0.0.4-preview.29` ships first-party provider factories
// (lowercase: `github`, `google`, `apple`, `microsoft`, etc.). GitHub handles
// its own profile + email fetch internally, so no `profile` callback needed.
import { createAuth } from "@robelest/convex-auth/component";
import { github } from "@robelest/convex-auth/providers/github";
import { components } from "./_generated/api";

export const auth = createAuth(components.auth, {
  providers: [
    github({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
  ],
});

export const { signIn, signOut, store } = auth;
