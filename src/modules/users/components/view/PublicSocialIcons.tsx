import { normalizeSocialLink } from "@/modules/users/validation";

interface PublicSocialIconsProps {

  facebookUrl: string | null;

  instagramUrl: string | null;

  tiktokUrl: string | null;

  youtubeUrl: string | null;

}



type Platform = "facebook" | "instagram" | "tiktok" | "youtube";



/** Official TikTok note (Simple Icons / brand geometry), 24×24 viewBox. */

const TIKTOK_NOTE_PATH =

  "M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-2.901 2.88 2.896 2.896 0 0 1-2.892-2.88 2.896 2.896 0 0 1 2.892-2.88c.277 0 .542.044.792.12v-3.52a6.34 6.34 0 0 0-.792-.05A6.338 6.338 0 0 0 3 15.672 6.338 6.338 0 0 0 9.373 22a6.338 6.338 0 0 0 6.373-6.328V9.284A8.16 8.16 0 0 0 20.3 10.63V7.177a4.83 4.83 0 0 1-.711-.491z";



const ICON_CLASS = "h-5 w-5 shrink-0";



function LinkIcon({ platform }: { platform: Platform }) {

  if (platform === "facebook") {

    return (

      <svg viewBox="0 0 24 24" className={ICON_CLASS} aria-hidden="true">

        <circle cx="12" cy="12" r="10" fill="#1877F2" />

        <path

          fill="#fff"

          d="M13.5 21v-7.5h2.5l.4-3H13.5V8.5c0-.9.25-1.5 1.55-1.5H16.5V4.3C16.2 4.26 15.2 4.17 14 4.17c-2.4 0-4 1.46-4 4.14V10.5H7.5v3H10V21h3.5z"

        />

      </svg>

    );

  }

  if (platform === "instagram") {

    return (

      <svg viewBox="0 0 24 24" className={ICON_CLASS} aria-hidden="true">

        <defs>

          <linearGradient id="public-profile-instagram" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">

            <stop stopColor="#FD5949" />

            <stop offset="0.5" stopColor="#D6249F" />

            <stop offset="1" stopColor="#285AEB" />

          </linearGradient>

        </defs>

        <rect

          x="2"

          y="2"

          width="20"

          height="20"

          rx="5"

          fill="none"

          stroke="url(#public-profile-instagram)"

          strokeWidth="2"

        />

        <circle cx="12" cy="12" r="4" fill="none" stroke="url(#public-profile-instagram)" strokeWidth="2" />

        <circle cx="17.5" cy="6.5" r="1" fill="url(#public-profile-instagram)" />

      </svg>

    );

  }

  if (platform === "tiktok") {

    return (

      <svg viewBox="0 0 24 24" className={ICON_CLASS} aria-hidden="true">

        <path fill="#25F4EE" d={TIKTOK_NOTE_PATH} transform="translate(-0.85 -0.85)" />

        <path fill="#FE2C55" d={TIKTOK_NOTE_PATH} transform="translate(0.85 0.85)" />

        <path fill="#FFFFFF" d={TIKTOK_NOTE_PATH} />

      </svg>

    );

  }

  return (

    <svg viewBox="0 0 24 24" className={ICON_CLASS} aria-hidden="true">

      <path

        fill="#FF0000"

        d="M23.5 6.2a3.05 3.05 0 0 0-2.15-2.16C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.35.44A3.05 3.05 0 0 0 .5 6.2 31.9 31.9 0 0 0 0 12a31.9 31.9 0 0 0 .5 5.8 3.05 3.05 0 0 0 2.15 2.16C4.5 20.4 12 20.4 12 20.4s7.5 0 9.35-.44a3.05 3.05 0 0 0 2.15-2.16A31.9 31.9 0 0 0 24 12a31.9 31.9 0 0 0-.5-5.8z"

      />

      <path fill="#fff" d="M9.75 15.57V8.43L15.84 12l-6.09 3.57z" />

    </svg>

  );

}



const PLATFORM_LABEL: Record<Platform, string> = {

  facebook: "Facebook",

  instagram: "Instagram",

  tiktok: "TikTok",

  youtube: "YouTube",

};



/** YouTube-style hairline chip on the same black as the public profile page. */

const PILL_CLASS =

  "flex h-9 shrink-0 items-center gap-2 rounded-[14px] border border-white/10 bg-[#191919] px-4 font-body text-[14px] text-white active:scale-[0.98]";



/**

 * Read-only social links on another user's profile. Only platforms with a

 * stored URL are rendered — empty slots are omitted entirely, not shown

 * disabled. Labeled chips scroll horizontally when they do not fit.

 */

export default function PublicSocialIcons({

  facebookUrl,

  instagramUrl,

  tiktokUrl,

  youtubeUrl,

}: PublicSocialIconsProps) {

  const candidates: { platform: Platform; url: string }[] = [

    facebookUrl ? { platform: "facebook" as const, url: facebookUrl } : null,

    instagramUrl ? { platform: "instagram" as const, url: instagramUrl } : null,

    tiktokUrl ? { platform: "tiktok" as const, url: tiktokUrl } : null,

    youtubeUrl ? { platform: "youtube" as const, url: youtubeUrl } : null,

  ].filter((link): link is { platform: Platform; url: string } => link !== null);

  const links = candidates.flatMap((link) => {
    const url = normalizeSocialLink(link.platform, link.url);
    return url ? [{ ...link, url }] : [];
  });



  if (links.length === 0) return null;



  return (

    <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain pb-1">

      <div className="flex w-max flex-nowrap items-center gap-2">

        {links.map((link) => (

          <a

            key={link.platform}

            href={link.url}

            target="_blank"

            rel="noopener noreferrer"

            aria-label={PLATFORM_LABEL[link.platform]}

            className={PILL_CLASS}

          >

            <LinkIcon platform={link.platform} />

            <span className="font-medium">{PLATFORM_LABEL[link.platform]}</span>

          </a>

        ))}

      </div>

    </div>

  );

}


