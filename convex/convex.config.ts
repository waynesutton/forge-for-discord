// Register Convex components on the app. Both components own their own tables,
// HTTP routes, and internal functions, exposed through `components.auth` and
// `components.staticHosting` in other files.
import { defineApp } from "convex/server";
import auth from "@robelest/convex-auth/convex.config";
import staticHosting from "@convex-dev/static-hosting/convex.config";

const app = defineApp();
app.use(auth);
app.use(staticHosting);

export default app;
