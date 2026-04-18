import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider } from "convex/react";
import { App } from "./App";
import { convex } from "./lib/convex";
// Side-effect import: constructing the auth client wires `convex.setAuth(...)`
// before the first ConvexProvider render so gated queries never flash.
import "./lib/auth";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </StrictMode>,
);
