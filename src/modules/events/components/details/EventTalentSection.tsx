import Link from "next/link";
import type { EventTalentProfile } from "@/modules/events";
import { AvatarImage } from "@/modules/users";

type EventTalentSectionProps = {
  talent: EventTalentProfile[];
};

/** Ordered public profiles featured at the event. */
export default function EventTalentSection({ talent }: EventTalentSectionProps) {
  if (talent.length === 0) return null;

  return (
    <section className="mt-5 sm:mt-6" aria-labelledby="event-talent-heading">
      <h2 id="event-talent-heading" className="text-2xl font-extrabold sm:text-[32px]">
        Featured Talent
      </h2>

      <ul className="mt-3 flex flex-col">
        {talent.map((person) => (
          <li key={person.userId}>
            <Link
              href={`/users/${encodeURIComponent(person.username)}`}
              aria-label={`View ${person.username}'s Livon profile`}
              className="flex min-h-[64px] items-center gap-3 border-b border-white py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF335]"
            >
              <AvatarImage
                src={person.avatarUrl}
                alt=""
                sizes="40px"
                className="h-10 w-10 shrink-0 rounded-full"
              />
              <span className="min-w-0 flex-1 truncate text-base font-bold text-white">
                @{person.username}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
