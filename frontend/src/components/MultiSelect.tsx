import { useState } from "react";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  allowCustom?: boolean;
}

export function MultiSelect({ options, selected, onChange, placeholder = "Выберите...", allowCustom = false }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");

  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleAddCustom = () => {
    if (customValue.trim() && !selected.includes(customValue.trim())) {
      onChange([...selected, customValue.trim()]);
      setCustomValue("");
    }
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start">
            {selected.length > 0 ? `${selected.length} выбрано` : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 bg-background" align="start">
          <Command>
            <CommandInput placeholder="Поиск..." />
            <CommandList>
              <CommandEmpty>Не найдено</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem key={option} onSelect={() => handleSelect(option)}>
                    <Check className={`mr-2 h-4 w-4 ${selected.includes(option) ? "opacity-100" : "opacity-0"}`} />
                    {option}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {allowCustom && (
        <div className="flex gap-2">
          <Input
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder="Или введите свою..."
            onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
          />
          <Button onClick={handleAddCustom} size="sm">+</Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {selected.map((value) => (
          <Badge key={value} variant="secondary">
            {value}
            <X className="ml-1 h-3 w-3 cursor-pointer" onClick={() => handleSelect(value)} />
          </Badge>
        ))}
      </div>
    </div>
  );
}
