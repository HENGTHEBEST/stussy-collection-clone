import { useState, type ImgHTMLAttributes } from 'react';

type SafeImageProps = ImgHTMLAttributes<HTMLImageElement> & { alt: string; fallbackLabel: string };

export function SafeImage(props: SafeImageProps) {
  // A new source gets a fresh attempt, including when returning to an older URL.
  return <ImageAttempt key={props.src} {...props} />;
}

function ImageAttempt({ fallbackLabel, alt, onError, className = '', style, width, height, ...props }: SafeImageProps) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div role="img" aria-label={fallbackLabel} className={`media-fallback ${className}`}
    style={{ ...(width && height ? { aspectRatio: `${width} / ${height}` } : {}), ...style }} />;
  return <img {...props} alt={alt} className={className} style={style} width={width} height={height}
    onError={(event) => { setFailed(true); onError?.(event); }} />;
}
