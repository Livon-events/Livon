"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, MapPin, Calendar, Clock } from "lucide-react";
import { createEvent, updateEvent, cancelEvent } from "@/modules/events/mutations";
import {
  eventTextFieldsSchema,
  combineStartsAt,
  combineDateAndTime,
  TITLE_MAX,
  VENUE_MIN,
  VENUE_MAX,
  DESCRIPTION_MAX,
  ALLOWED_IMAGE_MIME,
  IMAGE_MAX_BYTES,
} from "@/modules/events/validation";
import type { CreateEventCategory } from "@/modules/events/components/create/CreateEventPage";
import type { LocationPickerCity } from "@/modules/location/queries";

type Admission = "free" | "paid";

export type EventFormInitialValues = {
  title: string;
  categoryId: string;
  startDate: string;
  startTime: string;
  endDate?: string;
  endTime?: string;
  venueName: string;
  description: string;
  admission: Admission;
  price?: number;
  coverImageUrl: string;
};

type CreateEventFormProps = {
  categories: CreateEventCategory[];
} & (
  | {
      mode?: "create";
      eventId?: undefined;
      initialValues?: undefined;
      cities: LocationPickerCity[];
      /** Pre-fill only — from the host's current header selection, per docs/FR/location-toggle.md. Changeable, and null if the header has no resolved area (e.g. "All areas" or no preference yet). */
      initialCityId: string | null;
      initialAreaId: string | null;
    }
  | { mode: "edit"; eventId: string; initialValues: EventFormInitialValues }
);

type FormErrors = Partial<
  Record<"title" | "categoryId" | "areaId" | "startDate" | "startTime" | "endDate" | "endTime" | "venueName" | "description" | "price" | "image" | "form", string>
>;

function todayIso(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function nextWeekdayIso(targetDay: number): string {
  // 0 = Sunday ... 6 = Saturday, matches JS Date#getDay().
  const today = new Date();
  const currentDay = today.getDay();
  let diff = targetDay - currentDay;
  if (diff <= 0) diff += 7;
  return addDays(todayIso(), diff);
}

const DATE_PRESETS = [
  { label: "Today", getValue: () => todayIso() },
  { label: "Tomorrow", getValue: () => addDays(todayIso(), 1) },
  { label: "Friday", getValue: () => nextWeekdayIso(5) },
  { label: "Saturday", getValue: () => nextWeekdayIso(6) },
];

const TIME_PRESETS = [
  { label: "12 PM", value: "12:00" },
  { label: "2 PM", value: "14:00" },
  { label: "6 PM", value: "18:00" },
  { label: "8 PM", value: "20:00" },
];

const chipBase =
  "rounded-full border-[1.5px] px-3 py-1.5 text-xs font-semibold transition active:scale-95";
const chipInactive = "border-[#262626] text-white hover:border-white/40";
const chipActive = "border-[#FFEA00] bg-[#FFEA00] text-black shadow-[0_3px_8px_rgba(255,234,0,0.15)]";

const inputBase =
  "w-full rounded-[10px] border-2 border-[#262626] bg-black px-4 py-3.5 text-[15px] font-medium text-white outline-none transition focus:border-[#FFEA00] focus:shadow-[0_0_10px_rgba(255,234,0,0.08)]";

export default function CreateEventForm(props: CreateEventFormProps) {
  const { categories } = props;
  const isEditing = props.mode === "edit";
  const initialValues = isEditing ? props.initialValues : undefined;
  const cities = useMemo(() => (isEditing ? [] : props.cities), [isEditing, props]);

  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(initialValues?.categoryId ?? null);
  const [cityId, setCityId] = useState<string | null>(
    isEditing ? null : props.initialCityId ?? cities[0]?.id ?? null
  );
  const [areaId, setAreaId] = useState<string | null>(isEditing ? null : props.initialAreaId ?? null);
  const [startDate, setStartDate] = useState(initialValues?.startDate ?? todayIso());
  const [startTime, setStartTime] = useState(initialValues?.startTime ?? "18:00");
  const [venueName, setVenueName] = useState(initialValues?.venueName ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [admission, setAdmission] = useState<Admission>(initialValues?.admission ?? "free");
  const [price, setPrice] = useState(initialValues?.price ? String(initialValues.price) : "");

  const [showEndTime, setShowEndTime] = useState(
    Boolean(initialValues?.endDate && initialValues?.endTime)
  );
  const [endDate, setEndDate] = useState(initialValues?.endDate ?? "");
  const [endTime, setEndTime] = useState(initialValues?.endTime ?? "");

  const [coverFile, setCoverFile] = useState<File | null>(null);
  // In edit mode this starts as the existing remote cover URL; in create
  // mode it starts null (no photo picked yet). Either way it's just "the
  // URL to show in the picker" — a freshly-picked file's object URL looks
  // the same to this state either way.
  const [coverPreview, setCoverPreview] = useState<string | null>(initialValues?.coverImageUrl ?? null);

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [savedEventId, setSavedEventId] = useState<string | null>(null);

  // Revoke the object URL whenever it's replaced or the component unmounts
  // — but only if it's actually a blob: URL we created (a freshly-picked
  // file), never the initial remote cover URL passed in for editing.
  useEffect(() => {
    return () => {
      if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );

  const sortedCities = useMemo(
    () => [...cities].sort((a, b) => a.name.localeCompare(b.name)),
    [cities]
  );
  const selectedCity = sortedCities.find((c) => c.id === cityId) ?? sortedCities[0] ?? null;
  const availableAreas = useMemo(
    () => [...(selectedCity?.areas ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [selectedCity]
  );
  const selectedAreaName = availableAreas.find((a) => a.id === areaId)?.name ?? null;
  const locationLabel =
    selectedAreaName && selectedCity ? `${selectedAreaName}, ${selectedCity.name}` : null;

  function handleCityChange(nextCityId: string) {
    setCityId(nextCityId);
    // Area belongs to a specific city — switching city invalidates
    // whatever area was picked under the old one.
    setAreaId(null);
  }

  function handlePickImage() {
    fileInputRef.current?.click();
  }

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    // Client-side checks are a UX nicety only — they make the browser's
    // *reported* type/size available early so people get instant feedback.
    // They are not the security boundary: the server re-derives the real
    // format by sniffing file bytes and re-encodes the image regardless of
    // what's checked here (see /api/events and lib/images/eventCover.ts).
    if (!ALLOWED_IMAGE_MIME.includes(file.type as (typeof ALLOWED_IMAGE_MIME)[number])) {
      setErrors((prev) => ({ ...prev, image: "Please choose a JPEG, PNG, or WebP image" }));
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setErrors((prev) => ({
        ...prev,
        image: `Image must be ${Math.floor(IMAGE_MAX_BYTES / (1024 * 1024))}MB or smaller`,
      }));
      return;
    }

    setErrors((prev) => ({ ...prev, image: undefined }));
    if (coverPreview?.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const parsed = eventTextFieldsSchema.safeParse({
      title,
      categoryId: categoryId ?? "",
      startDate,
      startTime,
      venueName,
      description,
      admission,
      price: admission === "paid" && price.trim() !== "" ? Number(price) : undefined,
      endDate: showEndTime ? endDate : "",
      endTime: showEndTime ? endTime : "",
    });

    if (!parsed.success) {
      const nextErrors: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormErrors | undefined;
        if (key && !nextErrors[key]) nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }

    if (!combineStartsAt(startDate, startTime)) {
      setErrors({ startDate: "Enter a valid start date and time" });
      return;
    }

    // Validate end date/time when the toggle is on.
    if (showEndTime) {
      if (!endDate || !endTime) {
        setErrors({
          ...(endDate ? {} : { endDate: "Please select an end date" }),
          ...(endTime ? {} : { endTime: "Please select an end time" }),
        });
        return;
      }
      const combinedEnd = combineDateAndTime(endDate, endTime);
      const combinedStart = combineStartsAt(startDate, startTime);
      if (!combinedEnd) {
        setErrors({ endDate: "Enter a valid end date and time" });
        return;
      }
      if (combinedStart && combinedEnd <= combinedStart) {
        setErrors({ endTime: "End time must be after the start" });
        return;
      }
    }

    // Area is required for a brand-new event — it's resolved once at
    // creation and never touched again on edit (see PATCH
    // /api/events/[id]), so there's nothing to re-check here in edit mode.
    if (!isEditing && !areaId) {
      setErrors({ areaId: "Please select an area for your event." });
      return;
    }

    setErrors({});
    setSubmitting(true);

    const result = isEditing
      ? await updateEvent(props.eventId, {
          title: parsed.data.title,
          categoryId: parsed.data.categoryId,
          startDate: parsed.data.startDate,
          startTime: parsed.data.startTime,
          endDate: showEndTime ? endDate : undefined,
          endTime: showEndTime ? endTime : undefined,
          venueName: parsed.data.venueName,
          description: parsed.data.description ?? "",
          admission: parsed.data.admission,
          price: parsed.data.price,
          coverImage: coverFile,
        })
      : await createEvent({
          title: parsed.data.title,
          categoryId: parsed.data.categoryId,
          areaId: areaId as string,
          startDate: parsed.data.startDate,
          startTime: parsed.data.startTime,
          endDate: showEndTime ? endDate : undefined,
          endTime: showEndTime ? endTime : undefined,
          venueName: parsed.data.venueName,
          description: parsed.data.description ?? "",
          admission: parsed.data.admission,
          price: parsed.data.price,
          coverImage: coverFile,
        });

    setSubmitting(false);

    if (!result.ok) {
      setErrors({ form: result.error });
      return;
    }

    setSavedEventId(result.data.id);
  }

  async function handleCancelEvent() {
    if (!isEditing || cancelling) return;
    const confirmed = window.confirm(
      "Cancel this event? It will be permanently deleted, along with everyone's interest and view history for it — this can't be undone."
    );
    if (!confirmed) return;

    setCancelling(true);
    const result = await cancelEvent(props.eventId);
    setCancelling(false);

    if (!result.ok) {
      setErrors({ form: result.error });
      return;
    }

    router.push("/profile");
  }

  if (savedEventId) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#FFEA00]">
          <svg viewBox="0 0 52 52" className="h-9 w-9">
            <path
              fill="none"
              stroke="#FFEA00"
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.1 27.2l7.1 7.2 16.7-16.8"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-extrabold">{isEditing ? "Changes Saved!" : "Event Published!"}</h2>
        <p className="max-w-xs text-sm text-[#8e8e8e]">
          {isEditing
            ? "Your changes are live."
            : `Your event is now live${locationLabel ? ` and visible to everyone in ${locationLabel}` : ""}.`}
        </p>
        <button
          type="button"
          onClick={() => router.push(`/events/${savedEventId}`)}
          className="h-[52px] w-full max-w-xs rounded-[10px] bg-[#FFEA00] text-base font-extrabold text-black shadow-[0_4px_12px_rgba(255,234,0,0.15)] transition active:scale-[0.97]"
        >
          {isEditing ? "View Event" : "Done"}
        </button>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
      {errors.form && (
        <p className="rounded-[10px] border border-[#ff453a]/40 bg-[#ff453a]/10 px-4 py-3 text-sm font-medium text-[#ff453a]">
          {errors.form}
        </p>
      )}

      {/* Cover image picker */}
      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={handlePickImage}
          aria-label={coverPreview ? "Change event photo" : "Add event photo"}
          className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl bg-[#FFEA00] transition active:scale-[0.99]"
          style={
            coverPreview
              ? { backgroundImage: `url(${coverPreview})`, backgroundSize: "cover", backgroundPosition: "center" }
              : undefined
          }
        >
          {coverPreview ? (
            <span className="rounded-full bg-black/45 px-4 py-2 text-sm font-semibold text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.8)]">
              Change photo
            </span>
          ) : (
            <span className="flex flex-col items-center gap-2 text-center text-lg font-extrabold text-black">
              <Camera className="h-6 w-6" strokeWidth={2.5} />
              Add a photo
            </span>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleImageChange}
          className="hidden"
        />
        {errors.image && <p className="text-xs font-semibold text-[#ff453a]">{errors.image}</p>}
        <p className="text-[11px] text-[#8e8e8e]">JPEG, PNG, or WebP only, up to 5MB.</p>
      </div>

      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="eventTitle" className="text-[11px] font-extrabold tracking-wider text-[#8e8e8e]">
          TITLE
        </label>
        <input
          id="eventTitle"
          type="text"
          value={title}
          maxLength={TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Maseru Flea Market"
          autoComplete="off"
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? "titleError" : undefined}
          className={inputBase}
        />
        {errors.title && (
          <p id="titleError" className="text-xs font-semibold text-[#ff453a]">
            {errors.title}
          </p>
        )}
      </div>

      {/* Category */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-extrabold tracking-wider text-[#8e8e8e]">CATEGORY</label>
        <div className="flex flex-wrap gap-2">
          {sortedCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setCategoryId(category.id)}
              className={`${chipBase} ${categoryId === category.id ? chipActive : chipInactive}`}
            >
              {category.name}
            </button>
          ))}
        </div>
        {errors.categoryId && <p className="text-xs font-semibold text-[#ff453a]">{errors.categoryId}</p>}
      </div>

      {/* Area — which City/Area is being posted to. Only shown when
          creating: it's resolved once at creation and never re-editable
          afterward (see PATCH /api/events/[id]). */}
      {!isEditing && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-extrabold tracking-wider text-[#8e8e8e]">AREA</label>

          {sortedCities.length > 1 && (
            <div className="mb-1 flex flex-wrap gap-2">
              {sortedCities.map((city) => (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => handleCityChange(city.id)}
                  className={`${chipBase} ${cityId === city.id ? chipActive : chipInactive}`}
                >
                  {city.name}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {availableAreas.map((area) => (
              <button
                key={area.id}
                type="button"
                onClick={() => setAreaId(area.id)}
                className={`${chipBase} ${areaId === area.id ? chipActive : chipInactive}`}
              >
                {area.name}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[#8e8e8e]">Where the event will be listed. Visible on the feed to everyone in this area.</p>
          {errors.areaId && <p className="text-xs font-semibold text-[#ff453a]">{errors.areaId}</p>}
        </div>
      )}

      {/* Date & time */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="startDate" className="text-[11px] font-extrabold tracking-wider text-[#8e8e8e]">
            START DATE
          </label>
          <div className="relative">
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`${inputBase} pr-12`}
            />
            <Calendar className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8e8e8e]" />
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {DATE_PRESETS.map((preset) => {
              const value = preset.getValue();
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setStartDate(value)}
                  className={`${chipBase} ${startDate === value ? chipActive : chipInactive}`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          {errors.startDate && <p className="text-xs font-semibold text-[#ff453a]">{errors.startDate}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="startTime" className="text-[11px] font-extrabold tracking-wider text-[#8e8e8e]">
            START TIME
          </label>
          <div className="relative">
            <input
              id="startTime"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={`${inputBase} pr-12`}
            />
            <Clock className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8e8e8e]" />
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {TIME_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setStartTime(preset.value)}
                className={`${chipBase} ${startTime === preset.value ? chipActive : chipInactive}`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {errors.startTime && <p className="text-xs font-semibold text-[#ff453a]">{errors.startTime}</p>}
        </div>
      </div>

      {/* End date & time (optional toggle) */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => {
            setShowEndTime((prev) => {
              if (prev) {
                // Clearing end date/time when toggling off.
                setEndDate("");
                setEndTime("");
                setErrors((e) => ({ ...e, endDate: undefined, endTime: undefined }));
              }
              return !prev;
            });
          }}
          className={`flex items-center gap-2 self-start rounded-full border-[1.5px] px-3.5 py-2 text-xs font-semibold transition active:scale-95 ${
            showEndTime
              ? "border-[#FFEA00] bg-[#FFEA00]/10 text-[#FFEA00]"
              : "border-[#262626] text-[#8e8e8e] hover:border-white/40 hover:text-white"
          }`}
        >
          <Clock className="h-3.5 w-3.5" strokeWidth={2.5} />
          {showEndTime ? "Remove end time" : "Add end time"}
          <span className="text-[9px] font-semibold opacity-70">(OPTIONAL)</span>
        </button>

        {showEndTime && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="endDate" className="text-[11px] font-extrabold tracking-wider text-[#8e8e8e]">
                END DATE
              </label>
              <div className="relative">
                <input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`${inputBase} pr-12`}
                />
                <Calendar className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8e8e8e]" />
              </div>
              {errors.endDate && <p className="text-xs font-semibold text-[#ff453a]">{errors.endDate}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="endTime" className="text-[11px] font-extrabold tracking-wider text-[#8e8e8e]">
                END TIME
              </label>
              <div className="relative">
                <input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={`${inputBase} pr-12`}
                />
                <Clock className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8e8e8e]" />
              </div>
              {errors.endTime && <p className="text-xs font-semibold text-[#ff453a]">{errors.endTime}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Location */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="eventLocation" className="text-[11px] font-extrabold tracking-wider text-[#8e8e8e]">
          LOCATION
        </label>
        <div className="relative">
          <input
            id="eventLocation"
            type="text"
            value={venueName}
            maxLength={VENUE_MAX}
            onChange={(e) => setVenueName(e.target.value)}
            placeholder="Venue name"
            autoComplete="off"
            aria-invalid={Boolean(errors.venueName)}
            className={`${inputBase} pr-12`}
          />
          <MapPin className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8e8e8e]" />
        </div>
        <p className="text-[11px] text-[#8e8e8e]">At least {VENUE_MIN} characters.</p>
        {errors.venueName && <p className="text-xs font-semibold text-[#ff453a]">{errors.venueName}</p>}
      </div>

      {/* Admission */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-extrabold tracking-wider text-[#8e8e8e]">ADMISSION</label>
        <div className="flex gap-1 rounded-[10px] border border-[#262626] bg-[#121212] p-1">
          {(["free", "paid"] as Admission[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setAdmission(option)}
              className={`flex-1 rounded-[7px] py-2.5 text-sm font-bold capitalize transition ${
                admission === option ? "bg-[#FFEA00] text-black" : "text-[#8e8e8e] hover:text-white"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        {admission === "paid" && (
          <div className="mt-1.5 flex items-center rounded-[10px] border-2 border-[#262626] bg-black px-4 focus-within:border-[#FFEA00] focus-within:shadow-[0_0_10px_rgba(255,234,0,0.08)]">
            <span className="mr-1.5 text-lg font-extrabold text-[#FFEA00]">M</span>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              step={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="20"
              className="w-full appearance-none border-none bg-transparent py-3.5 text-[15px] font-medium text-white outline-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        )}
        {errors.price && <p className="text-xs font-semibold text-[#ff453a]">{errors.price}</p>}
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="eventDescription" className="text-[11px] font-extrabold tracking-wider text-[#8e8e8e]">
          DESCRIPTION <span className="text-[9px] font-semibold opacity-70">(OPTIONAL)</span>
        </label>
        <textarea
          id="eventDescription"
          rows={6}
          maxLength={DESCRIPTION_MAX}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Provide detailed information about your event (schedules, guidelines, what to bring, etc.)."
          className={`${inputBase} min-h-[180px] resize-none`}
        />
        <p className="self-end text-[11px] text-[#8e8e8e]">
          {description.length}/{DESCRIPTION_MAX}
        </p>
        {errors.description && <p className="text-xs font-semibold text-[#ff453a]">{errors.description}</p>}
      </div>

      <div className="flex flex-col gap-3 pb-6 pt-2">
        <button
          type="submit"
          disabled={submitting || (!isEditing && !areaId)}
          className="h-[52px] w-full rounded-[10px] bg-[#FFEA00] text-base font-extrabold text-black shadow-[0_4px_12px_rgba(255,234,0,0.15)] transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (isEditing ? "Saving…" : "Publishing…") : isEditing ? "Save Changes" : "Publish Event"}
        </button>

        {isEditing && (
          <button
            type="button"
            onClick={handleCancelEvent}
            disabled={cancelling}
            className="h-[48px] w-full rounded-[10px] border-2 border-[#ff453a] text-base font-extrabold text-[#ff453a] transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelling ? "Cancelling…" : "Cancel Event"}
          </button>
        )}
      </div>
    </form>
  );
}
