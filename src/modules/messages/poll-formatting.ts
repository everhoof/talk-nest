import { FilterXSS } from 'xss';
import { BadRequestException } from '@modules/common/exceptions/exceptions';

const formattingFilter = new FilterXSS({
  whiteList: { strong: [], em: [], u: [], s: [] },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style', 'iframe', 'object'],
});

function decodeEntities(value: string): string {
  const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code: string) => {
    if (!code.startsWith('#')) return entities[code.toLowerCase()] ?? entity;
    const hexadecimal = code[1].toLowerCase() === 'x';
    const point = parseInt(code.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
  });
}

export function getPollText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ''));
}

export function sanitizePollText(value: string, maxLength: number): string {
  const html = formattingFilter.process(value.trim());
  const text = getPollText(html).trim();
  if (!text || text.length > maxLength) throw new BadRequestException('POLL_INVALID');
  return html;
}
