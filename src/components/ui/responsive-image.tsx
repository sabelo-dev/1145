import React from "react";

/** Local drop imagery has 360/720 AVIF and WebP variants (scripts/optimize-drop-images.mjs). */
const VARIANT = /^(\/images\/drop-001\/[a-z_]+)\.webp$/;

type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  /** Rendered width hint for the browser's source choice. */
  sizes?: string;
};

/**
 * An <img> that serves AVIF, then WebP, at the right width when variants
 * exist, and falls back to the plain source otherwise (e.g. CMS uploads).
 */
const ResponsiveImage: React.FC<Props> = ({ src, sizes = "(min-width: 1024px) 40vw, 90vw", ...img }) => {
  const base = VARIANT.exec(src)?.[1];
  if (!base) return <img src={src} {...img} />;
  return (
    <picture>
      <source type="image/avif" srcSet={`${base}-360.avif 360w, ${base}-720.avif 720w`} sizes={sizes} />
      <source type="image/webp" srcSet={`${base}-360.webp 360w, ${base}.webp 720w`} sizes={sizes} />
      <img src={src} {...img} />
    </picture>
  );
};

export default ResponsiveImage;
