import { realpath } from "node:fs/promises";
import { resolveExistingInside, resolveInside, toRelative } from "./safePath";

// What the doc tools may see: inside `root`, not hidden (dot) paths, not the excluded folders.
export class DocScope {
  private readonly exclude: string[];

  constructor(
    readonly root: string,
    exclude: string[] = [],
  ) {
    this.exclude = exclude.map((folder) => folder.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "")).filter(Boolean);
  }

  async resolve(path: string): Promise<string> {
    const fullPath = resolveInside(this.root, path);

    if (!this.visible(toRelative(this.root, fullPath))) {
      throw new Error(`Path is not available to agents: ${path}`);
    }

    const canonical = await resolveExistingInside(this.root, path);
    if (!this.visible(toRelative(await realpath(this.root), canonical))) {
      throw new Error(`Path is not available to agents: ${path}`);
    }
    return canonical;
  }

  async isVisible(fullPath: string): Promise<boolean> {
    try {
      await this.resolve(toRelative(await realpath(this.root), fullPath));
      return true;
    } catch {
      return false;
    }
  }

  private visible(relative: string): boolean {
    const isHidden = relative.split("/").some((segment) => segment.startsWith("."));
    const isExcluded = this.exclude.some((folder) => relative === folder || relative.startsWith(`${folder}/`));

    return !isHidden && !isExcluded;
  }

  async relative(fullPath: string): Promise<string> {
    return toRelative(await realpath(this.root), fullPath);
  }
}
