"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface ProgressiveImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  containerClassName?: string;
  priority?: boolean;
  sizes?: string;
  placeholder?: "blur" | "empty";
  blurDataURL?: string;
  objectPosition?: string;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * ProgressiveImage Component
 *
 * An optimized image component that:
 * - Shows a blur placeholder while loading
 * - Fades in smoothly when loaded
 * - Uses Next.js Image optimization
 * - Handles loading and error states
 *
 * Performance Benefits:
 * - Reduced LCP (Largest Contentful Paint)
 * - Better perceived performance with blur placeholder
 * - Lazy loading by default (unless priority is true)
 * - Proper sizing with srcset
 */
export function ProgressiveImage({
  src,
  alt,
  width,
  height,
  fill = false,
  className,
  containerClassName,
  priority = false,
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
  placeholder = "blur",
  blurDataURL,
  objectPosition,
  onLoad,
  onError,
}: ProgressiveImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Generate a tiny blur placeholder if not provided
  const defaultBlurDataURL =
    blurDataURL ||
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlMmU4ZjAiLz48L3N2Zz4=";

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  // Reset state when src changes - use a layout effect to avoid render phase setState
  useEffect(() => {
    // Use a microtask to avoid setting state during render
    const timeoutId = setTimeout(() => {
      setIsLoaded(false);
      setHasError(false);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [src]);

  // Preload high priority images
  useEffect(() => {
    if (priority && typeof window !== "undefined") {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = src;
      document.head.appendChild(link);

      return () => {
        document.head.removeChild(link);
      };
    }
  }, [src, priority]);

  if (hasError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-gray-100 dark:bg-gray-800",
          fill ? "absolute inset-0" : "",
          containerClassName
        )}
        style={!fill ? { width, height } : undefined}
      >
        <div className="text-center p-4">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="mt-2 text-sm text-gray-500">Failed to load image</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        fill ? "absolute inset-0" : "",
        containerClassName
      )}
    >
      {/* Blur placeholder */}
      {!isLoaded && placeholder === "blur" && (
        <div
          className={cn(
            "absolute inset-0 bg-gray-200 dark:bg-gray-800 animate-pulse",
            "transition-opacity duration-500",
            isLoaded ? "opacity-0" : "opacity-100"
          )}
        />
      )}

      {/* Actual image */}
      <Image
        src={src}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        fill={fill}
        priority={priority}
        sizes={sizes}
        placeholder={placeholder}
        blurDataURL={defaultBlurDataURL}
        onLoad={handleLoad}
        onError={handleError}
        style={objectPosition ? { objectPosition } : undefined}
        className={cn(
          "transition-opacity duration-500",
          isLoaded ? "opacity-100" : "opacity-0",
          className
        )}
      />
    </div>
  );
}

/**
 * OptimizedHeroImage
 *
 * Pre-configured ProgressiveImage for hero sections
 * - Always priority loaded
 * - Fill mode for responsive sizing
 * - Optimized for LCP
 */
export function OptimizedHeroImage({
  src,
  alt,
  className,
  containerClassName,
  priority = true,
}: Omit<ProgressiveImageProps, "fill" | "sizes">) {
  return (
    <ProgressiveImage
      src={src}
      alt={alt}
      fill
      priority={priority}
      sizes="100vw"
      className={cn("object-cover", className)}
      containerClassName={containerClassName}
    />
  );
}

/**
 * OptimizedCardImage
 *
 * Pre-configured ProgressiveImage for card components
 * - Lazy loaded by default
 * - Fixed aspect ratio
 */
export function OptimizedCardImage({
  src,
  alt,
  className,
  containerClassName,
  aspectRatio = "16/9",
}: Omit<ProgressiveImageProps, "fill" | "sizes"> & { aspectRatio?: string }) {
  return (
    <div
      className={cn("relative overflow-hidden", containerClassName)}
      style={{ aspectRatio }}
    >
      <ProgressiveImage
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        className={cn("object-cover", className)}
        containerClassName="absolute inset-0"
      />
    </div>
  );
}

/**
 * OptimizedAvatar
 *
 * Pre-configured ProgressiveImage for avatar/profile pictures
 * - Small, fixed size
 * - High priority for above-fold avatars
 */
export function OptimizedAvatar({
  src,
  alt,
  size = 48,
  priority = false,
  className,
}: {
  src: string;
  alt: string;
  size?: number;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-full overflow-hidden bg-gray-200",
        className
      )}
      style={{ width: size, height: size }}
    >
      <ProgressiveImage
        src={src}
        alt={alt}
        width={size}
        height={size}
        priority={priority}
        className="object-cover"
        placeholder="empty" // Avatars usually too small for blur effect
      />
    </div>
  );
}
