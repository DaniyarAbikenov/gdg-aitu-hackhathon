import { tr, useLocale } from "@/i18n/copy";
import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GuestOnlyRoute } from "./GuestOnlyRoute";
import { ProtectedRoute } from "./ProtectedRoute";
const Login = lazy(() => import("@/features/auth/pages/Login"));
const Register = lazy(() => import("@/features/auth/pages/Register"));
const ForgotPassword = lazy(
  () => import("@/features/auth/pages/ForgotPassword"),
);
const ResetPassword = lazy(() => import("@/features/auth/pages/ResetPassword"));
const VerifyEmail = lazy(() => import("@/features/auth/pages/VerifyEmail"));
const Onboarding = lazy(() => import("@/features/profile/pages/Onboarding"));
const Settings = lazy(() => import("@/features/profile/pages/Settings"));
const Companies = lazy(() => import("@/features/applications/pages/Companies"));
const Applications = lazy(
  () => import("@/features/applications/pages/Applications"),
);
const Index = lazy(() => import("@/features/home/pages/Index"));
const NotFound = lazy(() => import("@/features/home/pages/NotFound"));
const Dashboard = lazy(() => import("@/features/dashboard/pages/Dashboard"));
const Resume = lazy(() => import("@/features/resume/pages/Resume"));
const ResumeCreate = lazy(() => import("@/features/resume/pages/ResumeCreate"));
const ResumeVersions = lazy(
  () => import("@/features/resume/pages/ResumeVersions"),
);
const ResumeGenerate = lazy(
  () => import("@/features/resume/pages/ResumeGenerate"),
);
const ResumeImprove = lazy(
  () => import("@/features/resume/pages/ResumeImprove"),
);
const ResumeEdit = lazy(() => import("@/features/resume/pages/ResumeEdit"));
const ImprovementsPage = lazy(
  () => import("@/features/resume/pages/ImprovementsPage"),
);
const Plan = lazy(() => import("@/features/learning/pages/Plan"));
const Progress = lazy(() => import("@/features/progress/pages/Progress"));
const InterviewStart = lazy(
  () => import("@/features/interview/pages/InterviewStart"),
);
const InterviewSession = lazy(
  () => import("@/features/interview/pages/InterviewSession"),
);
const InterviewResult = lazy(
  () => import("@/features/interview/pages/InterviewResult"),
);
const InterviewSummary = lazy(
  () => import("@/features/interview/pages/InterviewSummary"),
);
const VoiceInterview = lazy(
  () => import("@/features/interview/pages/VoiceInterview"),
);
const KnowledgeAdmin = lazy(
  () => import("@/features/knowledge/pages/KnowledgeAdmin"),
);
const LegalPolicies = lazy(
  () => import("@/features/knowledge/pages/LegalPolicies"),
);
const Support = lazy(() => import("@/features/knowledge/pages/Support"));
const FAQ = lazy(() => import("@/features/knowledge/pages/FAQ"));

const App = () => {
  useLocale();
  return (
    <>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense
            fallback={
              <div className="p-8" role="status">
                {tr("copy.c000")}
              </div>
            }
          >
            <Routes>
              <Route
                path="/companies"
                element={
                  <ProtectedRoute>
                    <Companies />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/applications"
                element={
                  <ProtectedRoute>
                    <Applications />
                  </ProtectedRoute>
                }
              />
              <Route path="/about" element={<Index />} />
              <Route
                path="/resume/new"
                element={
                  <ProtectedRoute>
                    <ResumeCreate />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/knowledge"
                element={
                  <ProtectedRoute>
                    <KnowledgeAdmin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/interview/voice"
                element={
                  <ProtectedRoute>
                    <VoiceInterview />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/login"
                element={
                  <GuestOnlyRoute>
                    <Login />
                  </GuestOnlyRoute>
                }
              />

              <Route
                path="/forgot-password"
                element={
                  <GuestOnlyRoute>
                    <ForgotPassword />
                  </GuestOnlyRoute>
                }
              />
              {/* Links from email work whether or not the reader is signed in. */}
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
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

              <Route path="/" element={<Index />} />
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
};

export default App;
