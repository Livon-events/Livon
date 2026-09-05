"use client";

type CityOption = {
  id: string;
  name: string;
};

type CitySelectProps = {
  cities: CityOption[];
  value: string;
  onChange: (cityId: string) => void;
  id?: string;
  className?: string;
};

const selectClassName =
  "w-full rounded-[10px] border-2 border-[#262626] bg-[#121212] px-4 py-3.5 text-[15px] font-medium text-white outline-none transition focus:border-[#FFF335] focus:shadow-[0_0_10px_rgba(255, 243, 53,0.08)]";

export default function CitySelect({ cities, value, onChange, id, className }: CitySelectProps) {
  if (cities.length < 2) return null;

  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label="City"
      className={className ?? selectClassName}
      style={{ colorScheme: "dark" }}
    >
      {cities.map((city) => (
        <option key={city.id} value={city.id}>
          {city.name}
        </option>
      ))}
    </select>
  );
}
