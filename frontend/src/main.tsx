import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./lib/theme";
import { AuthProvider } from "./lib/auth";
import { ErreurApi } from "./lib/api";
import App from "./App";
import "./index.css";

const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: (tentative, erreur) => {
        // Inutile d'insister sur une erreur d'authentification ou de saisie.
        if (erreur instanceof ErreurApi && erreur.status < 500 && erreur.status !== 429) return false;
        return tentative < 2;
      },
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
