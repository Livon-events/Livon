import GuestlistRow, { GuestlistAttendee } from "./GuestlistRow";

interface GuestlistSectionProps {
  attendees?: GuestlistAttendee[];
}

const DEFAULT_ATTENDEES: GuestlistAttendee[] = [
  { id: "1", handle: "@personA", socials: ["instagram", "facebook"] },
  { id: "2", handle: "@personB", socials: [] },
  { id: "3", handle: "@personC", socials: ["tiktok"] },
  { id: "4", handle: "@personD", socials: ["tiktok", "instagram"] },
];

export default function GuestlistSection({
  attendees = DEFAULT_ATTENDEES,
}: GuestlistSectionProps) {
  return (
    <div className="flex flex-col gap-1 mt-2">
      {attendees.map((attendee) => (
        <GuestlistRow key={attendee.id} attendee={attendee} />
      ))}
    </div>
  );
}
