import { cn } from "@/lib/utils";

const GoogleMapsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
  </svg>
);

const WazeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M20.54 6.63A10.5 10.5 0 1 0 3.5 17.25c.4.63.96 1.12 1.6 1.44v1.56a.75.75 0 0 0 1.5 0v-1.12a10.43 10.43 0 0 0 9.8 0v1.12a.75.75 0 0 0 1.5 0V18.7a5.05 5.05 0 0 0 1.6-1.45 10.47 10.47 0 0 0 1.04-10.62ZM9.25 14a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Zm5.5 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z" />
  </svg>
);

interface NavButtonsProps {
  mapsUrl: string | null | undefined;
  wazeUrl: string | null | undefined;
  size?: "sm" | "lg";
  onClick?: () => void;
  className?: string;
}

export function NavButtons({ mapsUrl, wazeUrl, size = "sm", onClick, className }: NavButtonsProps) {
  if (!mapsUrl && !wazeUrl) return null;

  const base =
    size === "lg"
      ? "flex-1 flex items-center justify-center gap-2 text-sm font-semibold py-3 rounded-xl transition-colors"
      : "flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors";

  const iconSize = size === "lg" ? "w-4 h-4" : "w-3.5 h-3.5";

  const wrapperCls = size === "lg" ? "flex gap-3 w-full" : "flex gap-1.5 flex-wrap";

  return (
    <div className={cn(wrapperCls, size === "lg" && className)}>
      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClick}
          className={cn(base, "bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100", size === "sm" && className)}
        >
          <GoogleMapsIcon className={iconSize} />
          Google Maps
        </a>
      )}
      {wazeUrl && (
        <a
          href={wazeUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClick}
          className={cn(base, "bg-sky-50 text-sky-600 border border-sky-200 hover:bg-sky-100", size === "sm" && className)}
        >
          <WazeIcon className={iconSize} />
          Waze
        </a>
      )}
    </div>
  );
}
