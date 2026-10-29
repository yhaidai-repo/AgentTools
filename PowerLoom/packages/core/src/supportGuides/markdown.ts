import { fromMarkdown } from "mdast-util-from-markdown";

// Resolve inline, full/collapsed/shortcut reference images exactly as the renderer does.
export function guideImageReferences(markdown: string): { urls: string[]; html: boolean } {
  const tree = fromMarkdown(markdown), definitions = new Map<string, string>(), refs: string[] = [];
  let html = false;
  function walk(node: any, callback: (node: any) => void) {
    callback(node);
    for (const child of node.children ?? []) walk(child, callback);
  }
  walk(tree, node => { if (node.type === "definition" && !definitions.has(node.identifier)) definitions.set(node.identifier, node.url); });
  walk(tree, node => {
    if (node.type === "image") refs.push(node.url);
    if (node.type === "imageReference") refs.push(definitions.get(node.identifier) ?? "unresolved-image");
    if (node.type === "html") html = true;
  });
  return { urls: refs, html };
}
