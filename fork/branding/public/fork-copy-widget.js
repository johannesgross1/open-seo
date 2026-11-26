/* oxlint-disable */
/* Copy buttons for message drafts in reports (see src/shared/fork-copy-widget.ts).
   Copies the element a button points at, as rich HTML (links stay clickable
   when pasted into a mail client) plus plain text. Reads the page only. */
(function () {
  "use strict";

  function selectAndCopy(el) {
    var sel = window.getSelection();
    var range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (e) {
      ok = false;
    }
    sel.removeAllRanges();
    return ok ? Promise.resolve() : Promise.reject(new Error("copy failed"));
  }

  function copy(el, plain) {
    var text = el.innerText;
    var clip = navigator.clipboard;
    if (plain) {
      if (clip && clip.writeText) {
        return clip.writeText(text).catch(function () {
          return selectAndCopy(el);
        });
      }
      return selectAndCopy(el);
    }
    if (clip && clip.write && typeof ClipboardItem !== "undefined") {
      var item = new ClipboardItem({
        "text/html": new Blob([el.innerHTML], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      });
      return clip.write([item]).catch(function () {
        return selectAndCopy(el);
      });
    }
    return selectAndCopy(el);
  }

  function flash(btn, label) {
    var original = btn.getAttribute("data-label") || btn.textContent;
    btn.setAttribute("data-label", original);
    btn.textContent = label;
    clearTimeout(btn._forkTimer);
    btn._forkTimer = setTimeout(function () {
      btn.textContent = original;
    }, 2000);
  }

  function init() {
    var buttons = document.querySelectorAll('[data-fork-widget="copy"]');
    for (var i = 0; i < buttons.length; i++) {
      (function (btn) {
        var target = document.getElementById(btn.getAttribute("data-copy-target") || "");
        if (!target) return;
        btn.hidden = false;
        btn.addEventListener("click", function () {
          copy(target, btn.getAttribute("data-copy-mode") === "text").then(
            function () {
              flash(btn, btn.getAttribute("data-copied-label") || "Kopiert ✓");
            },
            function () {
              flash(btn, btn.getAttribute("data-failed-label") || "Bitte markieren und kopieren");
            }
          );
        });
      })(buttons[i]);
    }
    var hints = document.querySelectorAll("[data-fork-copy-hint]");
    for (var j = 0; j < hints.length; j++) hints[j].hidden = true;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
