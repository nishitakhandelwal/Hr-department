import React from "react";

import { cn } from "@/lib/utils";
import { DEFAULT_LOGO_SRC } from "@/lib/images";

type ImageWithFallbackProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  fallbackSrc?: string;
};

const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  src,
  alt,
  fallbackSrc = DEFAULT_LOGO_SRC,
  className,
  onError,
  ...props
}) => {
  const [currentSrc, setCurrentSrc] = React.useState(src || fallbackSrc);

  React.useEffect(() => {
    setCurrentSrc(src || fallbackSrc);
  }, [fallbackSrc, src]);

  return (
    <img
      {...props}
      src={currentSrc || fallbackSrc}
      alt={alt}
      className={cn("object-contain", className)}
      onError={(event) => {
        if (currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        }
        onError?.(event);
      }}
    />
  );
};

export default ImageWithFallback;
