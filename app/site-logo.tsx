/**
 * The church logo, served as WebP with a PNG fallback.
 *
 * Both marks are line art with flat colour, which PNG stores badly: the wide
 * logo is 731KB as PNG and 21KB as WebP, and the seal 192KB against 31KB.
 * That difference is most of the site's remaining page weight, so it is worth
 * the extra markup. `<picture>` means browsers without WebP still get the PNG.
 *
 * Intrinsic width/height are always set so the browser reserves the right box
 * before the image loads, which keeps the header from jumping on first paint.
 */

interface LogoProps {
  className?: string;
  /** Empty for decorative use, where an adjacent link already names the church. */
  alt?: string;
  /** The header logo is part of the first paint; everything else can wait. */
  priority?: boolean;
}

/** Horizontal wordmark. Used in the header bar and the footer. */
export function WideLogo({ className, alt = "", priority = false }: LogoProps) {
  return (
    <picture>
      <source srcSet="/images/logo-wide-trimmed.webp" type="image/webp" />
      <img
        className={className}
        src="/images/logo-wide-trimmed.png"
        alt={alt}
        width={800}
        height={275}
        decoding={priority ? "sync" : "async"}
        loading={priority ? "eager" : "lazy"}
        {...(priority ? { fetchPriority: "high" as const } : {})}
      />
    </picture>
  );
}

/** Circular seal. Used as a decorative accent on longer pages. */
export function SealLogo({ className, alt = "" }: LogoProps) {
  return (
    <picture>
      <source srcSet="/images/logo-seal.webp" type="image/webp" />
      <img
        className={className}
        src="/images/logo-seal.png"
        alt={alt}
        width={320}
        height={320}
        decoding="async"
        loading="lazy"
      />
    </picture>
  );
}
