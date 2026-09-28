Source media for the timeline. Committed, deliberately — the site is not
reproducible without it, and a build that falls back to placeholders is a
different site. ~21MB.

Names follow the convention in content/years.ts:
  y<N>-<letter>.jpg   one photo, four per beat (a b c d)
  y<N>-v.mp4          one clip per beat

Two files here are not timeline photographs and are named for what they are:
  intro-0.jpg         the two of them, in the slot the intro's title vacates
  fun-<n>.jpg/.mp4    the seven targets on the fun page's net (content/fun.ts)

Replace these with real files and re-run npm run build; the optimise and
encode steps skip anything whose source is newer than its output.
