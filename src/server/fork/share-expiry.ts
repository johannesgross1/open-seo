// Fork: public report links that expire on their own.
//
// A project opts in through its name: "[24h]" (any whole number of hours)
// anywhere in it makes every public link in that project stop working that
// many hours after it was created. Projects without the marker keep links
// that live until someone revokes them, exactly as upstream does.
//
// The clock starts at `sharedAt`, which upstream sets when a link is minted
// and leaves alone when sharing is re-enabled for a live link. A new link
// (revoke, then share again) starts a new window.

const MARKER = /\[(\d{1,4})h\]/i;

export function shareTtlHours(projectName: string | null | undefined) {
  if (!projectName) return null;
  const match = MARKER.exec(projectName);
  if (!match) return null;
  const hours = Number(match[1]);
  return hours > 0 ? hours : null;
}

export function isShareExpired(
  share: { projectName: string | null; sharedAt: string | null },
  now: Date = new Date(),
): boolean {
  const hours = shareTtlHours(share.projectName);
  if (hours === null) return false;
  // An opted-in project with no mint time cannot prove the link is fresh.
  if (!share.sharedAt) return true;
  const sharedAt = Date.parse(share.sharedAt);
  if (Number.isNaN(sharedAt)) return true;
  return now.getTime() - sharedAt >= hours * 60 * 60 * 1000;
}
