import { tr, useLocale } from "@/i18n/copy";
import { useEffect, useId, useState, useRef } from "react";
import ru from "@/i18n/locales/ru.json";
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
  useLocale();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dismiss = (event: Event) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
    };
  }, []);
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
          if (!controller.signal.aborted) setError(tr("copy.c100"));
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
      setError(err instanceof Error ? err.message : tr("copy.c101"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      ref={root}
      className="relative space-y-2"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setOpen(false);
          setActive(-1);
        }
      }}
    >
      <Input
        role="combobox"
        aria-label={tr("copy.c102")}
        aria-expanded={open}
        aria-controls={id}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
        maxLength={80}
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
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
        <div className="absolute z-40 top-full left-0 right-0 rounded-xl border bg-popover shadow-xl p-2 space-y-2 max-h-96 overflow-auto">
          {loading && (
            <p role="status" className="text-sm">
              {tr("copy.c103")}
            </p>
          )}
          <ul
            id={id}
            role="listbox"
            aria-label={tr("copy.c104")}
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
                    {ru.seedSkills[item.name] === item.description
                      ? tr("seedSkills." + item.name)
                      : item.description}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!loading && !exact && query.trim() && (
            <div className="space-y-2 border-t pt-2">
              <p className="text-sm">
                {items.length ? tr("copy.c105") : tr("copy.c106")}
              </p>
              <Textarea
                aria-label={tr("copy.c107")}
                placeholder={tr("copy.c108")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
              />
              <Button
                type="button"
                disabled={saving || selected.length >= 60}
                onClick={create}
              >
                {saving ? tr("copy.c109") : tr("copy.c110")}
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
