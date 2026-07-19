"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, MapPin, Calendar, Clock } from "lucide-react";
import { createEvent } from "@/lib/mutations/events";
import {
  eventTextFieldsSchema,
  combineStartsAt,
  TITLE_MAX,
  VENUE_MIN,
  VENUE_MAX,
  DESCRIPTION_MAX,
  ALLOWED_IMAGE_MIME,
  IMAGE_MAX_BYTES,
} from "@/lib/validation/eventCreation";
import type { CreateEventCategory } from "@/components/events/create/CreateEventPage";

type CreateEventFormProps = {
  categories: CreateEventCategory[];
  locationReady: boolean;
  locationLabel: string | null;
};

type Admission = "free" | "paid";

type FormErrors = Partial<
  Record<"title" | "categoryId" | "startDate" | "startTime" | "venueName" | "description" | "price" | "image" | "form", string>
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

export default function CreateEventForm({
  categories,
  locationReady,
  locationLabel,
}: CreateEventFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(todayIso());
  const [startTime, setStartTime] = useState("18:00");
  const [venueName, setVenueName] = useState("");
  const [description, setDescription] = useState("");
  const [admission, setAdmission] = useState<Admission>("free");
  const [price, setPrice] = useState("");

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);

  // Revoke the object URL whenever it's replaced or the component unmounts,
  // so previews don't leak memory across several image picks.
  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );

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
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(event: React.FormEvent) {
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

    if (!locationReady) {
      setErrors({
        form: "Select a specific area in the location toggle before posting an event.",
      });
      return;
    }

    setErrors({});
    setSubmitting(true);

    const result = await createEvent({
      title: parsed.data.title,
      categoryId: parsed.data.categoryId,
      startDate: parsed.data.startDate,
      startTime: parsed.data.startTime,
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

    setCreatedEventId(result.data.id);
  }

  if (createdEventId) {
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
        <h2 className="text-2xl font-extrabold">Event Published!</h2>
        <p className="max-w-xs text-sm text-[#8e8e8e]">
          Your event is now live{locationLabel ? ` and visible to everyone in ${locationLabel}` : ""}.
        </p>
        <button
          type="button"
          onClick={() => router.push(`/events/${createdEventId}`)}
          className="h-[52px] w-full max-w-xs rounded-[10px] bg-[#FFEA00] text-base font-extrabold text-black shadow-[0_4px_12px_rgba(255,234,0,0.15)] transition active:scale-[0.97]"
        >
          Awesome
        </button>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
      {!locationReady && (
        <p className="rounded-[10px] border border-[#ff453a]/40 bg-[#ff453a]/10 px-4 py-3 text-sm font-medium text-[#ff453a]">
          Select a specific area in the location toggle before posting an event.
        </p>
      )}

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

      <div className="pb-6 pt-2">
        <button
          type="submit"
          disabled={submitting || !locationReady}
          className="h-[52px] w-full rounded-[10px] bg-[#FFEA00] text-base font-extrabold text-black shadow-[0_4px_12px_rgba(255,234,0,0.15)] transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Publishing…" : "Publish Event"}
        </button>
      </div>
    </form>
  );
}
