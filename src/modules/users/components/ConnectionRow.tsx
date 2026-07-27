import type { ConnectionUser } from "./types";

interface ConnectionRowProps {
  connection: ConnectionUser;
  actionLabel: string;
  onAction?: (id: string) => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: (id: string) => void;
}

export default function ConnectionRow({
  connection,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: ConnectionRowProps) {
  // Request rows (accept + decline) stack the actions below the name —
  // on narrow screens two side-by-side buttons were pushing the name out
  // of view. Rows with a single action (e.g. "remove") stay inline.
  if (secondaryActionLabel) {
    return (
      <div className="flex flex-col gap-3 bg-[#17181A] rounded-2xl px-3 py-3">
        <div className="flex items-center gap-3.5">
          <div
            className="w-11 h-11 rounded-full bg-[#d11a8c] flex-shrink-0 bg-cover bg-center"
            style={connection.avatarUrl ? { backgroundImage: `url(${connection.avatarUrl})` } : undefined}
          />
          <div className="flex-1 min-w-0">
            <div className="font-display text-[17px] font-bold text-white truncate">{connection.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onSecondaryAction?.(connection.id)}
            className="font-display text-sm font-extrabold border-none rounded-[10px] px-4 py-2.5 bg-[#1F2023] text-white cursor-pointer flex-1"
          >
            {secondaryActionLabel}
          </button>
          <button
            type="button"
            onClick={() => onAction?.(connection.id)}
            className="font-display text-sm font-extrabold border-none rounded-[10px] px-4 py-2.5 bg-[#FFE600] text-black cursor-pointer flex-1"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3.5 bg-[#17181A] rounded-2xl px-3 py-2.5">
      <div
        className="w-11 h-11 rounded-full bg-[#d11a8c] flex-shrink-0 bg-cover bg-center"
        style={connection.avatarUrl ? { backgroundImage: `url(${connection.avatarUrl})` } : undefined}
      />
      <div className="flex-1 min-w-0">
        <div className="font-display text-[17px] font-bold text-white truncate">{connection.name}</div>
      </div>
      <button
        type="button"
        onClick={() => onAction?.(connection.id)}
        className="font-display text-sm font-extrabold border-none rounded-[10px] px-4 py-2.5 bg-[#FFE600] text-black cursor-pointer"
      >
        {actionLabel}
      </button>
    </div>
  );
}
