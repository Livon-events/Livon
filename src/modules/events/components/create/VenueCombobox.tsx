"use client";

import { useId, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import type { LocationVenue } from "@/modules/location";

type VenueComboboxProps = {
  id: string;
  value: string;
  venues: LocationVenue[];
  maxLength: number;
  invalid: boolean;
  inputClassName: string;
  onChange: (value: string) => void;
  onSelect: (venue: LocationVenue) => void;
};

export default function VenueCombobox({
  id,
  value,
  venues,
  maxLength,
  invalid,
  inputClassName,
  onChange,
  onSelect,
}: VenueComboboxProps) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const matches = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return venues;
    return venues.filter((venue) => venue.name.toLowerCase().includes(query));
  }, [value, venues]);

  const exactMatch = matches.length === 1 && matches[0].name.toLowerCase() === value.trim().toLowerCase();
  const showList = open && matches.length > 0 && !exactMatch;

  function select(venue: LocationVenue) {
    onSelect(venue);
    setOpen(false);
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
    } else if (event.key === "Enter" && activeIndex >= 0) {
      select(matches[activeIndex]);
      event.preventDefault();
    } else if (event.key === "Escape") {
      setOpen(false);
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
        value={value}
        maxLength={maxLength}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        placeholder="Search venue"
        autoComplete="off"
        className={`${inputClassName} pr-12`}
      />
      <MapPin className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8e8e8e]" />

      {showList && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-64 overflow-y-auto rounded-[10px] border-2 border-[#262626] bg-[#0C0C0C] py-1 shadow-lg"
        >
          {matches.map((venue, index) => (
            <li
              key={venue.id}
              id={`${listboxId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              // mousedown (not click) so the input's blur doesn't close the list first
              onMouseDown={(e) => {
                e.preventDefault();
                select(venue);
              }}
              className={`cursor-pointer px-4 py-2.5 text-[15px] font-medium ${
                index === activeIndex ? "bg-[#FFF335] text-[#0C0C0C]" : "text-white hover:bg-white/10"
              }`}
            >
              {venue.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
