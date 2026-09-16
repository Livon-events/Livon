import Link from "next/link";
import type { PersonSearchResult } from "@/modules/search/queries";
import { AvatarImage } from "@/modules/users";

type PersonResultCardProps = {
  person: PersonSearchResult;
};

export default function PersonResultCard({ person }: PersonResultCardProps) {
  return (
    <Link
      href={`/users/${encodeURIComponent(person.username)}`}
      className="flex items-center gap-3 rounded-xl bg-[#161616] p-2.5 transition-colors active:bg-[#1e1e1e]"
    >
      <AvatarImage
        src={person.avatarUrl}
        alt=""
        sizes="48px"
        className="h-12 w-12 shrink-0 rounded-full"
      />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-bold text-white">{person.username}</h3>
        {person.bio && <p className="truncate text-[13px] text-[#a1a1a6]">{person.bio}</p>}
      </div>
    </Link>
  );
}
