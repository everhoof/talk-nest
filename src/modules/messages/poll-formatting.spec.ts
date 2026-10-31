import { getPollText, sanitizePollText } from './poll-formatting';
import { BadRequestException } from '@modules/common/exceptions/exceptions';

describe('poll formatting', () => {
  it('retains nested text marks and removes paragraph wrappers', () => {
    expect(sanitizePollText('<p><strong><em><u><s>Рок</s></u></em></strong></p>', 100)).toBe(
      '<strong><em><u><s>Рок</s></u></em></strong>',
    );
  });

  it('removes executable content, attributes and unsupported elements', () => {
    expect(
      sanitizePollText(
        '<script>alert(1)</script><strong onclick="alert(1)" style="color:red">Рок</strong><img src=x onerror=alert(1)>',
        100,
      ),
    ).toBe('<strong>Рок</strong>');
  });

  it('checks visible text while decoding entities exactly once', () => {
    expect(getPollText('<strong>&amp; &lt; &#x1f3b5; &amp;lt;</strong>')).toBe('& < 🎵 &lt;');
    expect(sanitizePollText('<strong>&amp; &lt; &#x1f3b5; &amp;lt;</strong>', 100)).toBe(
      '<strong>&amp; &lt; &#x1f3b5; &amp;lt;</strong>',
    );
  });

  it('counts visible text rather than HTML tags for the length limit', () => {
    expect(sanitizePollText(`<strong>${'a'.repeat(300)}</strong>`, 300)).toContain('a'.repeat(300));
    expect(() => sanitizePollText(`<em>${'a'.repeat(101)}</em>`, 100)).toThrow(BadRequestException);
    expect(() => sanitizePollText('<strong> </strong>', 100)).toThrow(BadRequestException);
    expect(() => sanitizePollText('<script>alert(1)</script>', 100)).toThrow(BadRequestException);
  });

  it('accepts unformatted text and escaped literal markup', () => {
    expect(sanitizePollText('Рок', 100)).toBe('Рок');
    expect(sanitizePollText('<p>Рок</p>', 100)).toBe('Рок');
    expect(getPollText(sanitizePollText('&lt;Рок&gt;', 100))).toBe('<Рок>');
  });
});
