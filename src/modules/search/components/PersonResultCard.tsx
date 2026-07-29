import Link from "next/link";
import type { PersonSearchResult } from "@/modules/search/queries";

type PersonResultCardProps = {
  person: PersonSearchResult;
};

// Avatar circle styled to match ProfileHeader's own avatar treatment
// (background-image div rather than next/image, since avatar URLs here
// are already the processed 400x400 WebP from lib/images/avatar.ts).
export default function PersonResultCard({ person }: PersonResultCardProps) {
  return (
    <Link
      href={`/profile/${person.userId}`}
      className="flex items-center gap-3 rounded-xl bg-[#161616] p-2.5 transition-colors active:bg-[#1e1e1e]"
    >
      <div
        className="h-12 w-12 shrink-0 rounded-full bg-[#3A3A3C] bg-cover bg-center"
        style={person.avatarUrl ? { backgroundImage: `url(${person.avatarUrl})` } : undefined}
      />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-bold text-white">{person.username}</h3>
        {person.bio && <p className="truncate text-[13px] text-[#a1a1a6]">{person.bio}</p>}
      </div>
    </Link>
  );
}
