/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { compilePattern, detectPrices } from '@/core/price-detector';
import type { CompiledPattern } from '@/core/price-detector';
import type { DetectedPrice } from '@/core/types';
import {
  collectSegments,
  isSegmentCurrent,
  outermostRoots,
  processInSlices,
  type TextSegment,
} from '@/content/dom-scanner';
import {
  replacePricesInSegment,
  revertReplacements,
  type RenderOptions,
  type RenderPrice,
} from '@/content/price-renderer';

/**
 * End-to-end cover for the part that touches someone else's page: what gets
 * rewritten, what is left alone, and that the change can be undone.
 */

const pattern = compilePattern(['CZK', 'USD']) as CompiledPattern;

const options: RenderOptions = { showTooltip: true, highlight: true };

/** Stand-in for the real conversion, so the tests do not depend on rates. */
const render: RenderPrice = (price: DetectedPrice) => `${price.amount / 50} g Ag`;

function convertDocument(root: HTMLElement, renderer: RenderPrice = render): void {
  for (const segment of collectSegments(root, [])) {
    const prices = detectPrices(segment.text, pattern);
    if (prices.length > 0) replacePricesInSegment(segment, prices, renderer, options);
  }
}

/**
 * Mirrors what the content script's `scan()` does with a batch of roots:
 * collect every segment first, then process them all. Collecting up front is
 * what makes a stale segment possible, so a faithful test has to do the same.
 */
function scanRoots(roots: readonly Node[]): void {
  const segments: TextSegment[] = [];
  const shadowRoots: Node[] = [];
  for (const root of outermostRoots(roots)) {
    segments.push(...collectSegments(root, shadowRoots));
  }

  vi.useFakeTimers();
  try {
    processInSlices(segments, (segment) => {
      const prices = detectPrices(segment.text, pattern);
      if (prices.length > 0) replacePricesInSegment(segment, prices, render, options);
    });
    vi.runAllTimers();
  } finally {
    vi.useRealTimers();
  }
}

/** Converts `html` and returns the resulting text content. */
function convert(html: string): string {
  document.body.innerHTML = html;
  convertDocument(document.body);
  return document.body.textContent ?? '';
}

beforeEach(() => {
  document.body.replaceChildren();
});

describe('rewriting prices in a page', () => {
  it('replaces a price and keeps the original as a tooltip', () => {
    document.body.innerHTML = '<p>Cena 1 500 Kč včetně DPH</p>';
    convertDocument(document.body);

    const replacement = document.querySelector('[data-pcx-original]');
    expect(replacement?.textContent).toBe('30 g Ag');
    expect(replacement?.getAttribute('title')).toBe('1 500 Kč');
    expect(replacement?.getAttribute('data-pcx-original')).toBe('1 500 Kč');
    expect(document.body.textContent).toBe('Cena 30 g Ag včetně DPH');
  });

  it('replaces several prices in one text node', () => {
    expect(convert('<p>Bylo 2 000 Kč, teď 1 000 Kč</p>')).toBe('Bylo 40 g Ag, teď 20 g Ag');
  });

  /**
   * Pages split prices across elements constantly — a styled currency symbol,
   * a superscript ",-", a separate <span> per part. Scanning node by node
   * misses all of it, so these are the cases that matter most in practice.
   */
  describe('prices split across elements', () => {
    it.each([
      ['<span>1 000</span><span>Kč</span>', '20 g Ag'],
      ['<span>1 000</span><span> Kč</span>', '20 g Ag'],
      ['<span>1 000</span>&nbsp;<span>Kč</span>', '20 g Ag'],
      ['<span>1 000</span><span>&nbsp;Kč</span>', '20 g Ag'],
      ['<b>1 000</b> Kč', '20 g Ag'],
      ['1 000 <b>Kč</b>', '20 g Ag'],
      ['<span>1 000<span>,-</span></span>', '20 g Ag'],
      ['<div>1 000<sup>,-</sup></div>', '20 g Ag'],
      ['<span>1 000,</span><span>-</span>', '20 g Ag'],
      ['<span>$</span><span>10</span>', '0.2 g Ag'],
      ['<span>1 </span><span>000 Kč</span>', '20 g Ag'],
      ['<span class="a">1</span><span class="b"> 000 Kč</span>', '20 g Ag'],
    ])('converts %s', (html, expected) => {
      expect(convert(html)).toBe(expected);
    });

    /**
     * The real Alza markup: a "Novinka" badge immediately before the price.
     * Concatenating the runs gives "Novinka13 990,-", and without a separator
     * the word boundary swallows the start of the amount, leaving "13 " on
     * the page next to a replacement for just "990,-".
     */
    it.each([
      ['<span>Novinka</span><span>13&nbsp;990,-</span>', 'Novinka279.8 g Ag'],
      ['<span>Akce</span><span>1 000 Kč</span>', 'Akce20 g Ag'],
      ['<span>iPhone</span><span>999 Kč</span>', 'iPhone19.98 g Ag'],
      ['<span>Sleva</span><span>9 990 Kč</span>', 'Sleva199.8 g Ag'],
    ])('separates a badge from the price in %s', (html, expected) => {
      expect(convert(html)).toBe(expected);
    });

    /**
     * The other half of the same problem: a label glued to the *end* of a
     * price. Alza's AlzaPlus box renders "195,-" immediately before
     * "Bez členství: 217,-", so the boundary after the marker fails and the
     * first price is not matched at all.
     */
    it.each([
      [
        '<span>195,-</span><span>Bez členství:&nbsp;217,-</span>',
        ['195,-', '217,-'],
      ],
      [
        '<span class="p">1 000 </span><span class="c">Kč</span><span>od výrobce</span>',
        ['1 000 Kč'],
      ],
      [
        '<span>-10&nbsp;% s AlzaPlus+</span><span>195,-</span><span>Bez členství</span>',
        ['195,-'],
      ],
    ])('matches a price with a label glued after it in %s', (html, expected) => {
      document.body.innerHTML = html;
      convertDocument(document.body);
      expect(
        Array.from(document.querySelectorAll('[data-pcx-original]')).map((e) =>
          e.getAttribute('data-pcx-original'),
        ),
      ).toEqual(expected);
    });

    /**
     * The AlzaPlus+ carousel, copied from the logged-in page. Two prices sit in
     * one run of inline text with no whitespace anywhere: the member price is
     * glued to the "…AlzaPlus+" heading before it and to "Bez členství:" after
     * it, so it fails a word boundary on both sides at once.
     *
     * The "+" needs no separator of its own — it is punctuation, so the
     * boundary before the amount already holds. This pins that down, because
     * separating it would be the obvious wrong fix.
     */
    it('converts both prices in an AlzaPlus+ box', () => {
      document.body.innerHTML =
        '<div data-slot="carousel-item">' +
        '<a href="#">AlzaEco bílý ocet 10% 5 l</a>' +
        '<span class="ads-pb ads-pb--alza-plus" data-slot="pb-wrapper"><span data-slot="pb-inner">' +
        '<span class="ads-pb__header" data-slot="pb-title">-10&nbsp;% s AlzaPlus+</span>' +
        '<span class="ads-pb__body" data-slot="pb-price-wrapper">' +
        '<span class="ads-pb__price" data-slot="pb-price">' +
        '<span class="ads-pb__price-value" data-slot="pb-price-value">146,-</span></span>' +
        '<span class="ads-pb__original-price" data-slot="pb-original-price">' +
        'Bez členství:&nbsp;162,-</span>' +
        '</span></span></span></div>';
      convertDocument(document.body);

      expect(document.querySelector('[data-slot=pb-price-value]')?.textContent).toBe('2.92 g Ag');
      expect(document.querySelector('[data-slot=pb-original-price]')?.textContent).toBe(
        'Bez členství:\u00A03.24 g Ag',
      );
      // The heading is prose, not an amount: "-10 %" must survive untouched.
      expect(document.querySelector('[data-slot=pb-title]')?.textContent).toBe(
        '-10\u00A0% s AlzaPlus+',
      );
      // Neither amount is left anywhere on the page, whole or in part.
      expect(document.body.textContent).not.toMatch(/14|62|,-/);
    });

    it('never leaks the internal separator into what the user sees', () => {
      document.body.innerHTML = '<span>1 000 </span><span>Kč</span>';
      convertDocument(document.body);
      const el = document.querySelector('[data-pcx-original]');
      expect(el?.getAttribute('data-pcx-original')).not.toContain('\u0001');
      expect(document.body.textContent).not.toContain('\u0001');
    });

    it('leaves nothing of the amount behind', () => {
      document.body.innerHTML = '<span>Novinka</span><span>13&nbsp;990,-</span>';
      convertDocument(document.body);
      // The whole amount is inside the replacement, not split around it.
      expect(document.querySelector('[data-pcx-original]')?.getAttribute('title')).toBe(
        '13\u00A0990,-',
      );
      expect(document.body.textContent).not.toMatch(/\d\s*$|^\s*\d/);
    });

    it('keeps the whole original for the tooltip', () => {
      document.body.innerHTML = '<span>1 000</span><span>&nbsp;Kč</span>';
      convertDocument(document.body);
      expect(document.querySelector('[data-pcx-original]')?.getAttribute('title')).toBe(
        '1 000 Kč',
      );
    });
  });

  describe('does not join text that is visually apart', () => {
    it.each([
      ['<p>1 000</p><p>Kč</p>', 'block boundaries'],
      ['<div>1 000</div><div>Kč</div>', 'sibling divs'],
      ['<li>1 000</li><li>Kč</li>', 'list items'],
      ['<table><tbody><tr><td>1 000</td><td>Kč</td></tr></tbody></table>', 'table cells'],
      ['<span>1 000<br>Kč</span>', 'a line break'],
    ])('leaves %s alone (%s)', (html) => {
      document.body.innerHTML = html;
      convertDocument(document.body);
      expect(document.querySelector('[data-pcx-original]')).toBeNull();
    });

    it('will not invent an amount from two numbers meeting at a boundary', () => {
      // Joining these would read as "100200 Kč", which nobody wrote.
      expect(convert('<span>100</span><span>200 Kč</span>')).toBe('100200 Kč');
    });
  });

  it('omits the tooltip when the user turned it off', () => {
    document.body.innerHTML = '<p>1 500 Kč</p>';
    for (const segment of collectSegments(document.body, [])) {
      replacePricesInSegment(segment, detectPrices(segment.text, pattern), render, {
        showTooltip: false,
        highlight: false,
      });
    }

    const replacement = document.querySelector('[data-pcx-original]');
    expect(replacement?.hasAttribute('title')).toBe(false);
    expect(replacement?.className).toBe('pcx-price');
  });

  describe('leaves alone the places a rewrite would do harm', () => {
    it.each([
      ['<input value="1 500 Kč">', 'form inputs'],
      ['<textarea>1 500 Kč</textarea>', 'textareas'],
      ['<script>var a = "1 500 Kč";</script>', 'scripts'],
      ['<style>/* 1 500 Kč */</style>', 'stylesheets'],
      ['<code>1 500 Kč</code>', 'code samples'],
      ['<pre>1 500 Kč</pre>', 'preformatted text'],
      ['<div contenteditable="true">1 500 Kč</div>', 'editable regions'],
      ['<div data-pcx-skip><span>1 500 Kč</span></div>', 'opted-out subtrees'],
    ])('skips %s (%s)', (html) => {
      document.body.innerHTML = html;
      convertDocument(document.body);
      expect(document.querySelector('[data-pcx-original]')).toBeNull();
    });

    it('does not let a skipped element bridge two runs', () => {
      // The input interrupts the run; "1 000" and "Kč" must not be joined.
      document.body.innerHTML = '<span>1 000<input value="x">Kč</span>';
      convertDocument(document.body);
      expect(document.querySelector('[data-pcx-original]')).toBeNull();
    });
  });

  it('never rewrites the same text twice', () => {
    document.body.innerHTML = '<p>1 500 Kč</p>';
    convertDocument(document.body);
    const afterFirst = document.body.innerHTML;

    convertDocument(document.body);
    expect(document.body.innerHTML).toBe(afterFirst);
  });

  it('leaves the node untouched when nothing can be converted', () => {
    document.body.innerHTML = '<p>Cena 1 500 Kč</p>';
    convertDocument(document.body, () => null);

    expect(document.querySelector('[data-pcx-original]')).toBeNull();
    expect(document.body.textContent).toBe('Cena 1 500 Kč');
  });

  /**
   * A price rendered twice in a row — "81,1 g81,1 g" — means the same text was
   * converted by two segments. Both halves of the guard against that are here:
   * not collecting the same text twice, and refusing to act on a segment whose
   * nodes have moved on since.
   */
  describe('never converts the same price twice', () => {
    /**
     * The price has to span two text nodes for this to bite, which is the
     * ordinary e-shop spelling. Inside a single node the stale offsets happen
     * to fall outside the shortened node and are dropped by accident; across
     * two they still resolve, and the second replacement goes in beside the
     * first — "73.8 g Ag73.8 g Ag".
     */
    it('ignores a queued block that sits inside another queued block', () => {
      document.body.innerHTML =
        '<div id="card"><div id="price"><span>3 690</span><span> Kč</span></div></div>';
      const card = document.getElementById('card') as HTMLElement;
      const price = document.getElementById('price') as HTMLElement;

      // What the observer hands over when a framework appends a container and
      // then fills it: two mutation records, so two roots, one inside the other.
      scanRoots([card, price]);

      expect(document.querySelectorAll('[data-pcx-original]')).toHaveLength(1);
      expect(document.body.textContent).toBe('73.8 g Ag');
    });

    it('ignores a queued block inside a full-body rescan', () => {
      document.body.innerHTML =
        '<div><p id="price"><span>Cena </span><span>1 500</span><span> Kč</span></p></div>';
      scanRoots([document.body, document.getElementById('price') as HTMLElement]);

      expect(document.querySelectorAll('[data-pcx-original]')).toHaveLength(1);
      expect(document.body.textContent).toBe('Cena 30 g Ag');
    });

    it('drops a segment whose text the page changed after it was collected', () => {
      document.body.innerHTML = '<p>1 500 Kč</p>';
      const segment = collectSegments(document.body, [])[0] as TextSegment;
      expect(isSegmentCurrent(segment)).toBe(true);

      (document.querySelector('p')?.firstChild as Text).nodeValue = '1 200 Kč';
      expect(isSegmentCurrent(segment)).toBe(false);
    });

    /**
     * The exact shape of the bug: `deleteContents()` shortens the text node
     * rather than removing it, so the second segment's nodes are all still
     * attached. Attachment alone never detected this.
     */
    it('drops a segment whose price another segment already replaced', () => {
      document.body.innerHTML = '<p>Cena 1 500 Kč dnes</p>';
      const first = collectSegments(document.body, [])[0] as TextSegment;
      const second = collectSegments(document.body, [])[0] as TextSegment;

      replacePricesInSegment(first, detectPrices(first.text, pattern), render, options);

      expect(second.nodes.every((node) => node.isConnected)).toBe(true);
      expect(isSegmentCurrent(second)).toBe(false);
    });

    it('keeps only the outermost of nested roots, in the order given', () => {
      document.body.innerHTML =
        '<div id="a"><div id="b"><p id="c">x</p></div></div><div id="d"></div>';
      const node = (id: string): Node => document.getElementById(id) as HTMLElement;

      expect(outermostRoots([node('b'), node('a'), node('c'), node('d')])).toEqual([
        node('a'),
        node('d'),
      ]);
    });
  });

  describe('reverting', () => {
    it('restores a single-node page exactly', () => {
      const original = '<p>Cena <b>1 500 Kč</b> a 20 Kč</p>';
      document.body.innerHTML = original;

      convertDocument(document.body);
      revertReplacements(document);

      expect(document.body.innerHTML).toBe(original);
    });

    it('restores the text of a price that spanned elements', () => {
      document.body.innerHTML = '<p><span>1 000</span><span>&nbsp;Kč</span></p>';
      const originalText = document.body.textContent;

      convertDocument(document.body);
      revertReplacements(document);

      expect(document.body.textContent).toBe(originalText);
      expect(document.querySelectorAll('[data-pcx-original]')).toHaveLength(0);
    });
  });

  it('descends into open shadow roots', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    host.attachShadow({ mode: 'open' }).innerHTML = '<span>1 500 Kč</span>';

    const shadowRoots: Node[] = [];
    collectSegments(document.body, shadowRoots);
    expect(shadowRoots).toHaveLength(1);
  });
});
