'use client';

/* eslint-disable @next/next/no-img-element */

import { ImgHTMLAttributes, useState } from 'react';

type ExternalImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> & {
  src: string;
  alt: string;
  fallbackSrc?: string;
  hideOnError?: boolean;
};

export default function ExternalImage({
  src,
  alt,
  fallbackSrc,
  hideOnError = false,
  loading = 'lazy',
  decoding = 'async',
  referrerPolicy = 'no-referrer',
  onError,
  ...props
}: ExternalImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  return (
    <img
      {...props}
      src={currentSrc}
      alt={alt}
      loading={loading}
      decoding={decoding}
      referrerPolicy={referrerPolicy}
      onError={(event) => {
        if (fallbackSrc && currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        } else if (hideOnError) {
          setHidden(true);
        }

        onError?.(event);
      }}
    />
  );
}
