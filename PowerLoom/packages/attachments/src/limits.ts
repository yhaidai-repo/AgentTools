export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

// Files agents read as text; images are accepted but stored only.
export const READABLE_EXTENSIONS = [".pdf", ".docx", ".xlsx", ".csv", ".html", ".htm", ".md", ".markdown", ".txt"];
export const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
export const ACCEPTED_EXTENSIONS = [...READABLE_EXTENSIONS, ...IMAGE_EXTENSIONS];
