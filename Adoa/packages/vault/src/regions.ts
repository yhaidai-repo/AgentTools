// Replaces the content between `<!-- adoa:begin name -->` and `<!-- adoa:end … -->`; unknown regions are left as is.
export function replaceRegions(body: string, regions: Record<string, string>): string {
  return Object.entries(regions).reduce((text, [name, content]) => replaceRegion(text, name, content), body);
}

function replaceRegion(body: string, name: string, content: string): string {
  const pattern = new RegExp(`(<!-- adoa:begin ${name} -->\n)[\s\S]*?(\n<!-- adoa:end[^>]*-->)`);

  return body.replace(pattern, (_match, begin: string, end: string) => `${begin}${content}${end}`);
}
