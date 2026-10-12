import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { APP_NAME } from "./routes";
import "./styles/theme.css";
import "./styles/app.css";
// The page gutters for the frame's bare content band (loaded last, so these
// rules sit after the template's own stylesheet).
import "./layout.css";

document.title = APP_NAME;

const container = document.getElementById("root");
if (!container) {
  throw new Error('Unable to start the app: no element with id "root" was found.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
