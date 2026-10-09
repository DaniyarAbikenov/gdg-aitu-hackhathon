import { tr, useLocale } from "@/i18n/copy";
import { useInterviewStore } from "../store";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout.tsx";

export default function InterviewResult() {
  useLocale();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { reset } = useInterviewStore();

  return (
    <MainLayout>
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <h1 className="text-2xl font-bold">{tr("ui.interviewCompleted")}</h1>

        <p className="text-lg">{tr("ui.finished")}</p>
        <Button
          className="w-full"
          onClick={() =>
            navigate(
              `/interview/summary?id=${params.get("id") || useInterviewStore.getState().sessionId}`,
            )
          }
        >
          {tr("ui.summary")}
        </Button>

        <Button
          className="w-full"
          onClick={() => {
            reset();
            navigate("/interview/start");
          }}
        >
          {tr("ui.restart")}
        </Button>
      </div>
    </MainLayout>
  );
}
