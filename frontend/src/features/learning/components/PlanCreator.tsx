import { tr, useLocale } from "@/i18n/copy";
import { getErrorMessage } from "@/lib/errors";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SkillPicker } from "@/components/SkillPicker";
import { useVacancyContext } from "@/features/applications/useVacancyContext";
import { VacancyContext } from "@/features/applications/components/VacancyContext";
import { useCapabilities } from "@/api/system";
import { useCreatePlan } from "../api";
export function PlanCreator() {
  useLocale();
  const capabilities = useCapabilities();
  const { vacancy, error: contextError } = useVacancyContext();
  const navigate = useNavigate();
  const createPlan = useCreatePlan();
  const [position, setPosition] = useState("");
  const [goal, setGoal] = useState("");
  const [stacks, setStacks] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (vacancy) {
      setPosition(vacancy.data.name);
      setStacks(vacancy.data.skills ?? []);
      setGoal(
        tr("dynamic.prepare", {
          role: vacancy.data.name,
          company: vacancy.data.company_name,
        }).slice(0, 500),
      );
    }
  }, [vacancy]);
  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const plan = await createPlan.mutateAsync({
        position,
        vacancy_id: vacancy?.id || null,
        goal: goal || position,
        stacks,
      });
      navigate(`/plan/${plan.id}`);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-xl border p-5 space-y-4">
      <h2 className="text-xl font-semibold">{tr("copy.c058")}</h2>
      <VacancyContext vacancy={vacancy} />
      {contextError && <p role="alert">{contextError}</p>}
      <label className="block space-y-2">
        {tr("copy.c059")}
        <Input
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          placeholder={tr("copy.c060")}
        />
      </label>
      <label className="block space-y-2">
        {tr("copy.c061")}
        <Textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder={tr("copy.c062")}
        />
      </label>
      <p className="text-sm font-medium">{tr("copy.c063")}</p>
      <SkillPicker
        selected={stacks}
        onChange={setStacks}
        placeholder={tr("copy.c064")}
      />
      <div className="flex flex-wrap gap-2">
        {stacks.map((s) => (
          <Button
            variant="secondary"
            key={s}
            onClick={() => setStacks(stacks.filter((v) => v !== s))}
          >
            {s} ×
          </Button>
        ))}
      </div>
      {capabilities && !capabilities.ai && (
        <p className="text-sm text-muted-foreground">{tr("copy.c065")}</p>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <Button
        disabled={
          !capabilities?.ai ||
          busy ||
          position.trim().length < 3 ||
          !stacks.length
        }
        onClick={create}
      >
        {busy ? tr("copy.c066") : tr("copy.c067")}
      </Button>
    </section>
  );
}
