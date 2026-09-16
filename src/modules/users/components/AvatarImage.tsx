import Image from "next/image";
import { safeImageUrl } from "@/shared/security/urls";

type AvatarImageProps = {
  src?: string | null;
  alt?: string;
  sizes: string;
  className: string;
  imageClassName?: string;
  eager?: boolean;
};

/**
 * Responsive avatar rendering with one quality step above Next.js' default.
 * Upload previews use their local blob directly; persisted avatars use the
 * image optimizer so small UI avatars do not download the 1600px source.
 */
export default function AvatarImage({
  src,
  alt = "",
  sizes,
  className,
  imageClassName,
  eager = false,
}: AvatarImageProps) {
  const safeSrc = safeImageUrl(src);
  const imageClasses = `object-cover object-center ${imageClassName ?? ""}`.trim();

  return (
    <span className={`relative block overflow-hidden bg-[#3A3A3C] ${className}`}>
      {safeSrc &&
        (safeSrc.startsWith("blob:") ? (
          // Blob URLs only exist for local previews and cannot be optimized server-side.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={safeSrc} alt={alt} className={`h-full w-full ${imageClasses}`} />
        ) : (
          <Image
            src={safeSrc}
            alt={alt}
            fill
            sizes={sizes}
            quality={82}
            loading={eager ? "eager" : "lazy"}
            className={imageClasses}
          />
        ))}
    </span>
  );
}
