"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, X } from "lucide-react";
import { updateProfile, type UpdateProfileData } from "@/modules/users/mutations";
import {
  BIO_MAX,
  USERNAME_PATTERN,
  ALLOWED_AVATAR_MIME,
  AVATAR_MAX_BYTES,
} from "@/modules/users/validation";

interface EditProfileModalProps {
  username: string;
  bio: string | null;
  avatarUrl?: string | null;
  onClose: () => void;
  onSaved: (data: UpdateProfileData) => void;
}

type FormErrors = Partial<Record<"username" | "bio" | "avatar" | "form", string>>;

export default function EditProfileModal({
  username: initialUsername,
  bio: initialBio,
  avatarUrl: initialAvatarUrl,
  onClose,
  onSaved,
}: EditProfileModalProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState(initialUsername);
  const [bio, setBio] = useState(initialBio ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialAvatarUrl ?? null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [pending, setPending] = useState(false);

  function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    // Client-side checks are a UX nicety only — they make the browser's
    // *reported* type/size available early. They are not the security
    // boundary: the server re-derives the real format by sniffing file
    // bytes and re-encodes regardless (see /api/profile and
    // lib/images/avatar.ts).
    if (!ALLOWED_AVATAR_MIME.includes(file.type as (typeof ALLOWED_AVATAR_MIME)[number])) {
      setErrors((prev) => ({ ...prev, avatar: "Please choose a JPEG, PNG, or WebP image" }));
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setErrors((prev) => ({
        ...prev,
        avatar: `Image must be ${Math.floor(AVATAR_MAX_BYTES / (1024 * 1024))}MB or smaller`,
      }));
      return;
    }

    setErrors((prev) => ({ ...prev, avatar: undefined }));
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function validate(): FormErrors {
    const next: FormErrors = {};
    const normalizedUsername = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      next.username = "Username must be 3–20 characters: letters, numbers, and underscores only.";
    }
    if (bio.length > BIO_MAX) {
      next.bio = `Bio must be ${BIO_MAX} characters or fewer`;
    }
    return next;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setPending(true);

    const result = await updateProfile({
      username: username.trim().toLowerCase(),
      bio: bio.trim(),
      avatarFile,
    });

    setPending(false);

    if (!result.ok) {
      // 409 (username taken) and validation errors both surface as one
      // generic form-level message from the route — good enough to point
      // the username field without over-parsing the response.
      if (result.error.toLowerCase().includes("username")) {
        setErrors({ username: result.error });
      } else {
        setErrors({ form: result.error });
      }
      return;
    }

    onSaved(result.data);
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center px-5">
      <div className="absolute inset-0 bg-black/70" onClick={pending ? undefined : onClose} aria-hidden="true" />

      <div className="relative w-full max-w-[420px] max-h-[90vh] supports-[height:100dvh]:max-h-[90dvh] overflow-y-auto rounded-2xl border border-[#1F2023] bg-[#17181A] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-[20px] font-extrabold text-white">Edit profile</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[#1F2023] text-white disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Avatar — fixed center-crop preview (object-cover on a square)
              matches exactly what the server ends up storing, so there's
              no need for a separate drag-to-position crop UI. */}
          <div className="flex flex-col items-center gap-2.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={pending}
              className="relative w-24 h-24 rounded-full bg-[#3A3A3C] bg-cover bg-center flex-shrink-0 disabled:opacity-60"
              style={avatarPreview ? { backgroundImage: `url(${avatarPreview})` } : undefined}
              aria-label="Change profile picture"
            >
              <span className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#FFE600] border-2 border-[#17181A] flex items-center justify-center text-black">
                <Camera className="w-4 h-4" />
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarChange}
              className="hidden"
            />
            {errors.avatar && <p className="text-xs font-semibold text-[#ff453a]">{errors.avatar}</p>}
            <p className="text-[11px] text-[#8e8e8e]">JPEG, PNG, or WebP, up to 5MB. Cropped to a square automatically.</p>
          </div>

          {/* Username */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="editUsername" className="text-[11px] font-extrabold tracking-wider text-[#8e8e8e]">
              USERNAME
            </label>
            <input
              id="editUsername"
              type="text"
              value={username}
              maxLength={20}
              autoComplete="off"
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              aria-invalid={Boolean(errors.username)}
              className="h-12 bg-[#1F2023] border-2 border-[#1F2023] rounded-xl px-3.5 text-white text-[15px] outline-none focus:border-[#FFE600]"
            />
            {errors.username && <p className="text-xs font-semibold text-[#ff453a]">{errors.username}</p>}
          </div>

          {/* Bio */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="editBio" className="text-[11px] font-extrabold tracking-wider text-[#8e8e8e]">
                BIO
              </label>
              <span className="text-[11px] text-[#8e8e8e]">
                {bio.length}/{BIO_MAX}
              </span>
            </div>
            <textarea
              id="editBio"
              value={bio}
              maxLength={BIO_MAX}
              rows={3}
              placeholder="This is the placeholder for the bio"
              onChange={(e) => setBio(e.target.value)}
              aria-invalid={Boolean(errors.bio)}
              className="resize-none bg-[#1F2023] border-2 border-[#1F2023] rounded-xl px-3.5 py-3 text-white text-[15px] outline-none placeholder:text-[#8e8e8e] focus:border-[#FFE600]"
            />
            {errors.bio && <p className="text-xs font-semibold text-[#ff453a]">{errors.bio}</p>}
          </div>

          {errors.form && <p className="text-xs font-semibold text-[#ff453a]">{errors.form}</p>}

          <div className="flex gap-3 mt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="flex-1 h-12 rounded-xl bg-[#1F2023] text-white font-display font-bold text-[15px] disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 h-12 rounded-xl bg-[#FFE600] text-black font-display font-bold text-[15px] disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
