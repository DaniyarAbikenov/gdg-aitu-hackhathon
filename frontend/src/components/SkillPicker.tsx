import { useEffect, useId, useState } from "react";
import client from "@/api/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Skill = { id: string; name: string; description: string };
const key = (name: string) =>
  name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();

export function SkillPicker({
  selected,
  onChange,
  placeholder,
}: {
  selected: string[];
  onChange: (skills: string[]) => void;
  placeholder: string;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<Skill[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(-1);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setItems([]);
    setActive(-1);
    const timer = setTimeout(() => {
      client
        .get("/skills", { params: { q: query }, signal: controller.signal })
        .then(({ data }) => {
          setItems(data.skills);
          setError("");
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setError(
              "Не удалось загрузить навыки. Измените запрос, чтобы повторить.",
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  const choose = (skill: Skill) => {
    if (
      selected.length < 60 &&
      !selected.some((name) => key(name) === key(skill.name))
    )
      onChange([...selected, skill.name]);
    setQuery("");
    setDescription("");
    setOpen(false);
  };
  const exact = items.find((item) => key(item.name) === key(query));
  const create = async () => {
    setSaving(true);
    setError("");
    try {
      const { data } = await client.post("/skills", {
        name: query,
        description,
      });
      choose(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось добавить навык",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-2">
      <Input
        role="combobox"
        aria-label="Поиск навыка"
        aria-expanded={open}
        aria-controls={id}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
        maxLength={80}
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive(Math.min(active + 1, items.length - 1));
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive(Math.max(0, active - 1));
          }
          if (e.key === "Enter") {
            e.preventDefault();
            if (open && !loading && (items[active] || exact))
              choose(items[active] || exact!);
          }
        }}
      />
      {open && (
        <div className="rounded-md border bg-background p-2 space-y-2">
          {loading && (
            <p role="status" className="text-sm">
              Поиск…
            </p>
          )}
          <ul
            id={id}
            role="listbox"
            aria-label="Навыки"
            className="max-h-64 overflow-y-auto"
          >
            {items.map((item, index) => (
              <li key={item.id}>
                <button
                  id={`${id}-${index}`}
                  type="button"
                  role="option"
                  aria-selected={active === index}
                  onClick={() => choose(item)}
                  className={`w-full rounded p-2 text-left hover:bg-muted focus:bg-muted ${active === index ? "bg-muted" : ""}`}
                >
                  <span className="block font-medium">{item.name}</span>
                  <span className="block text-sm text-muted-foreground break-words">
                    {item.description}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!loading && !exact && query.trim() && (
            <div className="space-y-2 border-t pt-2">
              <p className="text-sm">
                {items.length
                  ? "Есть похожие навыки. Выберите подходящий или добавьте отдельный навык."
                  : "Навык не найден. Добавьте его в общий каталог."}
              </p>
              <Textarea
                aria-label="Описание нового навыка"
                placeholder="Что означает этот навык? Описание увидят другие пользователи."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
              />
              <Button
                type="button"
                disabled={
                  saving ||
                  description.trim().length < 10 ||
                  selected.length >= 60
                }
                onClick={create}
              >
                {saving ? "Сохранение…" : "Добавить новый навык"}
              </Button>
            </div>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
