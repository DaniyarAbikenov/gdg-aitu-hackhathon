import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
const Login = lazy(() => import("./pages/Login"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Resume = lazy(() => import("./pages/Resume"));
const ResumeVersions = lazy(() => import("./pages/ResumeVersions"));
const Plan = lazy(() => import("./pages/Plan"));
const InterviewSession = lazy(() => import("./pages/InterviewSession"));
const Progress = lazy(() => import("./pages/Progress"));
const Settings = lazy(() => import("./pages/Settings"));
const LegalPolicies = lazy(() => import("./pages/LegalPolicies"));
const Support = lazy(() => import("./pages/Support"));
const FAQ = lazy(() => import("./pages/FAQ"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Register = lazy(() => import("@/pages/Register.tsx"));
import { GuestOnlyRoute } from "@/routes/GuestOnlyRoute.tsx";
import { ProtectedRoute } from "@/routes/ProtectedRoute.tsx";
const ResumeGenerate = lazy(() => import("@/pages/ResumeGenerate.tsx"));
const ResumeImprove = lazy(() => import("@/pages/ResumeImprove.tsx"));
const ResumeEdit = lazy(() => import("@/pages/ResumeEdit.tsx"));
const ImprovementsPage = lazy(() => import("@/pages/ImprovementsPage.tsx"));
const InterviewStart = lazy(() => import("@/pages/InterviewStart.tsx"));
const InterviewResult = lazy(() => import("@/pages/InterviewResult.tsx"));
const InterviewSummary = lazy(() => import("@/pages/InterviewSummary.tsx"));

const App = () => (
  <>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="p-8" role="status">
              Загрузка…
            </div>
          }
        >
          <Routes>
            <Route
              path="/login"
              element={
                <GuestOnlyRoute>
                  <Login />
                </GuestOnlyRoute>
              }
            />

            <Route
              path="/register"
              element={
                <GuestOnlyRoute>
                  <Register />
                </GuestOnlyRoute>
              }
            />

            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              }
            />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/resume"
              element={
                <ProtectedRoute>
                  <Resume />
                </ProtectedRoute>
              }
            />
            <Route
              path="/resume/:resumeId"
              element={
                <ProtectedRoute>
                  <ResumeVersions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/plan"
              element={
                <ProtectedRoute>
                  <Plan />
                </ProtectedRoute>
              }
            />
            <Route
              path="/plan/:planId"
              element={
                <ProtectedRoute>
                  <Plan />
                </ProtectedRoute>
              }
            />
            {/*<Route path="/interview" element={*/}
            {/*    <ProtectedRoute>*/}
            {/*        <Interview/>*/}
            {/*    </ProtectedRoute>}/>*/}
            {/*<Route path="/interview/session/:sessionId" element={*/}
            {/*    <ProtectedRoute>*/}
            {/*        <InterviewSession/>*/}
            {/*    </ProtectedRoute>}/>*/}
            <Route
              path="/progress"
              element={
                <ProtectedRoute>
                  <Progress />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />

            <Route
              path="/resume/:resumeId/edit"
              element={
                <ProtectedRoute>
                  <ResumeEdit />
                </ProtectedRoute>
              }
            />

            <Route
              path="/resume/:resumeId/improve"
              element={
                <ProtectedRoute>
                  <ResumeImprove />
                </ProtectedRoute>
              }
            />

            <Route
              path="/resume/:resumeId/generate"
              element={
                <ProtectedRoute>
                  <ResumeGenerate />
                </ProtectedRoute>
              }
            />
            <Route
              path="/resume/:resumeId/improvements"
              element={
                <ProtectedRoute>
                  <ImprovementsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interview/start"
              element={
                <ProtectedRoute>
                  <InterviewStart />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interview"
              element={
                <ProtectedRoute>
                  <InterviewStart />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interview/session"
              element={
                <ProtectedRoute>
                  <InterviewSession />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interview/result"
              element={
                <ProtectedRoute>
                  <InterviewResult />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interview/summary"
              element={
                <ProtectedRoute>
                  <InterviewSummary />
                </ProtectedRoute>
              }
            />

            <Route path="/support" element={<Support />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/legal/policies" element={<LegalPolicies />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </>
);

export default App;
