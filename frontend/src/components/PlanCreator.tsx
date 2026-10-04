import { useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "@/api/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SkillPicker } from "@/components/SkillPicker";
export function PlanCreator() {
  const navigate = useNavigate();
  const [position, setPosition] = useState("");
  const [goal, setGoal] = useState("");
  const [stacks, setStacks] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await client.post("/plan", {
        position,
        goal: goal || position,
        stacks,
      });
      navigate(`/plan/${r.data.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-xl border p-5 space-y-4">
      <h2 className="text-xl font-semibold">Новый учебный план</h2>
      <label className="block space-y-2">
        Целевая позиция
        <Input
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          placeholder="Например: Backend developer"
        />
      </label>
      <label className="block space-y-2">
        Цель и пожелания
        <Textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Что хотите освоить и какой проект создать"
        />
      </label>
      <p className="text-sm font-medium">
        Предпочитаемый стек — можно выбрать несколько технологий
      </p>
      <SkillPicker
        selected={stacks}
        onChange={setStacks}
        placeholder="Найти технологию"
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
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <Button
        disabled={busy || position.trim().length < 3 || !stacks.length}
        onClick={create}
      >
        {busy ? "Готовим план…" : "Создать план"}
      </Button>
    </section>
  );
}
