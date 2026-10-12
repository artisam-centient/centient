import { formatXp } from "./format";

interface XpCardProps {
  xpTotal: number;
  xpThisWeek: number;
}

/** Home's XP total (#201). Indigo is progress; tiers join it in #202. */
export default function XpCard({ xpTotal, xpThisWeek }: XpCardProps) {
  return (
    <section
      aria-label="Your XP"
      className="flex w-full items-end justify-between gap-4 rounded-3xl bg-tertiary p-6 text-on-tertiary shadow-[0_14px_32px_-10px_rgba(73,75,214,0.55)]"
    >
      <div className="flex flex-col gap-1.5">
        <span className="font-label text-[11px] font-bold uppercase leading-[15px] tracking-[0.2em] text-tertiary-fixed">
          XP
        </span>
        <span className="font-headline text-4xl font-extrabold leading-none tracking-tighter tabular-nums">
          {formatXp(xpTotal)}
        </span>
      </div>
      <span className="pb-0.5 font-body text-[13px] leading-[18px] text-tertiary-fixed">
        <span className="font-headline font-extrabold tabular-nums text-on-tertiary">+{formatXp(xpThisWeek)}</span>{" "}
        this week
      </span>
    </section>
  );
}
