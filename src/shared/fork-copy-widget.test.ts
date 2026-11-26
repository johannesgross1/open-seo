import { describe, expect, it } from "vitest";
import {
  FORK_COPY_WIDGET_SRC,
  wantsForkCopyWidget,
  withForkCopyWidget,
} from "./fork-copy-widget";
import { reportDocumentResponse } from "./report-sandbox";

const DRAFT =
  '<!doctype html><html><body><div id="mail-body">Hi</div><button type="button" data-fork-widget="copy" data-copy-target="mail-body" hidden>Copy</button></body></html>';

describe("fork copy widget", () => {
  it("only opts in reports with a copy button", () => {
    expect(wantsForkCopyWidget(DRAFT)).toBe(true);
    expect(wantsForkCopyWidget("<!doctype html><p>Report</p>")).toBe(false);
  });

  it("puts the script right after the doctype", () => {
    const out = withForkCopyWidget(DRAFT, "abc");
    expect(
      out.startsWith(
        `<!doctype html><script nonce="abc" src="${FORK_COPY_WIDGET_SRC}" defer></script>`,
      ),
    ).toBe(true);
  });

  it("serves a draft with the script allowed by nonce", async () => {
    const res = reportDocumentResponse(DRAFT, { cacheControl: "no-store" });
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    const body = await res.text();
    const nonce = /nonce="([^"]+)"/.exec(body)?.[1];
    expect(nonce).toBeTruthy();
    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(body).toContain(FORK_COPY_WIDGET_SRC);
  });

  it("leaves ordinary reports untouched", async () => {
    const html = "<!doctype html><p>Report</p>";
    const res = reportDocumentResponse(html, { cacheControl: "no-store" });
    expect(await res.text()).toBe(html);
    expect(res.headers.get("Content-Security-Policy")).not.toContain(
      "script-src",
    );
  });
});
