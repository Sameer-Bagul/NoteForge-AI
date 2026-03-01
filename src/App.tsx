import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { SettingsProvider } from "@/context/SettingsContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { SettingsPanel } from "@/components/SettingsPanel";
import Layout from "./components/Layout";
import Create from "./pages/Create";
import Library from "./pages/Library";
import NotebookView from "./pages/NotebookView";
import Process from "./pages/Process";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<Create />} />
                  <Route path="/process/:jobId" element={<Process />} />
                  <Route path="/library" element={<Library />} />
                  <Route path="/notebook/:id" element={<NotebookView />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </BrowserRouter>
            {/* Global Settings Panel overlay */}
            <SettingsPanel />
          </TooltipProvider>
        </ThemeProvider>
      </SettingsProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
