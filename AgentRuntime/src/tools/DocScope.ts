import { resolveInside, toRelative } from "./safePath";

// What the doc tools may see: inside `root`, not hidden (dot) paths, not the excluded folders.
export class DocScope {
  private readonly exclude: string[];

  constructor(
    readonly root: string,
    exclude: string[] = [],
  ) {
    this.exclude = exclude.map((folder) => folder.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "")).filter(Boolean);
  }

  resolve(path: string): string {
    const fullPath = resolveInside(this.root, path);

    if (!this.isVisible(fullPath)) {
      throw new Error(`Path is not available to agents: ${path}`);
    }

    return fullPath;
  }

  isVisible(fullPath: string): boolean {
    const relative = toRelative(this.root, fullPath);
    const isHidden = relative.split("/").some((segment) => segment.startsWith("."));
    const isExcluded = this.exclude.some((folder) => relative === folder || relative.startsWith(`${folder}/`));

    return !isHidden && !isExcluded;
  }

  relative(fullPath: string): string {
    return toRelative(this.root, fullPath);
  }
}
