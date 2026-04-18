import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { SignIn } from "./components/auth/SignIn";
import { Protected } from "./components/auth/Protected";
import { Dashboard } from "./pages/Dashboard";
import { EditForm } from "./pages/EditForm";
import { FormLogs } from "./pages/FormLogs";
import { FormResults } from "./pages/FormResults";
import { Forms } from "./pages/Forms";
import { NewForm } from "./pages/NewForm";
import { Settings } from "./pages/Settings";
import { AccessDenied } from "./pages/AccessDenied";

// Top-level router. Phase 1 ships three routes: root redirect, sign-in, and a
// gated /app branch. Phase 2 nests the forms, mod queue, and settings routes
// underneath <Protected /> so they inherit the auth gate for free.
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/auth/sign-in" element={<SignIn />} />
        <Route path="/auth/denied" element={<AccessDenied />} />
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
