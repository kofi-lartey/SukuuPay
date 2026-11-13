/**
 * Renders a message body with `@mentions` highlighted.
 *
 * The mentions are the ones stored with the message (`mentions: [{ userId, name }]`),
 * not a regex over arbitrary text. That distinction matters: `@Kwame` in a sentence
 * about a different Kwame would otherwise light up as a mention of someone the
 * author did not name. The stored list is the author's actual answer to "who did I
 * mean".
 *
 * Returns segments rather than JSX so the caller decides the styling, which lets the
 * chat bubble use light text on teal and the thread use dark text on white without
 * two copies of the parser.
 */

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @param {string} body
 * @param {Array<{ userId?: string, name?: string }>} mentions
 * @returns {Array<{ text: string, mentioned: boolean }>}
 */
export const splitOnMentions = (body, mentions) => {
  const text = body || '';
  if (!text) return [];

  const names = (Array.isArray(mentions) ? mentions : [])
    .map((m) => (m?.name || '').trim())
    .filter((name) => name.length > 0);

  if (names.length === 0) return [{ text, mentioned: false }];

  // Longest first, so "@Kwame Mensah" wins over "@Kwame" when both are mentioned.
  const pattern = new RegExp(`(@(?:${names.sort((a, b) => b.length - a.length).map(escapeRegExp).join('|')}))`, 'g');

  const segments = [];
  let lastIndex = 0;
  let match;

  // eslint-disable-next-line no-cond-assign
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), mentioned: false });
    }
    segments.push({ text: match[0], mentioned: true });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), mentioned: false });
  }

  return segments;
};

/**
 * The `mentions` payload for a message body, derived from the member list the
 * picker used.
 *
 * Matching is on the inserted token (`@First Name`), so a mention that the user
 * typed by hand and never picked still resolves — provided it names a real member.
 */
export const mentionsInBody = (body, members) => {
  const text = body || '';
  if (!text || !Array.isArray(members) || members.length === 0) return [];

  const found = [];
  for (const member of members) {
    const name = member?.name;
    if (!name) continue;
    const token = `@${name}`;
    if (text.includes(token)) {
      found.push({ userId: member._id, name });
    }
  }
  return found;
};

export default splitOnMentions;