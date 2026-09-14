import "./styles.css";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/frontend/lib/api";
import { ConfirmProvider } from "@/frontend/ui";
import { router } from "./routes/router";

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <ConfirmProvider>
      <RouterProvider router={router} />
    </ConfirmProvider>
  </QueryClientProvider>,
);
