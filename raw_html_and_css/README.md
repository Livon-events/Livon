# Raw HTML & CSS (conversion source)

Static HTML/CSS elements and page mockups that still need to be converted
into React Server/Client Components. Not part of the running app — nothing
in `src/` should import from here directly.

Suggested workflow per page/element:
1. Drop the raw `.html` / `.css` here (keep original filenames so it's
   traceable back to source)
2. Note conversion status somewhere you'll see it — e.g. rename converted
   ones with a `-DONE` suffix, or keep a simple checklist in this file
3. Once converted into a component under `src/`, the raw version here can
   stay as a reference or be deleted — your call

This folder existing separately keeps the distinction clear: what's
finished (in `src/`) vs. what's still raw material.
