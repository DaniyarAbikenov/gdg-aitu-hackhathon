import {Toaster} from "@/components/ui/toaster";
import {Toaster as Sonner} from "@/components/ui/sonner";
import {TooltipProvider} from "@/components/ui/tooltip";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {BrowserRouter, Routes, Route, Navigate} from "react-router-dom";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Resume from "./pages/Resume";
import ResumeVersions from "./pages/ResumeVersions";
import Plan from "./pages/Plan";
import InterviewSession from "./pages/InterviewSession";
import Progress from "./pages/Progress";
import Settings from "./pages/Settings";
import LegalPolicies from "./pages/LegalPolicies";
import Support from "./pages/Support";
import FAQ from "./pages/FAQ";
import NotFound from "./pages/NotFound";
import Register from "@/pages/Register.tsx";
import {GuestOnlyRoute} from "@/routes/GuestOnlyRoute.tsx";
import {ProtectedRoute} from "@/routes/ProtectedRoute.tsx";
import ResumeGenerate from "@/pages/ResumeGenerate.tsx";
import ResumeImprove from "@/pages/ResumeImprove.tsx";
import ResumeEdit from "@/pages/ResumeEdit.tsx";
import ImprovementsPage from "@/pages/ImprovementsPage.tsx";
import InterviewStart from "@/pages/InterviewStart.tsx";
import InterviewResult from "@/pages/InterviewResult.tsx";
import InterviewSummary from "@/pages/InterviewSummary.tsx";

const queryClient = new QueryClient();

const App = () => (
    <QueryClientProvider client={queryClient}>
        <TooltipProvider>
            <Toaster/>
            <Sonner/>
            <BrowserRouter>
                <Routes>
                    <Route
                        path="/login"
                        element={
                            <GuestOnlyRoute>
                                <Login/>
                            </GuestOnlyRoute>
                        }
                    />

                    <Route
                        path="/register"
                        element={
                            <GuestOnlyRoute>
                                <Register/>
                            </GuestOnlyRoute>
                        }
                    />

                    <Route
                        path="/onboarding"
                        element={
                            <ProtectedRoute>
                                <Onboarding/>
                            </ProtectedRoute>
                        }
                    />


                    <Route
                        path="/"
                        element={
                            <ProtectedRoute>
                                <Dashboard/>
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard"
                        element={
                            <ProtectedRoute>
                                <Dashboard/>
                            </ProtectedRoute>
                        }
                    />

                    <Route path="/resume" element={
                        <ProtectedRoute>
                            <Resume/>
                        </ProtectedRoute>}/>
                    <Route path="/resume/:resumeId" element={
                        <ProtectedRoute>
                            <ResumeVersions/>
                        </ProtectedRoute>
                    }/>
                    <Route path="/plan/:planId" element={
                        <ProtectedRoute>
                            <Plan/>
                        </ProtectedRoute>}/>
                    {/*<Route path="/interview" element={*/}
                    {/*    <ProtectedRoute>*/}
                    {/*        <Interview/>*/}
                    {/*    </ProtectedRoute>}/>*/}
                    {/*<Route path="/interview/session/:sessionId" element={*/}
                    {/*    <ProtectedRoute>*/}
                    {/*        <InterviewSession/>*/}
                    {/*    </ProtectedRoute>}/>*/}
                    <Route path="/progress" element={
                        <ProtectedRoute>
                            <Progress/>
                        </ProtectedRoute>
                    }/>
                    <Route path="/settings" element={
                        <ProtectedRoute>
                            <Settings/>
                        </ProtectedRoute>}/>
                    <Route
                        path="/resume"
                        element={
                            <ProtectedRoute>
                                <Resume/>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/resume/:resumeId/edit"
                        element={
                            <ProtectedRoute>
                                <ResumeEdit/>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/resume/:resumeId/improve"
                        element={
                            <ProtectedRoute>
                                <ResumeImprove/>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/resume/:resumeId/generate"
                        element={
                            <ProtectedRoute>
                                <ResumeGenerate/>
                            </ProtectedRoute>
                        }
                    />
                    <Route path="/resume/:resumeId/improvements" element={
                        <ProtectedRoute>
                            <ImprovementsPage/>
                        </ProtectedRoute>}/>
                    <Route path="/interview/start" element={<InterviewStart />} />
                    <Route path="/interview" element={<InterviewStart />} />
                    <Route path="/interview/session" element={<InterviewSession />} />
                    <Route path="/interview/result" element={<InterviewResult />} />
                    <Route path="/interview/summary" element={<InterviewSummary />} />

                    <Route path="/support" element={<Support/>}/>
                    <Route path="/faq" element={<FAQ/>}/>
                    <Route path="/legal/policies" element={<LegalPolicies/>}/>
                    <Route path="*" element={<NotFound/>}/>
                </Routes>
            </BrowserRouter>
        </TooltipProvider>
    </QueryClientProvider>
);

export default App;
