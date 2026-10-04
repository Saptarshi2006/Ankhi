Source media for the timeline. Gitignored — too large to commit.

Names follow the convention in content/years.ts:
  y<N>-<letter>.jpg   one photo, four per beat (a b c d)
  y<N>-v.mp4          one clip per beat

Replace these with real files and re-run npm run build; the optimise and
encode steps skip anything whose source is newer than its output.
