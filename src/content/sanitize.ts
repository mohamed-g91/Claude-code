import DOMPurify from 'dompurify';

const ALLOWED_TAGS = ['p', 'b', 'strong', 'i', 'em', 'ul', 'ol', 'li', 'br', 'u'];

/** All Notion HTML goes through this before it ever reaches innerHTML. */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: [] });
}
