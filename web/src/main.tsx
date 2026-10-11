import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// 离线字体（自托管，无 CDN）
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";

import "@/styles/index.css";
import { App } from "@/App";

const container = document.getElementById("root");
if (!container) {
  throw new Error("找不到 #root 挂载点");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
