import GuestlistRow, { GuestlistAttendee } from "./GuestlistRow";

interface GuestlistSectionProps {
  attendees?: GuestlistAttendee[];
}

const DEFAULT_ATTENDEES: GuestlistAttendee[] = [
  { id: "1", username: "person_a", socials: ["instagram", "facebook"] },
  { id: "2", username: "person_b", socials: [] },
  { id: "3", username: "person_c", socials: ["tiktok"] },
  { id: "4", username: "person_d", socials: ["tiktok", "instagram"] },
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
