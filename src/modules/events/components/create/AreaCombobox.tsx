"use client";

import { useId, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

type AreaOption = {
  id: string;
  name: string;
};

type AreaComboboxProps = {
  id: string;
  areas: AreaOption[];
  value: string | null;
  invalid: boolean;
  inputClassName: string;
  onSelect: (areaId: string) => void;
};

export default function AreaCombobox({ id, areas, value, invalid, inputClassName, onSelect }: AreaComboboxProps) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  const selectedName = areas.find((area) => area.id === value)?.name ?? null;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return areas;
    return areas.filter((area) => area.name.toLowerCase().includes(q));
  }, [query, areas]);

  const showList = open && matches.length > 0;

  function select(area: AreaOption) {
    onSelect(area.id);
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
  }

  function close() {
    const q = query.trim().toLowerCase();
    const exact = q ? areas.find((area) => area.name.toLowerCase() === q) : undefined;
    if (exact && exact.id !== value) onSelect(exact.id);
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!showList) {
      if (event.key === "ArrowDown" && matches.length > 0) {
        setOpen(true);
        setActiveIndex(0);
        event.preventDefault();
      }
      return;
    }
    if (event.key === "ArrowDown") {
      setActiveIndex((i) => (i + 1) % matches.length);
      event.preventDefault();
    } else if (event.key === "ArrowUp") {
      setActiveIndex((i) => (i <= 0 ? matches.length - 1 : i - 1));
      event.preventDefault();
    } else if (event.key === "Enter") {
      const target = activeIndex >= 0 ? matches[activeIndex] : matches.length === 1 ? matches[0] : undefined;
      if (target) select(target);
      event.preventDefault();
    } else if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
      setActiveIndex(-1);
    }
  }

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={showList && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
        aria-invalid={invalid}
        value={open ? query : selectedName ?? ""}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onClick={() => {
          if (open) return;
          setQuery("");
          setOpen(true);
        }}
        onBlur={close}
        onKeyDown={handleKeyDown}
        placeholder={open && selectedName ? selectedName : "Search area"}
        autoComplete="off"
        className={`${inputClassName} pr-12`}
      />
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8e8e8e]" />

      {showList && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-64 overflow-y-auto rounded-[10px] border-2 border-[#262626] bg-[#0C0C0C] py-1 shadow-lg"
        >
          {matches.map((area, index) => {
            const isSelected = area.id === value;
            return (
              <li
                key={area.id}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={isSelected}
                // mousedown (not click) so the input's blur doesn't close the list first
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(area);
                }}
                className={`cursor-pointer px-4 py-2.5 text-[15px] font-medium ${
                  index === activeIndex
                    ? "bg-[#FFF335] text-[#0C0C0C]"
                    : isSelected
                      ? "text-[#FFF335] hover:bg-white/10"
                      : "text-white hover:bg-white/10"
                }`}
              >
                {area.name}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
