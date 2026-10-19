const MAX_LENGTH = 60;

// A long link as people scan it: the host and the end of the path, the full one stays in the title.
// https://dev.azure.com/org/…/_apis/wit/attachments/1e63…?fileName=image.png → dev.azure.com/…/image.png
export function shortUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const fileName = parsed.searchParams.get("fileName");
    const last = fileName ?? parsed.pathname.split("/").filter(Boolean).at(-1) ?? "";
    const short = parsed.pathname.split("/").filter(Boolean).length > 1 || fileName ? `${parsed.host}/…/${last}` : `${parsed.host}/${last}`;

    return short.length > MAX_LENGTH ? `${short.slice(0, MAX_LENGTH - 1)}…` : short;
  } catch {
    return url.length > MAX_LENGTH ? `${url.slice(0, MAX_LENGTH - 1)}…` : url;
  }
}
