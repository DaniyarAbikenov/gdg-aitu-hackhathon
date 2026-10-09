import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import { i18nReady } from "./i18n/config";
import App from "./app/App";
import { queryClient } from "./app/queryClient";

const root = createRoot(document.getElementById("root")!);
const render = () =>
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );
// A failed translation download still renders the app rather than a blank page.
i18nReady.then(render, render);
