// Fork-only: the project's own brand can go by several names in AI answers,
// such as a company and the events it runs. Write them all in the project's
// brand name, separated by "|" (for example "Acme | Acme Summit"). Each name
// counts as a mention and makes a prompt branded. Competitors keep one name.

const ALIAS_SEPARATOR = "|";

/** The names in a brand name, in order; the name itself when it has no "|". */
export function brandAliases(name: string): string[] {
  const names = name
    .split(ALIAS_SEPARATOR)
    .map((part) => part.trim())
    .filter((part) => part !== "");
  return names.length ? names : [name];
}
