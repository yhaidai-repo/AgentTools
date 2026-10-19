// A person as people read them: "yaroslav.haidai@approvedadmissions.com" → "Yaroslav Haidai"; "Name <mail>" → "Name".
// Anything else stays as it is.
export function personName(value: string): string {
  const named = /^(.+?)\s*<[^>]+>$/.exec(value);

  if (named) {
    return named[1];
  }

  if (!value.includes("@")) {
    return value;
  }

  return value.split("@")[0].split(/[._-]+/).filter(Boolean).map(capitalize).join(" ");
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
