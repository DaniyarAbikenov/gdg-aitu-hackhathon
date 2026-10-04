import { useInterviewStore } from "@/store/useInterviewStore";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {MainLayout} from "@/components/layout/MainLayout.tsx";

export default function InterviewResult() {
    const navigate = useNavigate();
    const { reset } = useInterviewStore();

    return (
        <MainLayout>
            <div className="p-8 max-w-xl mx-auto text-center space-y-4">
                <h1 className="text-2xl font-bold">Interview Completed</h1>

                <p className="text-lg">You finished the interview.</p>
                <Button
                    className="w-full"
                    onClick={() => navigate("/interview/summary")}
                >
                    View Summary
                </Button>

                <Button
                    className="w-full"
                    onClick={() => {
                        reset();
                        navigate("/interview/start");
                    }}
                >
                    Restart
                </Button>
            </div>
        </MainLayout>
    );
}
