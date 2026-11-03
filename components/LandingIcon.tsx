/**
 * A Material Symbol at a set size. The size is inline because the icon font's
 * own stylesheet sets 24px outside any cascade layer, which beats a Tailwind
 * `text-[…]` utility.
 */
export default function LandingIcon({
  name,
  size,
  className = "",
  filled = false,
}: {
  name: string;
  size: number;
  className?: string;
  filled?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined ${className}`}
      style={{ fontSize: size, ...(filled ? { fontVariationSettings: "'FILL' 1" } : {}) }}
    >
      {name}
    </span>
  );
}
