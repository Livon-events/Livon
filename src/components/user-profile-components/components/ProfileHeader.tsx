interface ProfileHeaderProps {
  username: string;
  connectionsCount: number;
  avatarUrl?: string;
}

export default function ProfileHeader({ username, connectionsCount, avatarUrl }: ProfileHeaderProps) {
  return (
    <div className="flex items-center gap-5 mb-5">
      <div
        className="w-16 h-16 max-[380px]:w-14 max-[380px]:h-14 rounded-full bg-[#d11a8c] flex-shrink-0 bg-cover bg-center"
        style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
      />
      <div className="flex flex-col gap-1">
        <div className="font-display text-[26px] max-[380px]:text-[22px] font-extrabold tracking-[-0.6px] text-white">
          {username}
        </div>
        <div className="text-[15px] font-medium text-[#AEAEB2]">
          {connectionsCount} connection{connectionsCount === 1 ? "" : "s"}
        </div>
      </div>
    </div>
  );
}
