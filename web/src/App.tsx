import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { queryClient } from "@/lib/query";
import { ThemeProvider } from "@/store/theme";
import { SettingsProvider } from "@/store/settings";
import { VoiceProvider } from "@/store/voice";
import { PlayerProvider } from "@/store/player";
import { TasksProvider } from "@/store/tasks";
import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "@/components/ui/toaster";
import { SynthesizePage } from "@/pages/SynthesizePage";
import { VoicesPage } from "@/pages/VoicesPage";
import { ReferencesPage } from "@/pages/ReferencesPage";
import { LabelPage } from "@/pages/LabelPage";
import { TrainPage } from "@/pages/TrainPage";
import { ToolsPage } from "@/pages/ToolsPage";
import { JobsPage } from "@/pages/JobsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

const BASE_PATH = import.meta.env.VITE_BASE_PATH ?? "/";

export function App() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <QueryClientProvider client={queryClient}>
          <VoiceProvider>
            <PlayerProvider>
              <TasksProvider>
                <BrowserRouter basename={BASE_PATH}>
                  <Routes>
                    <Route element={<AppShell />}>
                      <Route index element={<Navigate to="/synthesize" replace />} />
                      <Route path="/synthesize" element={<SynthesizePage />} />
                      <Route path="/voices" element={<VoicesPage />} />
                      <Route path="/voices/references" element={<ReferencesPage />} />
                      <Route path="/label" element={<LabelPage />} />
                      <Route path="/train" element={<TrainPage />} />
                      <Route path="/tools" element={<ToolsPage />} />
                      <Route path="/jobs" element={<JobsPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="*" element={<NotFoundPage />} />
                    </Route>
                  </Routes>
                </BrowserRouter>
                <Toaster />
              </TasksProvider>
            </PlayerProvider>
          </VoiceProvider>
        </QueryClientProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
