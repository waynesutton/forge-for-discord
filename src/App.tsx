import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router";
import { SignIn } from "./components/auth/SignIn";
import { Protected } from "./components/auth/Protected";
import { Dashboard } from "./pages/Dashboard";
import { Docs } from "./pages/Docs";
import { EditForm } from "./pages/EditForm";
import { FormLogs } from "./pages/FormLogs";
import { FormResults } from "./pages/FormResults";
import { Forms } from "./pages/Forms";
import { NewForm } from "./pages/NewForm";
import { Settings } from "./pages/Settings";
import { AccessDenied } from "./pages/AccessDenied";

// Top-level router. The homepage at `/` renders the SignIn component so that
// signing out lands cleanly on the public landing surface (instead of
// `/auth/sign-in`). When SignIn sees an authenticated session it short-circuits
// with <Navigate to="/app" />, so returning admins still end up in the app.
// `/auth/sign-in` is kept as an alias for backward compatibility with links
// that might still point at it.
//
// `/docs` and `/docs/:slug` are public so anyone evaluating Forge can read the
// setup guide without signing in. Authenticated admins see the same page with
// a "Back to dashboard" link injected by the component.
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SignIn />} />
        <Route path="/auth/sign-in" element={<SignIn />} />
        <Route path="/auth/denied" element={<AccessDenied />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/docs/:slug" element={<Docs />} />
        <Route path="/app/docs" element={<Navigate to="/docs" replace />} />
        <Route
          path="/app/docs/:slug"
          element={<RedirectAppDocs />}
        />
        <Route element={<Protected />}>
          <Route path="/app" element={<Dashboard />} />
          <Route path="/app/forms" element={<Forms />} />
          <Route path="/app/forms/new" element={<NewForm />} />
          <Route path="/app/forms/:formId" element={<EditForm />} />
          <Route path="/app/forms/:formId/results" element={<FormResults />} />
          <Route path="/app/forms/:formId/logs" element={<FormLogs />} />
          <Route path="/app/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// Back-compat redirect. Old deep links that point at `/app/docs/:slug`
// forward to the public `/docs/:slug` surface so shared URLs keep working.
function RedirectAppDocs() {
  const { slug } = useParams<{ slug?: string }>();
  return <Navigate to={slug ? `/docs/${slug}` : "/docs"} replace />;
}
