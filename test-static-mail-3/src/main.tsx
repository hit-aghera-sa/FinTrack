import '../design/tokens.css';
import './styles/tokens.css';
import '../design/base.css';
import './styles/base.css';
import './styles/index.css';
import './styles/app.css';
import './styles/main.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/quicklist.css';
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.js";

// The stylesheet(s) are owned by the design lane under src/styles/**; load
// whatever it ships without hard-coding a filename this lane does not own.
const stylesheetModules = import.meta.glob("./styles/**/*.css", { eager: true });

const container = document.getElementById("root");

if (!container) {
  throw new Error("QuickList could not start: #root is missing from index.html");
}

container.dataset.stylesheetCount = String(Object.keys(stylesheetModules).length);

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
