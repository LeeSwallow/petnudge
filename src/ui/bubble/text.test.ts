import { describe, expect, it } from 'vitest';
import { moreLabel, bubbleText, fitBubble, lineCount, linePx, plainText, speak, splitSentences, textWidth } from './text';

describe('plainText', () => {
  it('drops bold, italic, code, heading and link markers', () => {
    expect(plainText('# 제목\n이건 **굵게** 말하고 *기울여* `코드`도 [문서](https://example.com) 봐요.')).toBe(
      '제목\n이건 굵게 말하고 기울여 코드도 문서 봐요.'
    );
  });

  it('keeps list items and code block lines as lines, without their markers', () => {
    expect(plainText('목록이에요.\n\n- 하나\n- *둘*\n\n1. 셋\n\n```js\nconst a = 1;\n```')).toBe('목록이에요.\n하나\n둘\n셋\nconst a = 1;');
  });

  it('drops markers that are not closed yet, and quote marks at a line start', () => {
    expect(plainText('이건 **굵')).toBe('이건 굵');
    expect(plainText('> 인용이에요\n```js\nconst a')).toBe('인용이에요\njs\nconst a');
  });

  it('leaves HTML as text (the bubble shows text, never elements)', () => {
    expect(plainText('<b>태그</b>')).toBe('<b>태그</b>');
  });
});

describe('splitSentences', () => {
  it('ends a sentence at . ! ? … ~ followed by a space or a newline', () => {
    expect(splitSentences('안녕! 반가워요. 뭐 해? 그냥… 놀자~ 그래')).toEqual({
      sentences: ['안녕!', '반가워요.', '뭐 해?', '그냥…', '놀자~'],
      rest: '그래'
    });
  });

  it('waits for what follows a mark at the end: it may not be the end yet', () => {
    expect(splitSentences('3.14를 봐요.')).toEqual({ sentences: [], rest: '3.14를 봐요.' });
    expect(splitSentences('정말?!')).toEqual({ sentences: [], rest: '정말?!' });
    expect(splitSentences('정말?! 응')).toEqual({ sentences: ['정말?!'], rest: '응' });
  });

  it('ends a line at a newline, and skips empty lines', () => {
    expect(splitSentences('1번째 줄\n\n2번째 줄\n3번')).toEqual({ sentences: ['1번째 줄', '2번째 줄'], rest: '3번' });
  });

  it('ends a long phrase at a Korean ending or a comma, a short one keeps going', () => {
    expect(splitSentences('오늘은 날씨가 좋아요 내일은 비가 온대')).toEqual({ sentences: ['오늘은 날씨가 좋아요'], rest: '내일은 비가 온대' });
    expect(splitSentences('네 좋아요 그럼')).toEqual({ sentences: [], rest: '네 좋아요 그럼' });
    expect(splitSentences('그건 그렇다 치고, 이건 어때')).toEqual({ sentences: ['그건 그렇다 치고,'], rest: '이건 어때' });
  });

  it('does not end a sentence at a number with a dot', () => {
    expect(splitSentences('목록 1. 사과 2. 배\n')).toEqual({ sentences: ['목록 1. 사과 2. 배'], rest: '' });
  });

  it('collapses the spaces inside a sentence', () => {
    expect(splitSentences('  하나   둘.  셋')).toEqual({ sentences: ['하나 둘.'], rest: '셋' });
  });

  it('never changes a sentence once a longer text has it (stable prefix)', () => {
    const text = '안녕하세요! 오늘은 **같이** 공부해요. 수학부터, 그다음은 영어를 볼까요? 1. 문제 풀기\n2. 정리하기\n끝~ 좋아';
    let before: string[] = [];
    for (let n = 0; n <= text.length; n++) {
      const { sentences } = splitSentences(plainText(text.slice(0, n)));
      expect(sentences.slice(0, before.length)).toEqual(before);
      before = sentences;
    }
  });
});

describe('speak', () => {
  it('adds the sentences finished since last time, never the one still coming', () => {
    const one = speak([], '안녕! 반가', false);
    expect(one).toEqual(['안녕!']);
    expect(speak(one, '안녕! 반가워. 오늘', false)).toEqual(['안녕!', '반가워.']);
  });

  it('keeps what it said, even when the text before it changes', () => {
    const said = speak([], '이건 *기울 꼴이야. 그리고', false);
    expect(said).toEqual(['이건 *기울 꼴이야.']);
    expect(speak(said, '이건 *기울* 꼴이야. 그리고 끝. ', false)).toEqual(['이건 *기울 꼴이야.', '그리고 끝.']);
  });

  it('returns the same list when nothing new is finished (nothing to redraw)', () => {
    const said = speak([], '안녕! 반가', false);
    expect(speak(said, '안녕! 반가워', false)).toBe(said);
  });

  it('says the rest when the reply is over', () => {
    expect(speak(['안녕!'], '안녕! 반가워', true)).toEqual(['안녕!', '반가워']);
  });

  it('bubbleText: a whole reply as one plain line', () => {
    expect(bubbleText('이건 **굵게**.\n\n- 하나\n- 둘')).toBe('이건 굵게. 하나 둘');
  });
});

describe('fitting the bubble (Galmuri11 12px)', () => {
  it('estimates widths: Hangul 12px, ASCII 8px at most, space 5px', () => {
    expect(textWidth('가나')).toBe(24);
    expect(textWidth('ab')).toBe(16);
    expect(textWidth('i.')).toBe(8);
    expect(textWidth(' ')).toBe(5);
    expect(textWidth(moreLabel())).toBe(58);
  });

  it('a line is the bubble width less its padding and border', () => {
    expect(linePx(380)).toBe(356);
    expect(linePx(156)).toBe(132);
  });

  it('wraps at spaces like word-break: keep-all, and breaks a word longer than a line', () => {
    expect(lineCount('가나다 라마', 65)).toBe(1);
    expect(lineCount('가나다 라마바', 65)).toBe(2);
    expect(lineCount('가나다라마바사아', 65)).toBe(2);
  });

  it('shows a short line whole', () => {
    expect(fitBubble('안녕! 반가워요.', 132)).toEqual({ text: '안녕! 반가워요.', more: false });
  });

  it('cuts a long line to three lines with … and 더 보기', () => {
    const long = Array.from({ length: 20 }, (_, i) => `${i + 1}번째 줄이에요.`).join(' ');
    const fit = fitBubble(long, 132);
    expect(fit.more).toBe(true);
    expect(fit.text.endsWith('…')).toBe(true);
    expect(long.startsWith(fit.text.slice(0, -1))).toBe(true);
    expect(lineCount(`${fit.text} ${moreLabel()}`, 132, [moreLabel()])).toBeLessThanOrEqual(3);
    // as much as fits: one more (non-space) character would not
    let n = fit.text.length;
    while (long[n - 1] === ' ') n++;
    const longer = long.slice(0, n);
    expect(lineCount(`${longer}… ${moreLabel()}`, 132, [moreLabel()])).toBeGreaterThan(3);
  });

  it('while streaming, keeps room for 더 보기 so what it shows never shrinks', () => {
    const words = Array.from({ length: 30 }, (_, i) => `말${i}이에요.`);
    let shown = '';
    for (let n = 1; n <= words.length; n++) {
      const fit = fitBubble(words.slice(0, n).join(' '), 132);
      const visible = fit.more ? fit.text.slice(0, -1) : fit.text;
      expect(visible.startsWith(shown)).toBe(true);
      shown = visible;
    }
  });

  it('a finished line that just fits is shown whole, without 더 보기', () => {
    const text = '가나다라마바사아자차카 가나다라마바사아자차카 가나다라마바사아자';
    expect(lineCount(text, 132)).toBe(3);
    expect(fitBubble(text, 132).more).toBe(true);
    expect(fitBubble(text, 132, { final: true })).toEqual({ text, more: false });
  });

  it('never cuts an emoji in half', () => {
    const fit = fitBubble('😀'.repeat(40), 132);
    expect(fit.more).toBe(true);
    expect([...fit.text.slice(0, -1)].every((c) => c === '😀')).toBe(true);
  });
});
