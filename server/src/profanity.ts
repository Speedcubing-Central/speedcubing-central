// A small, self-contained word-list filter for Battle Mode chat — no
// external dependency, since this only needs to catch plain English
// profanity, not be bulletproof against deliberate evasion. Matches whole
// words only (word-boundary regex, case-insensitive) so it doesn't clip
// substrings inside innocent words (e.g. "class", "assist"), and censors
// each match in place (same length, asterisks) rather than rejecting the
// whole message — one stray word shouldn't nuke an otherwise fine chat line.
const WORDS = [
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'cunt',
  'dick',
  'piss',
  'slut',
  'whore',
  'nigger',
  'nigga',
  'faggot',
  'fag',
  'retard',
  'motherfucker',
  'dumbass',
  'douchebag',
  'twat',
  'wanker',
  'cock',
  'pussy',
];

const PATTERN = new RegExp(`\\b(${WORDS.join('|')})\\b`, 'gi');

export function censorMessage(message: string): string {
  return message.replace(PATTERN, (match) => '*'.repeat(match.length));
}
