interface BioSectionProps {
  bio?: string | null;
}

export default function BioSection({ bio }: BioSectionProps) {
  const hasBio = Boolean(bio && bio.trim().length > 0);

  return (
    <p
      className={`text-[15px] leading-snug mb-4 whitespace-pre-wrap break-words ${
        hasBio ? "text-white" : "text-[#8e8e8e] italic"
      }`}
    >
      {hasBio ? bio : ""}
    </p>
  );
}
