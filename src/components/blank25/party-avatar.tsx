import Image from "next/image";
import { cn } from "@/lib/utils";

export const getPartyParticipantMonogram = (name: string) => {
  const normalized = name.trim().replace(/\s+/g, "");
  if (!normalized) return "??";
  const chars = Array.from(normalized);
  return chars.slice(0, Math.min(2, chars.length)).join("").toUpperCase();
};

export function PartyAvatar({
  name,
  iconDataUrl,
  className,
  monogramClassName,
}: {
  name: string;
  iconDataUrl: string | null;
  className?: string;
  monogramClassName?: string;
}) {
  const monogram = getPartyParticipantMonogram(name);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.2rem] border border-purple-300/20 bg-[radial-gradient(circle_at_top,rgba(192,132,252,0.16),transparent_70%),rgba(3,7,18,0.92)]",
        className,
      )}
    >
      {iconDataUrl ? (
        <Image
          src={iconDataUrl}
          alt={`${name} のアイコン`}
          fill
          unoptimized
          sizes="64px"
          className="object-cover"
        />
      ) : (
        <div
          className={cn(
            "flex h-full w-full items-center justify-center text-sm font-black tracking-[0.08em] text-purple-100",
            monogramClassName,
          )}
        >
          {monogram}
        </div>
      )}
    </div>
  );
}
