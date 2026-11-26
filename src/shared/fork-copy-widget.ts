// Fork: a copy button for reports that carry a message draft (an e-mail to
// paste into Gmail, for example). The script is a fixed file the fork ships
// (fork/branding/public/fork-copy-widget.js, copied into src/public/ when the
// image is built), injected with the same per-response nonce as upstream's
// widget bundle. Like that bundle it only reads the page: it copies the
// element a button points at and never evaluates anything stored in a report.
//
// A report opts in by containing a button such as
//
//   <button type="button" data-fork-widget="copy"
//           data-copy-target="mail-body" hidden>Copy</button>
//
// Reports without one are served byte for byte as upstream serves them.

export const FORK_COPY_WIDGET_SRC = "/fork-copy-widget.js";

const MARKER = 'data-fork-widget="copy"';

export function wantsForkCopyWidget(html: string): boolean {
  return html.includes(MARKER);
}

/**
 * Same splice as upstream's withWidgetScript: right after the doctype, where
 * nothing a stored document wrote can precede the tag and absorb the nonce.
 */
export function withForkCopyWidget(html: string, nonce: string): string {
  const tag = `<script nonce="${nonce}" src="${FORK_COPY_WIDGET_SRC}" defer></script>`;
  const doctype = /^\s*<!doctype[^>]*>/i.exec(html);
  if (!doctype) return tag + html;
  const end = doctype.index + doctype[0].length;
  return html.slice(0, end) + tag + html.slice(end);
}

/**
 * Lets a framed report write to the clipboard. Only takes effect for a report
 * whose own CSP admits the copy script; every other report runs no script.
 */
export const FORK_REPORT_IFRAME_ALLOW = "clipboard-write *";
