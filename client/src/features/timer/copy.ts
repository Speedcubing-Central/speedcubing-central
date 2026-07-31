// These moved to shared/src/copy.ts (exported from '@scc/shared') so the mobile
// app copies solves and averages as exactly the same text, rather than a second
// implementation that could drift. Copied text is something a user carries
// elsewhere, so the two platforms disagreeing would be visible in whatever they
// pasted it into. Nothing about the web behaviour changed: this re-export keeps
// every existing import in this folder working exactly as before.
export { formatSolveCopy, formatAverageCopy, formatScrambleForCopy } from '@scc/shared';
export { copyText } from '../../lib/clipboard';
