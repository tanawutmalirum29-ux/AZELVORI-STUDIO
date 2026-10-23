import type { CSSProperties } from "react";
const paths: Record<string, string> = {
  arrow: "M5 12h14m-6-6 6 6-6 6",
  northeast: "M6 18 18 6M6 6h12v12",
  check: "m5 12 4 4L19 6",
  code: "m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18",
  globe:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  game: "M6 8h12c3 0 5 11 2 12-2 1-4-3-5-3H9c-1 0-3 4-5 3C1 19 3 8 6 8Zm0 4v4m-2-2h4m7-1h.01M18 15h.01M10 8V5h4",
  bug: "M8 8h8v9a4 4 0 0 1-8 0V8Zm2 0V6a2 2 0 0 1 4 0v2M3 10l5 2m13-2-5 2M3 16h5m13 0h-5M5 22l4-3m10 3-4-3M12 9v11",
  spark: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6",
  chat: "M21 15a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v9ZM7 8h10M7 12h6",
  folder: "M3 6h7l2 3h9v11H3V6Z",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-5v5l3 2",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "m6 6 12 12M6 18 18 6",
  back: "M19 12H5m6-6-6 6 6 6",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  lock: "M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4",
  mail: "M3 5h18v14H3zM3 5l9 8 9-8",
  refresh: "M20 8a9 9 0 1 0 1 7M20 3v6h-6",
  monitor: "M3 3h18v14H3zM8 21h8m-4-4v4",
};
export function Icon({
  name,
  size = 20,
  style,
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name] ?? paths.spark} />
    </svg>
  );
}
export function Mark() {
  return (
    <img
      src="/brand/azelvori-symbol.svg"
      width="32"
      height="32"
      alt=""
      aria-hidden="true"
      decoding="async"
    />
  );
}
