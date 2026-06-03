import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { LootEffectProvider } from "./effects/LootEffectProvider.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LootEffectProvider>
      <App />
    </LootEffectProvider>
  </StrictMode>,
);
