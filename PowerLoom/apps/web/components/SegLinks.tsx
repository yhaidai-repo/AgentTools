import Link from "next/link";

interface SegLinksProps {
  /** The URL parameter the choice sets. */
  name: string;
  value: string;
  options: { key: string; label: string }[];
  /** The page's path and the other parameters to keep (e.g. the dashboard's tab). */
  path: string;
  keep: Record<string, string>;
  small?: boolean;
}

// A one-of choice as a pill of links (a period, a chart's metric): the choice lives in the URL, no form needed.
export function SegLinks({ name, value, options, path, keep, small = false }: SegLinksProps) {
  return (
    <nav className={`seg${small ? " small" : ""}`}>
      {options.map((option) => (
        <Link key={option.key} href={hrefOf(path, { ...keep, [name]: option.key })} className={option.key === value ? "active" : undefined} scroll={false}>{option.label}</Link>
      ))}
    </nav>
  );
}

function hrefOf(path: string, params: Record<string, string>): string {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== ""));

  return `${path}?${query.toString()}`;
}
