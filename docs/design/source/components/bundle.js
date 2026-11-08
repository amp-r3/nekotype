/* @ds-bundle: {"format":4,"namespace":"Nekotype","components":[{"name":"TestArea"},{"name":"Char"},{"name":"TranslationLine"},{"name":"Notice"},{"name":"Kbd"},{"name":"ModePanel"},{"name":"RowPicker"},{"name":"Dialog"},{"name":"Button"},{"name":"Segmented"},{"name":"Switch"},{"name":"Input"},{"name":"Textarea"},{"name":"Select"},{"name":"Tooltip"},{"name":"Stat"},{"name":"PersonalBestBadge"},{"name":"ResultChart"},{"name":"WeakKanaList"},{"name":"KanaChart"},{"name":"HistoryTable"},{"name":"Pagination"},{"name":"OptionCard"},{"name":"VerticalLabel"},{"name":"Nav"},{"name":"Footer"},{"name":"Cat"},{"name":"EmptyState"}]} */
(function () {
  'use strict';
  var React = window.React;
  var h = React.createElement;
  var useState = React.useState, useRef = React.useRef, useLayoutEffect = React.useLayoutEffect, useEffect = React.useEffect,
    useId = React.useId, useImperativeHandle = React.useImperativeHandle, forwardRef = React.forwardRef;
  var CAT = {"cats":{"line":{"neutral":[["path",{"d":"M84 58C91 70 88 86 70 86L27 86C19 80 19 62 32 53C26 47 26 36 29.5 29L31 11L43.5 20.5Q48 19.2 52.5 20.5L65 11L66.5 29C70 36 70 47 64 53C73 61 74 74 70 83"},"line"],["path",{"d":"M36.8 37.0Q41.0 31.2 45.2 37.0Q41.0 42.8 36.8 37.0Z"},"eye"],["rect",{"x":"40.30","y":"34.6","width":"1.4","height":"4.8","rx":"0.70"},"cut"],["path",{"d":"M50.8 37.0Q55.0 31.2 59.2 37.0Q55.0 42.8 50.8 37.0Z"},"eye"],["rect",{"x":"54.30","y":"34.6","width":"1.4","height":"4.8","rx":"0.70"},"cut"]],"sleep":[["path",{"d":"M36 77C28 77 22 79 24 83C25 84 27 84 30 84L76 84C88 84 90 70 82 63C76 58 66 57 58 59C59 54 58 49 55 45L56 31L46 38Q41 37 36 38L26 31L27 45C21 53 21 65 26 71"},"line"],["path",{"d":"M32.5 55.0Q35.5 58.0 38.5 55.0"},"line"],["path",{"d":"M43.5 55.0Q46.5 58.0 49.5 55.0"},"line"]],"content":[["path",{"d":"M84 58C91 70 88 86 70 86L27 86C19 80 19 62 32 53C26 47 26 36 29.5 29L31 11L43.5 20.5Q48 19.2 52.5 20.5L65 11L66.5 29C70 36 70 47 64 53C73 61 74 74 70 83"},"line"],["path",{"d":"M36.8 37.0Q41.0 35.8 45.2 37.0Q41.0 42.0 36.8 37.0Z"},"eye"],["path",{"d":"M50.8 37.0Q55.0 35.8 59.2 37.0Q55.0 42.0 50.8 37.0Z"},"eye"]]},"geometry":{"neutral":[["path",{"d":"M26 86L26 72A22 22 0 0 1 70 72L70 86Z"},"fur"],["path",{"d":"M70 86L84 86A14 14 0 0 0 70 72L70 78A8 8 0 0 1 78 86Z"},"fur"],["circle",{"cx":"48","cy":"36","r":"18"},"fur"],["circle",{"cx":"48","cy":"36","r":"18","fill":"none"},"gap"],["path",{"d":"M33 32L29 11L46 21Z"},"fur"],["path",{"d":"M63 32L67 11L50 21Z"},"fur"],["circle",{"cx":"48","cy":"36","r":"17"},"fur"],["circle",{"cx":"41","cy":"37","r":"3.4"},"eye"],["rect",{"x":"40.30","y":"34.7","width":"1.4","height":"4.6","rx":"0.70"},"cut"],["circle",{"cx":"55","cy":"37","r":"3.4"},"eye"],["rect",{"x":"54.30","y":"34.7","width":"1.4","height":"4.6","rx":"0.70"},"cut"]],"sleep":[["path",{"d":"M14 84A34 30 0 0 1 82 84Z"},"fur"],["path",{"d":"M82 84A12 12 0 0 0 70 72L70 78A6 6 0 0 1 76 84Z"},"fur"],["circle",{"cx":"38","cy":"56","r":"15"},"fur"],["circle",{"cx":"38","cy":"56","r":"15","fill":"none"},"gap"],["path",{"d":"M25 52L22 35L36 43Z"},"fur"],["path",{"d":"M51 52L54 35L40 43Z"},"fur"],["circle",{"cx":"38","cy":"56","r":"14"},"fur"],["path",{"d":"M29.8 57.0Q32.5 60.0 35.2 57.0"},"cutline"],["path",{"d":"M40.8 57.0Q43.5 60.0 46.2 57.0"},"cutline"]],"content":[["path",{"d":"M26 86L26 72A22 22 0 0 1 70 72L70 86Z"},"fur"],["path",{"d":"M70 86L84 86A14 14 0 0 0 70 72L70 78A8 8 0 0 1 78 86Z"},"fur"],["circle",{"cx":"48","cy":"36","r":"18"},"fur"],["circle",{"cx":"48","cy":"36","r":"18","fill":"none"},"gap"],["path",{"d":"M33 32L29 11L46 21Z"},"fur"],["path",{"d":"M63 32L67 11L50 21Z"},"fur"],["circle",{"cx":"48","cy":"36","r":"17"},"fur"],["path",{"d":"M37.6 37A3.4 3.4 0 0 0 44.4 37Z"},"eye"],["path",{"d":"M51.6 37A3.4 3.4 0 0 0 58.4 37Z"},"eye"]]},"silhouette":{"neutral":[["path",{"d":"M30 86C20 78 19 62 31 53C26 46 26 36 29.5 29L31 10L43.5 20.5Q48 19.2 52.5 20.5L65 10L66.5 29C70 36 70 46 65 53C70 57 72 62 73 67C78 63 82 60 84 54C86 50 90 51 90 55C90 66 84 78 74 84L72 86Z"},"fur"],["path",{"d":"M36.8 37.0Q41.0 31.2 45.2 37.0Q41.0 42.8 36.8 37.0Z"},"eye"],["rect",{"x":"40.30","y":"34.6","width":"1.4","height":"4.8","rx":"0.70"},"cut"],["path",{"d":"M50.8 37.0Q55.0 31.2 59.2 37.0Q55.0 42.8 50.8 37.0Z"},"eye"],["rect",{"x":"54.30","y":"34.6","width":"1.4","height":"4.8","rx":"0.70"},"cut"]],"sleep":[["path",{"d":"M16 84C14 70 22 64 25 61C21 55 21 50 24 45L25 30L36 37Q40.5 36 45 37L56 30L57 45C58 47 58.5 49 58.6 51C66 51 78 54 84 62C90 70 90 84 78 84Z"},"fur"],["path",{"d":"M32.0 51.0Q35.0 54.0 38.0 51.0"},"cutline"],["path",{"d":"M43.0 51.0Q46.0 54.0 49.0 51.0"},"cutline"]],"content":[["path",{"d":"M30 86C20 78 19 62 31 53C26 46 26 36 29.5 29L31 10L43.5 20.5Q48 19.2 52.5 20.5L65 10L66.5 29C70 36 70 46 65 53C70 57 72 62 73 67C78 63 82 60 84 54C86 50 90 51 90 55C90 66 84 78 74 84L72 86Z"},"fur"],["path",{"d":"M36.8 37.0Q41.0 35.8 45.2 37.0Q41.0 42.0 36.8 37.0Z"},"eye"],["path",{"d":"M50.8 37.0Q55.0 35.8 59.2 37.0Q55.0 42.0 50.8 37.0Z"},"eye"]]}},"marks":{"line":[["path",{"d":"M32 53C26 47 26 36 29.5 29L31 11L43.5 20.5Q48 19.2 52.5 20.5L65 11L66.5 29C70 36 70 47 64 53Q48 58 32 53Z"},"line"],["path",{"d":"M36.8 37.0Q41.0 31.2 45.2 37.0Q41.0 42.8 36.8 37.0Z"},"eye"],["rect",{"x":"40.30","y":"34.6","width":"1.4","height":"4.8","rx":"0.70"},"cut"],["path",{"d":"M50.8 37.0Q55.0 31.2 59.2 37.0Q55.0 42.8 50.8 37.0Z"},"eye"],["rect",{"x":"54.30","y":"34.6","width":"1.4","height":"4.8","rx":"0.70"},"cut"]],"geometry":[["path",{"d":"M33 32L29 11L46 21Z"},"fur"],["path",{"d":"M63 32L67 11L50 21Z"},"fur"],["circle",{"cx":"48","cy":"36","r":"18"},"fur"],["circle",{"cx":"41","cy":"37","r":"3.6"},"eye"],["rect",{"x":"40.25","y":"34.6","width":"1.5","height":"4.8","rx":"0.75"},"cut"],["circle",{"cx":"55","cy":"37","r":"3.6"},"eye"],["rect",{"x":"54.25","y":"34.6","width":"1.5","height":"4.8","rx":"0.75"},"cut"]],"silhouette":[["path",{"d":"M32 53C26 47 26 36 29.5 29L31 11L43.5 20.5Q48 19.2 52.5 20.5L65 11L66.5 29C70 36 70 47 64 53Q48 58 32 53Z"},"fur"],["path",{"d":"M36.8 37.0Q41.0 31.2 45.2 37.0Q41.0 42.8 36.8 37.0Z"},"eye"],["rect",{"x":"40.30","y":"34.6","width":"1.4","height":"4.8","rx":"0.70"},"cut"],["path",{"d":"M50.8 37.0Q55.0 31.2 59.2 37.0Q55.0 42.8 50.8 37.0Z"},"eye"],["rect",{"x":"54.30","y":"34.6","width":"1.4","height":"4.8","rx":"0.70"},"cut"]]},"vb":"24 6 48 48"};

  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }
  function omit(p, keys) { var o = {}; for (var k in p) if (keys.indexOf(k) < 0) o[k] = p[k]; return o; }
  function cssVar(el, name) { return getComputedStyle(el).getPropertyValue(name).trim(); }
  function ms(v) { return v.endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000; }

  /* Narrow layout = bp-narrow (640px). Re-renders only when the breakpoint flips, never per key. */
  function useMedia(q) {
    var s = useState(function () { return typeof matchMedia !== 'undefined' && matchMedia(q).matches; });
    useEffect(function () {
      var m = matchMedia(q), f = function () { s[1](m.matches); };
      m.addEventListener('change', f); return function () { m.removeEventListener('change', f); };
    }, []);
    return s[0];
  }
  /* Touch = pointer: coarse. Decides on-screen alternatives to keys (show the romaji, next). */
  function useCoarse() { return useMedia('(pointer: coarse)'); }
  function useNarrow() {
    var q = '(max-width: 639px)';
    var s = useState(function () { return typeof matchMedia !== 'undefined' && matchMedia(q).matches; });
    useEffect(function () {
      var m = matchMedia(q), f = function () { s[1](m.matches); };
      m.addEventListener('change', f); return function () { m.removeEventListener('change', f); };
    }, []);
    return s[0];
  }

  /* ================= Cat ================= */
  var ROLE = {
    fur: { fill: 'var(--cat-fur)' }, eye: { fill: 'var(--cat-eye)' }, cut: { fill: 'var(--cat-ground)' },
    line: { fill: 'none', stroke: 'var(--cat-fur)', strokeWidth: 'var(--stroke-cat)', strokeLinecap: 'round', strokeLinejoin: 'round' },
    cutline: { fill: 'none', stroke: 'var(--cat-ground)', strokeWidth: 2, strokeLinecap: 'round' },
    gap: { fill: 'none', stroke: 'var(--cat-ground)', strokeWidth: 2.5 }
  };
  function Cat(p) {
    var variant = p.variant || 'geometry', mood = p.mood || 'neutral', size = p.size || 96;
    var els = p.mark ? CAT.marks[variant] : CAT.cats[variant][mood];
    return h('svg', { className: cx('nk-cat', p.className), viewBox: p.mark ? CAT.vb : '0 0 96 96', width: size, height: size,
      role: p.label ? 'img' : undefined, 'aria-label': p.label, 'aria-hidden': p.label ? undefined : true },
      els.map(function (e, i) {
        var props = { key: i, style: ROLE[e[2]] };
        for (var k in e[1]) if (k !== 'fill') props[k] = e[1][k];
        return h(e[0], props);
      }));
  }

  /* ================= Test stream ================= */
  var SKIP = /[\s、。，．・！？!?,.「」『』（）()ー〜…\-]/;
  /* ADR 047 (as changed after the v10 review): a prompt is one unbreakable run and a line breaks between prompts;
     the 0.35em gap after a prompt is a margin, not a space character. Only a prompt wider than the line (a long
     phrase on a phone) may break inside — and only between tokens (`brk` starts a token; tokens render as .nk-tok, never broken).
     Punctuation inside a phrase is a skip token: the caret passes it without input. */
  var TAIL = /[ゃゅょぁぃぅぇぉゎャュョァィゥェォヮヵヶー、。，．・！？!?,.」』）)…〜]/;   /* stays with the kana before it */
  var HEAD = /[っッ「『（(]/;                                                        /* stays with the kana after it */
  function tokenize(words) {
    var out = [], i = 0;
    words.forEach(function (w) {
      var prompt = [], prev = null;
      Array.from(w).forEach(function (ch) {
        prompt.push({ ch: ch, i: i++, skip: SKIP.test(ch) && ch !== 'ー', brk: prev !== null && !TAIL.test(ch) && !HEAD.test(prev) });
        prev = ch;
      });
      out.push(prompt);
    });
    return out;
  }

  /*
   * createTestController(root) — framework-free. All per-key work is classList / textContent / transform writes
   * against positions cached after layout; it never reads layout on the hot path and never triggers a component render.
   */
  function createTestController(root, opts) {
    opts = opts || {};
    var inner = root.querySelector('.nk-test__inner');
    var view = root.querySelector('.nk-test__text');
    var chars = Array.prototype.slice.call(root.querySelectorAll('.nk-char'));
    var prompts = Array.prototype.slice.call(root.querySelectorAll('.nk-prompt'));
    var caret = root.querySelector('.nk-caret');
    var flash = root.querySelector('.nk-caret__reject');
    var buf = root.querySelector('.nk-test__buffer');
    var slot = function (n) { return root.querySelector('[data-slot="' + n + '"]'); };
    var counterEl = slot('counter'), kpmEl = slot('kpm'), accEl = slot('acc');
    var skip = chars.map(function (c) { return c.hasAttribute('data-skip'); });
    var st = chars.map(function () { return 'untyped'; });
    var pos = [], lineH = 0, caretH = 0, viewW = 0, chW = 0, bufLift = 0, cur = 0, shift = 0;
    var lines = opts.lines || 3;
    var reduce = matchMedia('(prefers-reduced-motion: reduce)');
    var rejectMs = ms(cssVar(root, '--dur-reject') || '120ms');

    /* After a relayout (resize, fonts) the caret snaps into place without a transition (ADR 047). */
    function measure() {
      if (!chars.length) return;
      root.classList.add('is-snap');
      /* ADR 047 change: a prompt that cannot fit a line whole may break at token boundaries; all others stay whole. */
      var lineW = inner.clientWidth;
      prompts.forEach(function (el) { el.classList.remove('is-long'); });
      prompts.filter(function (el) { return el.offsetWidth > lineW; }).forEach(function (el) { el.classList.add('is-long'); });
      pos = chars.map(function (c) { return [c.offsetLeft, c.offsetTop]; });
      lineH = chars[0].offsetHeight;
      var fs = parseFloat(getComputedStyle(inner).fontSize);
      caretH = Math.round(fs * 1.1);
      viewW = view.clientWidth;
      var bfs = parseFloat(getComputedStyle(buf).fontSize);
      chW = bfs * 0.6;                      /* JetBrains Mono advance = 0.6em */
      bufLift = Math.round(parseFloat(getComputedStyle(buf).lineHeight) / 2);
      view.style.height = (lines * lineH + bufLift) + 'px';
      place();
      requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.remove('is-snap'); }); });
    }
    function line(i) { return pos[i] ? Math.round(pos[i][1] / lineH) : 0; }
    function place() {
      var p = pos[cur] || pos[pos.length - 1];
      if (!p) return;
      var x = cur < pos.length ? p[0] : p[0] + chars[chars.length - 1].offsetWidth;
      var ln = line(Math.min(cur, pos.length - 1));
      if (lines > 1 && ln > shift + lines - 2) shift = ln - (lines - 2);   /* whole lines leave; the caret line stays second from the bottom */
      if (ln < shift) shift = ln;
      inner.style.transform = 'translateY(' + (-shift * lineH) + 'px)';
      caret.style.height = caretH + 'px';
      caret.style.transform = 'translate3d(' + (x - 1) + 'px,' + (p[1] + (lineH - caretH) / 2) + 'px,0)';
      var bw = buf.textContent.length * chW;
      var bx = Math.max(0, Math.min(x, viewW - bw));                     /* clamp at the line end */
      buf.style.transform = 'translate3d(' + bx + 'px,' + (p[1] + lineH - bufLift) + 'px,0)';
    }
    function paint(i) {
      var c = chars[i]; if (!c) return;
      c.className = 'nk-char is-' + st[i] + (skip[i] ? ' is-skip' : '');
    }
    var api = {
      /** Mark char i as 'correct' | 'miss' | 'untyped'. Colour switches instantly (no transition). */
      mark: function (i, state) { st[i] = state; paint(i); },
      /** Move the caret to char i; skip tokens before it are marked done. */
      moveTo: function (i) {
        cur = i;
        for (var k = i - 1; k >= 0 && skip[k] && st[k] !== 'done'; k--) { st[k] = 'done'; paint(k); }
        place();
      },
      /** Advance past skip tokens from i; returns the next typeable index. */
      nextTypeable: function (i) { while (i < chars.length && skip[i]) i++; return i; },
      /** Pending romaji (engine.view() remainder). Never moves text. */
      setBuffer: function (s) { if (buf.textContent !== s) { buf.textContent = s; place(); } },
      /** Rejected key: 120ms miss flash on a separate opacity layer. */
      reject: function () {
        flash.getAnimations().forEach(function (a) { a.cancel(); });
        flash.animate([{ opacity: 1 }, { opacity: 0 }], { duration: rejectMs, easing: reduce.matches ? 'step-end' : cssVar(root, '--ease-in') });
      },
      setCounter: function (v) { if (counterEl) counterEl.textContent = v; },
      setLive: function (kpm, acc) { if (kpmEl) kpmEl.textContent = kpm; if (accEl) accEl.textContent = acc; },
      idle: function (on) { caret.classList.toggle('is-idle', !!on); },
      setWindowFocus: function (on) { root.classList.toggle('is-blurred', !on); },
      /** The page's hidden input lost focus while the window kept it: show `click to focus` (opacity only, space reserved). */
      setInputFocus: function (on) { root.classList.toggle('is-input-blurred', !on); },
      reset: function () { st = st.map(function () { return 'untyped'; }); chars.forEach(function (_, i) { paint(i); }); cur = 0; shift = 0; buf.textContent = ''; place(); },
      get length() { return chars.length; },
      isSkip: function (i) { return skip[i]; },
      measure: measure,
      destroy: function () { ro.disconnect(); window.removeEventListener('blur', onBlur); window.removeEventListener('focus', onFocus); }
    };
    var ro = new ResizeObserver(measure); ro.observe(view);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    /* Blur only when the window loses focus — focus on Restart or a link does not blur the text. */
    function onBlur() { api.setWindowFocus(false); }
    function onFocus() { api.setWindowFocus(true); }
    window.addEventListener('blur', onBlur); window.addEventListener('focus', onFocus);
    chars.forEach(function (_, i) { paint(i); });
    measure();
    return api;
  }

  var TestArea = forwardRef(function TestArea(p, ref) {
    var narrow = useNarrow(), touch = useCoarse();
    var coarse = p.coarse != null ? p.coarse : touch;
    var root = useRef(null), ctl = useRef(null);
    var mode = p.mode || 'words';
    /* words | phrase (ADR 058: no kana mode — jp-solo belongs to learning tasks) */
    var typeCls = narrow ? 'jp-test-sm' : 'jp-test';
    var lines = p.lines || (narrow ? 2 : 3);
    var key = (p.words || []).join('\u0001') + '|' + mode + '|' + typeCls;
    if (p.onRender) p.onRender();
    useLayoutEffect(function () {
      ctl.current = createTestController(root.current, { lines: lines });
      if (p.onReady) p.onReady(ctl.current);
      return function () { ctl.current.destroy(); };
    }, [key, lines]);
    useImperativeHandle(ref, function () { return { get current() { return ctl.current; } }; }, []);
    var prompts = tokenize(p.words || []);
    var L = Object.assign({ kpm: 'kpm', acc: '%', blur: 'return to the window to continue', repeat: 'repeat', reveal: 'show the romaji', focus: 'click to focus' }, p.labels);
    return h('div', { className: cx('nk-test', coarse && 'is-coarse', p.className), ref: root },
      h('div', { className: 'nk-test__bar' },
        h('span', { className: 'nk-test__count mono-counter' },
          h('span', { className: 'nk-test__counter', 'data-slot': 'counter' }, p.counter != null ? p.counter : ''),
          /* static per test: time `42 s`, count `7 / 25`; zen shows the number of finished prompts alone */
          p.counterSuffix && h('span', { className: 'nk-test__unit' }, p.counterSuffix)),
        p.live !== false && h('span', { className: 'nk-test__live mono-small' },
          h('span', { 'data-slot': 'kpm' }, '0'), ' ' + L.kpm + ' · ', h('span', { 'data-slot': 'acc' }, '100'), L.acc),
        /* repeat mark: static, set once per test by props — no controller method, no per-key work */
        p.repeat && h('span', { className: 'nk-test__repeat mono-small' }, L.repeat)),
      h('div', { className: 'nk-test__text', lang: 'ja' },
        h('div', { className: cx('nk-test__inner', typeCls) },
          prompts.map(function (g, gi) {
            /* chars grouped into tokens (.nk-tok, never broken); a long prompt may break only between tokens */
            var toks = [];
            g.forEach(function (c) { if (!toks.length || c.brk) toks.push([]); toks[toks.length - 1].push(c); });
            return h('span', { key: gi, className: 'nk-prompt' }, toks.map(function (t) {
              return h('span', { key: t[0].i, className: 'nk-tok' }, t.map(function (c) {
                return h('span', { key: c.i, className: 'nk-char is-untyped' + (c.skip ? ' is-skip' : ''), 'data-skip': c.skip ? '' : undefined }, c.ch);
              }));
            }));
          }),
          h('span', { className: 'nk-caret', 'aria-hidden': true }, h('span', { className: 'nk-caret__reject' })),
          h('span', { className: cx('nk-test__buffer', narrow ? 'mono-small' : 'mono-romaji'), 'aria-hidden': true }))),
      h('div', { className: 'nk-test__blur ui-label', 'aria-hidden': true }, L.blur),
      /* Bottom line: the permanent Esc hint and the reserved `click to focus` caption. */
      p.hints !== false && h('div', { className: 'nk-test__foot' },
        /* pointer: coarse — no Esc on an on-screen keyboard: a text button with the same effect (counts as an error) */
        coarse ? h(Button, { variant: 'text', size: 'sm', className: 'nk-test__show', onClick: p.onShow }, L.reveal)
          : h('span', { className: 'nk-test__hint ui-caption' }, h(Kbd, null, 'esc'), ' ', L.reveal),
        h('span', { className: 'nk-test__focus ui-caption', 'aria-live': 'polite' }, L.focus)));
  });

  /* Single char for legends and docs (the stream itself uses classList via the controller). */
  function Char(p) {
    var state = p.state || 'untyped';
    return h('span', { className: cx('nk-char', 'is-' + (state === 'current' ? 'untyped' : state), p.skip && 'is-skip') }, p.kana);
  }

  /* ================= KanaTask (ADR 058) =================
   * One task of a learning or review session: session line, prompt, options slot (recognition), one reserved Notice
   * line, key-hint line. kind: 'introduction' | 'recall' | 'recognition'.
   * Every keystroke goes through createTaskController: classList / textContent / transform writes only, positions cached
   * after layout. The component renders once per task.
   */
  function createTaskController(root) {
    var kind = root.getAttribute('data-kind');
    var stage = root.querySelector('.nk-task__stage');
    var kana = root.querySelector('.nk-task__kana');
    var caret = stage.querySelector('.nk-caret');
    var flash = caret && caret.querySelector('.nk-caret__reject');
    var buf = root.querySelector('.nk-task__buffer');
    var letters = Array.prototype.slice.call(root.querySelectorAll('.nk-task__letter'));
    var reduce = matchMedia('(prefers-reduced-motion: reduce)');
    var rejectMs = ms(cssVar(root, '--dur-reject') || '120ms');
    var xs = [], kw = 0, typed = 0, done = false;
    function measure() {
      root.classList.add('is-snap');
      if (letters.length) {
        xs = letters.map(function (l) { return l.offsetLeft; });
        var last = letters[letters.length - 1]; xs.push(last.offsetLeft + last.offsetWidth);
      }
      if (kana) kw = kana.offsetWidth;
      place();
      requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.remove('is-snap'); }); });
    }
    function place() {
      if (!caret) return;
      var x = kind === 'introduction' ? (xs[typed] || 0) : (done ? kw : 0);
      caret.style.transform = 'translate3d(' + (x - 1) + 'px,0,0)';
    }
    var api = {
      /** recall: pending romaji (engine remainder). Under the kana, from the caret; never moves the kana. */
      setBuffer: function (s) { if (buf && buf.textContent !== s) buf.textContent = s; },
      /** introduction: n letters of the ghost hint typed (fur); the caret stands before the next one. */
      type: function (n) { typed = n; letters.forEach(function (l, i) { l.classList.toggle('is-typed', i < n); }); place(); },
      /** Rejected key: 120ms miss flash of the caret on its own opacity layer. */
      reject: function () {
        if (!flash) return;
        flash.getAnimations().forEach(function (a) { a.cancel(); });
        flash.animate([{ opacity: 1 }, { opacity: 0 }], { duration: rejectMs, easing: reduce.matches ? 'step-end' : cssVar(root, '--ease-in') });
      },
      /** The answer is complete: 'correct' (kana in fur) or 'miss' (miss + miss-dim underline). Held 400ms by the session. */
      finish: function (result) {
        done = true; if (buf) buf.textContent = '';
        if (kana) { kana.classList.toggle('is-correct', result === 'correct'); kana.classList.toggle('is-miss', result === 'miss'); }
        if (kind === 'introduction') typed = letters.length;
        root.classList.add('is-done'); place();
      },
      /** Start the task over (the tab was hidden): input cleared, caret back. Errors already made stay in the engine. */
      reset: function () {
        done = false; typed = 0; if (buf) buf.textContent = '';
        if (kana) kana.classList.remove('is-correct', 'is-miss');
        letters.forEach(function (l) { l.classList.remove('is-typed'); });
        root.classList.remove('is-done'); place();
      },
      setWindowFocus: function (on) { root.classList.toggle('is-blurred', !on); },
      setInputFocus: function (on) { root.classList.toggle('is-input-blurred', !on); },
      measure: measure,
      get kind() { return kind; },
      destroy: function () { ro.disconnect(); window.removeEventListener('blur', onBlur); window.removeEventListener('focus', onFocus); }
    };
    var ro = new ResizeObserver(measure); ro.observe(stage);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    function onBlur() { api.setWindowFocus(false); }
    function onFocus() { api.setWindowFocus(true); }
    window.addEventListener('blur', onBlur); window.addEventListener('focus', onFocus);
    measure();
    return api;
  }

  var TASK_LABELS = { learning: 'learning', review: 'review', of: 'of', newKana: 'new kana', show: 'show the romaji',
    blur: 'return to the window to continue', focus: 'click to focus', leave: 'leave session', task: 'task' };
  var KanaTask = forwardRef(function KanaTask(p, ref) {
    var narrow = useNarrow(), touch = useCoarse();
    var coarse = p.coarse != null ? p.coarse : touch;
    var root = useRef(null), ctl = useRef(null);
    var kind = p.kind || 'recall', s = p.session || {};
    var L = Object.assign({}, TASK_LABELS, p.labels);
    var solo = narrow ? 'jp-solo-sm' : 'jp-solo';
    if (p.onRender) p.onRender();
    useLayoutEffect(function () {
      ctl.current = createTaskController(root.current);
      if (p.onReady) p.onReady(ctl.current);
      return function () { ctl.current.destroy(); };
    }, [kind, p.kana, p.romaji, narrow]);
    useImperativeHandle(ref, function () { return { get current() { return ctl.current; } }; }, []);
    var caretEl = h('span', { className: 'nk-caret', 'aria-hidden': true }, h('span', { className: 'nk-caret__reject' }));
    var stage = kind === 'introduction'
      ? [h('span', { key: 'l', className: 'nk-task__label ui-caption' }, L.newKana),
         h('span', { key: 'k', className: cx('nk-task__kana', solo), lang: 'ja' }, p.kana),
         h('span', { key: 'g', className: 'nk-task__ghost mono-counter', 'aria-label': p.romaji },
           Array.from(p.romaji || '').map(function (c, i) { return h('span', { key: i, className: 'nk-task__letter', 'aria-hidden': true }, c); }), caretEl)]
      : kind === 'recall'
        ? h('span', { className: cx('nk-task__line', solo) },
            h('span', { className: 'nk-task__kana', lang: 'ja' }, p.kana), caretEl,
            h('span', { className: cx('nk-task__buffer', narrow ? 'mono-small' : 'mono-romaji'), 'aria-hidden': true }))
        : h('span', { className: cx('nk-task__romaji', narrow ? 'mono-hero-sm' : 'mono-hero') }, p.romaji);
    return h('section', { className: cx('nk-task', 'nk-task--' + kind, coarse && 'is-coarse', p.className), ref: root, 'data-kind': kind, 'aria-label': p.label },
      h('div', { className: 'nk-task__bar mono-small' },
        h('span', { className: 'nk-task__progress' },
          s.kind && h('span', { className: 'nk-task__kind' }, L[s.kind], ' · '),
          h('span', { className: 'nk-task__n', 'data-slot': 'n' }, s.n), ' ' + L.of + ' ', h('span', { className: 'nk-task__n' }, s.total)),
        p.onLeave && h(Button, { variant: 'text', size: 'sm', className: 'nk-task__leave', onClick: p.onLeave }, L.leave)),
      h('div', { className: 'nk-task__stage' }, stage),
      kind === 'recognition' && h('div', { className: 'nk-task__options', role: 'group', 'aria-label': p.optionsLabel }, p.children),
      h('div', { className: 'nk-task__blur ui-label', 'aria-hidden': true }, L.blur),
      h('div', { className: 'nk-task__notice' }, p.notice || h(Notice, { reserve: true })),
      h('div', { className: 'nk-task__foot ui-caption' },
        kind === 'recall' && (coarse
          ? h(Button, { variant: 'text', size: 'sm', className: 'nk-task__show', onClick: p.onShow }, L.show)
          : h('span', { className: 'nk-task__hint' }, h(Kbd, null, 'esc'), ' ', L.show)),
        h('span', { className: 'nk-task__focus', 'aria-live': 'polite' }, L.focus)));
  });

  /* ================= Under-stream ================= */
  /* `hidden` = the show-translation setting is off (ADR 056): the line keeps its two-line height and the text stays empty.
     The phrase source (Tatoeba) is licence attribution: it shows whenever there is a `sourceHref`, translation on or off. */
  function TranslationLine(p) {
    var L = Object.assign({ source: 'source', report: 'report a problem', offline: 'available online only' }, p.labels);
    return h('div', { className: cx('nk-trans', p.hidden && 'is-off', p.className) },
      h('p', { className: 'nk-trans__text ui-body', 'aria-hidden': p.hidden || undefined }, p.hidden ? '\u00a0' : (p.text || '\u00a0')),
      (p.sourceHref || !p.hidden) && h('div', { className: 'nk-trans__actions ui-caption' },
        p.sourceHref && h('a', { className: 'nk-link', href: p.sourceHref, target: '_blank', rel: 'noopener' }, L.source),
        !p.hidden && h('button', { type: 'button', className: 'nk-link', disabled: p.offline, title: p.offline ? L.offline : undefined, onClick: p.onReport }, L.report)));
  }

  /*
   * Notice states: default (fur-dim), `tone="miss"` (blocks an action; pair with a retry `action`),
   * `loading` (static text, no animation), `reveal` (the revealed romaji: `lead` in fur-dim, romaji in eye).
   */
  function Notice(p) {
    var mono = p.mono || p.reveal;
    return h('div', { className: cx('nk-notice', mono ? 'mono-romaji' : 'ui-label', p.tone === 'miss' && 'is-miss', p.reveal && 'is-reveal', p.loading && 'is-loading', p.reserve && 'is-reserved', p.className),
      role: p.role || 'status', 'aria-live': 'polite', 'aria-busy': p.loading || undefined },
      p.lead && h('span', { className: 'nk-notice__lead' }, p.lead),
      p.reveal ? h('span', { className: 'nk-notice__romaji' }, p.children) : p.children,
      p.action && h('span', { className: 'nk-notice__action' }, p.action));
  }

  function Kbd(p) { return h('kbd', { className: cx('nk-kbd', 'mono-small', p.bare && 'is-bare', p.className) }, p.children); }

  /* ================= Icons =================
   * The system's only icons (ADR 055): linear, 24-unit grid, stroke 2, colour from the text. Always next to a label. */
  var ICONS = {
    restart: 'M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5',
    reset: 'M4 12a8 8 0 1 0 2.34-5.66M4 4v5h5'
  };
  function Icon(p) {
    return h('svg', { className: cx('nk-icon', p.className), viewBox: '0 0 24 24', 'aria-hidden': true, focusable: 'false' },
      h('path', { d: ICONS[p.name], fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
  }

  /* ================= Buttons & inputs ================= */
  function Button(p) {
    var variant = p.variant || 'secondary', size = p.size || 'md';
    var rest = omit(p, ['variant', 'size', 'hint', 'icon', 'className', 'children']);
    rest.className = cx('nk-btn', 'nk-btn--' + variant, 'nk-btn--' + size, 'ui-label', p.className);
    rest.type = p.type || 'button';
    return h('button', rest, p.icon && h(Icon, { name: p.icon, className: 'nk-btn__icon' }), p.children, p.hint && h(Kbd, { bare: true }, p.hint));
  }

  function Segmented(p) {
    var opts = p.options || [];
    var st = useState(p.defaultValue != null ? p.defaultValue : (opts[0] && opts[0].value));
    var value = p.value != null ? p.value : st[0];
    function pick(v) { if (p.value == null) st[1](v); if (p.onChange) p.onChange(v); }
    function key(e, i) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return;
      e.preventDefault(); var j = (i + d + opts.length) % opts.length; pick(opts[j].value);
      var sib = e.currentTarget.parentNode.children[j]; if (sib) sib.focus();
    }
    return h('div', { className: cx('nk-seg', p.className), role: 'radiogroup', 'aria-label': p.label },
      opts.map(function (o, i) {
        var on = o.value === value;
        return h('button', { key: String(o.value), type: 'button', role: 'radio', 'aria-checked': on, tabIndex: on ? 0 : -1, disabled: o.disabled,
          className: cx('nk-seg__item', p.mono ? 'mono-romaji' : 'ui-label', on && 'is-on'),
          onClick: function () { pick(o.value); }, onKeyDown: function (e) { key(e, i); } }, o.label);
      }));
  }

  function Toggle(p) {
    return h('button', { type: 'button', 'aria-pressed': !!p.pressed, className: cx('nk-seg__item', 'ui-label', p.pressed && 'is-on'), onClick: function () { p.onChange && p.onChange(!p.pressed); } }, p.children);
  }

  function Switch(p) {
    var st = useState(!!p.defaultChecked);
    var on = p.checked != null ? p.checked : st[0];
    var id = useId();
    function toggle() { if (p.disabled) return; if (p.checked == null) st[1](!on); if (p.onChange) p.onChange(!on); }
    return h('div', { className: cx('nk-switch', p.disabled && 'is-disabled', p.className) },
      h('label', { htmlFor: id, className: 'nk-switch__label ui-label' }, p.label,
        p.description && h('span', { className: 'nk-switch__desc ui-caption' }, p.description)),
      h('button', { id: id, type: 'button', role: 'switch', 'aria-checked': on, disabled: p.disabled, className: cx('nk-switch__track', on && 'is-on'), onClick: toggle },
        h('span', { className: 'nk-switch__knob' })));
  }

  function Field(p, control, id) {
    return h('div', { className: cx('nk-input', p.error && 'is-error', p.className) },
      p.label && h('label', { htmlFor: id, className: 'nk-input__label ui-caption' }, p.label),
      control,
      (p.error || p.hint) && h('div', { id: id + '-m', className: 'nk-input__msg ui-caption' }, p.error || p.hint));
  }
  function fieldProps(p, id, cls) {
    var rest = omit(p, ['label', 'hint', 'error', 'mono', 'className', 'options', 'counter']);
    rest.id = id; rest.className = cls;
    if (p.error) rest['aria-invalid'] = true;
    if (p.error || p.hint) rest['aria-describedby'] = id + '-m';
    return rest;
  }
  function Input(p) { var id = useId(); return Field(p, h('input', fieldProps(p, id, cx('nk-input__field', p.mono ? 'mono-romaji' : 'ui-body'))), id); }
  function Textarea(p) { var id = useId(); return Field(p, h('textarea', fieldProps(p, id, 'nk-input__field nk-input__area ui-body')), id); }
  function Select(p) {
    var id = useId();
    return Field(p, h('span', { id: id + '-w', className: 'nk-select' },
      h('select', fieldProps(p, id, 'nk-input__field nk-select__field ui-body'),
        (p.options || []).map(function (o) { return h('option', { key: o.value, value: o.value, disabled: o.disabled }, o.label); })),
      h('span', { className: 'nk-select__arrow', 'aria-hidden': true })), id);
  }

  function Tooltip(p) {
    var st = useState(false);
    var open = p.open != null ? p.open : st[0];
    var id = useId();
    var child = React.Children.only(p.children);
    var trigger = React.cloneElement(child, { 'aria-describedby': id,
      onMouseEnter: function () { st[1](true); }, onMouseLeave: function () { st[1](false); },
      onFocus: function () { st[1](true); }, onBlur: function () { st[1](false); } });
    return h('span', { className: cx('nk-tip', 'nk-tip--' + (p.side || 'top'), open && 'is-open') },
      trigger, h('span', { role: 'tooltip', id: id, className: 'nk-tip__bubble ui-caption' }, p.label));
  }

  /* ================= Dialog ================= */
  function Dialog(p) {
    var ref = useRef(null), tid = useId();
    useEffect(function () {
      var d = ref.current; if (!d) return;
      if (p.open && !d.open) {
        if (p.inline) d.show(); else d.showModal();
        /* initial focus: the first action — put the safe one (cancel) first in `actions` */
        var first = d.querySelector('.nk-dialog__actions button:not(:disabled)'); if (first) first.focus();
      }
      if (!p.open && d.open) d.close();
    }, [p.open]);
    return h('dialog', { ref: ref, className: cx('nk-dialog', p.inline && 'is-inline', p.className), 'aria-labelledby': tid,
      onCancel: function (e) { e.preventDefault(); p.onClose && p.onClose(); } },
      h('div', { className: 'nk-dialog__head' }, h('h2', { id: tid, className: 'nk-dialog__title ui-heading' }, p.title),
        p.onClose && h('button', { type: 'button', className: 'nk-dialog__close mono-romaji', 'aria-label': p.closeLabel || 'close', onClick: p.onClose }, '✕')),
      h('div', { className: 'nk-dialog__body ui-body' }, p.children),
      p.actions && h('div', { className: 'nk-dialog__actions' }, p.actions));
  }

  /* ================= Kana data =================
   * Mirrors packages/engine RowId and docs/spec/learning.md: hiragana 26 groups, katakana 31.
   * cells: hiragana in table order, null = gap (basic and dakuten rows are aligned to a·i·u·e·o).
   * Extended rows exist in katakana only (`kata`). */
  var ROWS = [
    ['base', 'vowels', '', ['あ', 'い', 'う', 'え', 'お']], ['base', 'k', 'k', ['か', 'き', 'く', 'け', 'こ']], ['base', 's', 's', ['さ', 'し', 'す', 'せ', 'そ']],
    ['base', 't', 't', ['た', 'ち', 'つ', 'て', 'と']], ['base', 'n', 'n', ['な', 'に', 'ぬ', 'ね', 'の']], ['base', 'h', 'h', ['は', 'ひ', 'ふ', 'へ', 'ほ']],
    ['base', 'm', 'm', ['ま', 'み', 'む', 'め', 'も']], ['base', 'y', 'y', ['や', null, 'ゆ', null, 'よ']], ['base', 'r', 'r', ['ら', 'り', 'る', 'れ', 'ろ']],
    ['base', 'w_n', 'w/n', ['わ', 'を', 'ん']],
    ['voiced', 'g', 'g', ['が', 'ぎ', 'ぐ', 'げ', 'ご']], ['voiced', 'z', 'z', ['ざ', 'じ', 'ず', 'ぜ', 'ぞ']], ['voiced', 'd', 'd', ['だ', 'ぢ', 'づ', 'で', 'ど']],
    ['voiced', 'b', 'b', ['ば', 'び', 'ぶ', 'べ', 'ぼ']], ['voiced', 'p', 'p', ['ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ']],
    ['combo', 'ky', 'ky', ['きゃ', 'きゅ', 'きょ']], ['combo', 'sh', 'sh', ['しゃ', 'しゅ', 'しょ']], ['combo', 'ch', 'ch', ['ちゃ', 'ちゅ', 'ちょ']],
    ['combo', 'ny', 'ny', ['にゃ', 'にゅ', 'にょ']], ['combo', 'hy', 'hy', ['ひゃ', 'ひゅ', 'ひょ']], ['combo', 'my', 'my', ['みゃ', 'みゅ', 'みょ']],
    ['combo', 'ry', 'ry', ['りゃ', 'りゅ', 'りょ']], ['combo', 'gy', 'gy', ['ぎゃ', 'ぎゅ', 'ぎょ']], ['combo', 'j', 'j', ['じゃ', 'じゅ', 'じょ']],
    ['combo', 'by', 'by', ['びゃ', 'びゅ', 'びょ']], ['combo', 'py', 'py', ['ぴゃ', 'ぴゅ', 'ぴょ']],
    ['ext', 'ext_fa', 'f', null, ['ファ', 'フィ', 'フェ', 'フォ']], ['ext', 'ext_va', 'v', null, ['ヴァ', 'ヴィ', 'ヴ', 'ヴェ', 'ヴォ']],
    ['ext', 'ext_wi', 'w', null, ['ウィ', 'ウェ', 'ウォ']], ['ext', 'ext_ti', 't/d', null, ['ティ', 'トゥ', 'ディ', 'ドゥ', 'テュ', 'デュ']],
    ['ext', 'ext_che', 'e', null, ['シェ', 'ジェ', 'チェ']]
  ].map(function (r) { return { group: r[0], id: r[1], head: r[2], hira: r[3], kata: r[4] || r[3].map(function (c) { return c && toKata(c); }) }; });
  var GROUPS = ['base', 'voiced', 'combo', 'ext'];
  function toKata(s) { return s.replace(/[ぁ-ゖ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) + 0x60); }); }
  /** Rows of a script in table order: hiragana 26, katakana 31 ('both' = katakana's 31). */
  function rowsFor(script) { return ROWS.filter(function (r) { return script === 'hiragana' ? !!r.hira : true; }); }
  function cellsOf(r, script) { return script === 'hiragana' ? r.hira : r.kata; }
  /** Every kana of a track (gaps removed): hiragana 104, katakana 125. */
  function kanaOf(script) { var out = []; rowsFor(script).forEach(function (r) { cellsOf(r, script).forEach(function (c) { if (c) out.push(c); }); }); return out; }

  /* ================= RowPicker ================= */
  function RowPicker(p) {
    var L = Object.assign({ base: 'basic', voiced: 'voiced', combo: 'combinations', ext: 'extended (katakana only)', all: 'all', none: 'none',
      count: function (n) { return n + ' rows selected'; }, empty: 'No rows selected — the test will use the base rows' }, p.labels);
    var script = p.script || 'hiragana', showScript = script === 'hiragana' ? 'hiragana' : 'katakana';
    var rows = rowsFor(script), visible = rows.map(function (r) { return r.id; });
    var sel = p.value || [];
    /* Extended ids stay stored when the script switches to hiragana, but they yield no kana there: count only rows that do. */
    var counted = sel.filter(function (id) { return visible.indexOf(id) >= 0; });
    function set(next) { p.onChange && p.onChange(next); }
    function toggle(id) { set(sel.indexOf(id) >= 0 ? sel.filter(function (x) { return x !== id; }) : sel.concat(id)); }
    return h('div', { className: 'nk-rows' },
      GROUPS.map(function (g) {
        var gr = rows.filter(function (r) { return r.group === g; }); if (!gr.length) return null;
        var ids = gr.map(function (r) { return r.id; });
        return h('fieldset', { key: g, className: 'nk-rows__group' },
          h('legend', { className: 'nk-rows__legend' },
            h('span', { className: 'ui-caption' }, L[g]),
            h('button', { type: 'button', className: 'nk-link ui-caption', onClick: function () { set(sel.filter(function (x) { return ids.indexOf(x) < 0; }).concat(ids)); } }, L.all),
            h('button', { type: 'button', className: 'nk-link ui-caption', onClick: function () { set(sel.filter(function (x) { return ids.indexOf(x) < 0; })); } }, L.none)),
          h('div', { className: 'nk-rows__grid' }, gr.map(function (r) {
            var on = sel.indexOf(r.id) >= 0;
            return h('button', { key: r.id, type: 'button', role: 'checkbox', 'aria-checked': on, className: cx('nk-check', on && 'is-on'), onClick: function () { toggle(r.id); } },
              h('span', { className: 'nk-check__box', 'aria-hidden': true }),
              h('span', { className: 'nk-check__kana jp-body', lang: 'ja' }, cellsOf(r, showScript).filter(Boolean).join(' ')),
              h('span', { className: 'nk-check__id mono-small' }, r.id));
          })));
      }),
      h('div', { className: 'nk-rows__foot' },
        counted.length ? h('span', { className: 'ui-caption nk-dim' }, L.count(counted.length)) : h(Notice, null, L.empty)));
  }

  /* ================= ModePanel ================= */
  var MODE_LABELS = {
    ru: { script: 'письмо', hiragana: 'хирагана', katakana: 'катакана', both: 'обе', content: 'материал', words: 'слова', phrases: 'фразы',
      strict: 'строгость', relaxed: 'мягкая', strictIme: 'строгая IME', type: 'тест', time: 'время', count: 'количество', zen: 'zen', amount: 'длина',
      weak: 'слабые каны', s: 'с', mode: 'режим' },
    en: { script: 'script', hiragana: 'hiragana', katakana: 'katakana', both: 'both', content: 'content', words: 'words', phrases: 'phrases',
      strict: 'strictness', relaxed: 'relaxed', strictIme: 'strict IME', type: 'test', time: 'time', count: 'count', zen: 'zen', amount: 'length',
      weak: 'weak kana', s: 's', mode: 'mode' }
  };
  /* The mode line from i18n: `words · hiragana · relaxed · 60 s`, `phrases · hiragana · relaxed · 25`, `words · hiragana · relaxed · zen`
     (+ ` · weak kana` when on). The same line sits above KPM on results and is the collapsed ModePanel on a phone. No Japanese. */
  function modeLine(value, lang, labels) {
    var T = Object.assign({}, MODE_LABELS[lang || 'en'], labels);
    var v = Object.assign({ script: 'hiragana', content: 'words', strict: 'learner', type: 'time', amount: 30, weakFocus: false }, value);
    var len = v.type === 'zen' ? T.zen : v.type === 'time' ? v.amount + ' ' + T.s : String(v.amount);
    return [T[v.content], T[v.script], v.strict === 'ime' ? T.strictIme : T.relaxed, len].concat(v.weakFocus ? [T.weak] : []).join(' · ');
  }
  /*
   * ModePanel — the config bar on /type (ADR 058: content "kana", rows and RowPicker are gone). Six groups in two rows on
   * desktop: what you type (script, content, strictness) and how the test runs (test, length, weak kana). Below 640px
   * every group is its own line with a ui-caption label. Hidden with the navigation during a test.
   */
  function ModePanel(p) {
    var T = Object.assign({}, MODE_LABELS[p.lang || 'en'], p.labels);
    var ref = useRef(null);
    useEffect(function () { var n = ref.current; if (!n) return; if (p.hidden) n.setAttribute('inert', ''); else n.removeAttribute('inert'); }, [p.hidden]);
    var v = Object.assign({ script: 'hiragana', content: 'words', strict: 'learner', type: 'time', amount: 30, weakFocus: false }, p.value);
    function set(k) { return function (x) { var n = Object.assign({}, v); n[k] = x; if (k === 'type') n.amount = x === 'time' ? 30 : 25; p.onChange && p.onChange(n); }; }
    function group(id, label, node) { return h('div', { key: id, className: 'nk-modes__group' }, label && h('span', { className: 'nk-modes__label ui-caption' }, label), node); }
    var amounts = v.type === 'time' ? [15, 30, 60, 120] : [10, 25, 50, 100];
    /* Phone (below 640px, or `compact`): collapsed to the mode line; a tap opens the full panel. */
    var narrow = useNarrow(), compact = p.compact != null ? p.compact : narrow;
    var os = useState(!!p.defaultOpen), open = p.open != null ? p.open : os[0];
    var pid = useId();
    function toggle() { if (p.open == null) os[1](!open); if (p.onToggle) p.onToggle(!open); }
    var summary = compact && h('button', { type: 'button', className: cx('nk-modes__summary ui-label', open && 'is-open'), 'aria-expanded': open, 'aria-controls': pid, onClick: toggle },
      h('span', { className: 'nk-modes__line' }, h('span', { className: 'nk-modes__sr' }, T.mode + ': '), modeLine(v, p.lang, p.labels)), h('span', { className: 'nk-modes__chev', 'aria-hidden': true }));
    if (compact && !open) return h('div', { ref: ref, className: cx('nk-modes', 'is-compact', p.hidden && 'is-hidden', p.className) }, summary);
    return h('div', { ref: ref, className: cx('nk-modes', compact && 'is-compact is-open', p.hidden && 'is-hidden', p.className) }, summary, h('div', { id: pid, className: 'nk-modes__body' },
      h('div', { className: 'nk-modes__row' },
        group('script', T.script, h(Segmented, { label: T.script, value: v.script, onChange: set('script'), options: [{ value: 'hiragana', label: T.hiragana }, { value: 'katakana', label: T.katakana }, { value: 'both', label: T.both }] })),
        group('content', T.content, h(Segmented, { label: T.content, value: v.content, onChange: set('content'), options: [{ value: 'words', label: T.words }, { value: 'phrases', label: T.phrases }] })),
        group('strict', T.strict, h(Segmented, { label: T.strict, value: v.strict, onChange: set('strict'), options: [{ value: 'learner', label: T.relaxed }, { value: 'ime', label: T.strictIme }] }))),
      h('div', { className: 'nk-modes__row' },
        group('type', T.type, h(Segmented, { label: T.type, value: v.type, onChange: set('type'), options: [{ value: 'time', label: T.time }, { value: 'count', label: T.count }, { value: 'zen', label: T.zen }] })),
        v.type !== 'zen' && group('amount', T.amount, h(Segmented, { label: T.amount, mono: true, value: v.amount, onChange: set('amount'), options: amounts.map(function (a) { return { value: a, label: String(a) }; }) })),
        group('weak', null, h('div', { className: 'nk-seg' }, h(Toggle, { pressed: v.weakFocus, onChange: set('weakFocus') }, T.weak))))));
  }

  /* ================= Results ================= */
  function Stat(p) {
    var narrow = useNarrow();
    var hero = p.size === 'hero';
    return h('div', { className: cx('nk-stat', hero && 'nk-stat--hero', p.className) },
      h('div', { className: 'nk-stat__label ui-caption' }, p.label, p.badge),
      h('div', { className: 'nk-stat__value' },
        h('span', { className: hero ? (narrow ? 'mono-hero-sm' : 'mono-hero') : 'mono-stat' }, p.value),
        p.unit && h('span', { className: 'nk-stat__unit mono-romaji' }, p.unit)),
      p.note && h('div', { className: 'nk-stat__note ui-caption' }, p.note),
      /* comparisons under the hero number: no colour judgement — the number is always fur; minus is U+2212 */
      p.comparisons && h('ul', { className: 'nk-stat__cmp ui-label' }, p.comparisons.map(function (c, i) {
        return h('li', { key: i }, h('span', { className: 'nk-stat__delta mono-romaji' }, (c.delta < 0 ? '\u2212' : '+') + Math.abs(c.delta)), ' ', c.label);
      })));
  }

  function PersonalBestBadge(p) { return h('span', { className: 'nk-badge ui-caption' }, p.children || 'personal best'); }

  /*
   * ResultChart — one line on /stats (lazy chunk). `values` may hold null: a day without answers is a gap, never
   * an invented value. `domain` [min, max] and `ticks` set the y axis (default 0 … max rounded up to 50);
   * `reference` { value, label } draws one dashed hair line (the target answer time); `xLabels` name the points;
   * `dots` marks every point (isolated points stay visible between gaps).
   */
  function ResultChart(p) {
    var fig = useRef(null), ws = useState(0);   /* measured: the chart draws at its real width, so axis text never scales */
    useLayoutEffect(function () {
      var ro = new ResizeObserver(function (e) { var w = Math.round(e[0].contentRect.width); if (w) ws[1](w); });
      ro.observe(fig.current); return function () { ro.disconnect(); };
    }, []);
    var W = ws[0], H = p.height || 160, padL = 44, padB = 20, padT = 8, padR = 4;
    var vals = p.values || [];
    var nums = vals.filter(function (v) { return v != null; });
    var n = Math.max(vals.length, 2);
    var lo = p.domain ? p.domain[0] : 0, hi = p.domain ? p.domain[1] : Math.ceil(Math.max.apply(null, nums.concat([10])) / 50) * 50;
    var ticks = p.ticks || [lo, (lo + hi) / 2, hi];
    var ix = function (i) { return padL + (i / (n - 1)) * (W - padL - padR); };
    var iy = function (v) { return padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB); };
    var hov = useState(null);
    var show = p.cursor != null ? p.cursor : hov[0];
    var xl = p.xLabels || vals.map(function (_, i) { return String(i + 1); });
    var tip = p.tip || function (i, v) { return xl[i] + ' · ' + v; };
    function move(e) {
      var r = e.currentTarget.getBoundingClientRect();
      var i = Math.round(((e.clientX - r.left) * (W / r.width) - padL) / (W - padL - padR) * (n - 1));
      hov[1](Math.max(0, Math.min(vals.length - 1, i)));
    }
    function key(e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return;
      e.preventDefault(); hov[1](Math.max(0, Math.min(vals.length - 1, (show == null ? -1 : show) + d)));
    }
    var segs = [], cur = [];
    vals.forEach(function (v, i) { if (v == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push([ix(i), iy(v)]); });
    if (cur.length) segs.push(cur);
    var xi = vals.length > 2 ? [0, Math.floor((vals.length - 1) / 2), vals.length - 1] : vals.map(function (_, i) { return i; });
    return h('figure', { className: cx('nk-chart', p.className), ref: fig, style: { minHeight: H } },
      W > 0 && h('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', tabIndex: 0, 'aria-label': p.label,
        onMouseMove: move, onMouseLeave: function () { hov[1](null); }, onKeyDown: key, onBlur: function () { hov[1](null); } },
        ticks.map(function (t) {
          return h('g', { key: t }, h('line', { className: 'nk-chart__grid', x1: padL, x2: W, y1: iy(t), y2: iy(t) }),
            h('text', { className: 'nk-chart__axis mono-small', x: padL - 8, y: iy(t) + 4, textAnchor: 'end' }, t));
        }),
        p.reference && h('g', { className: 'nk-chart__ref' },
          h('line', { x1: padL, x2: W, y1: iy(p.reference.value), y2: iy(p.reference.value) }),
          h('text', { className: 'nk-chart__axis mono-small', x: W - padR, y: iy(p.reference.value) - 6, textAnchor: 'end' }, p.reference.label)),
        xi.map(function (i) {
          return h('text', { key: 'x' + i, className: 'nk-chart__axis mono-small', x: ix(i), y: H - 4, textAnchor: i === 0 ? 'start' : i === vals.length - 1 ? 'end' : 'middle' }, xl[i]);
        }),
        segs.map(function (sg, k) {
          return sg.length > 1 ? h('polyline', { key: k, className: 'nk-chart__line', points: sg.map(function (pt) { return pt[0].toFixed(1) + ',' + pt[1].toFixed(1); }).join(' '), pathLength: 1 }) : null;
        }),
        (p.dots || segs.some(function (sg) { return sg.length === 1; })) && vals.map(function (v, i) {
          return v != null && (p.dots || segs.some(function (sg) { return sg.length === 1 && sg[0][0] === ix(i); })) && h('circle', { key: 'd' + i, className: 'nk-chart__dot', cx: ix(i), cy: iy(v), r: 2.5 });
        }),
        show != null && h('line', { className: 'nk-chart__cursor', x1: ix(show), x2: ix(show), y1: padT, y2: H - padB })),
      W > 0 && show != null && h('figcaption', { className: 'nk-chart__tip ui-caption', style: { left: (ix(show) / W * 100) + '%' } }, tip(show, vals[show])));
  }

  /* Mistyped kana on typing results: up to 5, most errors first. Spellings joined with " · " (Mono; U+00B7 is on the
     subset list). No reaction-time column (ADR 058). */
  function WeakKanaList(p) {
    var L = Object.assign({ kana: 'kana', typed: 'romaji', misses: 'errors' }, p.labels);
    return h('table', { className: 'nk-weak' },
      h('thead', null, h('tr', { className: 'ui-caption' }, h('th', null, L.kana), h('th', null, L.typed), h('th', { className: 'num' }, L.misses))),
      h('tbody', null, (p.items || []).slice(0, 5).map(function (it) {
        return h('tr', { key: it.kana },
          h('td', { className: 'jp-cell', lang: 'ja' }, it.kana),
          h('td', { className: 'mono-small nk-dim' }, it.spellings.join(' · ')),
          h('td', { className: 'num mono-romaji' }, it.misses));
      })));
  }

  /* ================= KanaChart ================= */
  function stepFor(mode, v) {
    if (v == null) return null;
    if (mode === 'miss') { var t = [0, 0.03, 0.07, 0.12, 0.2]; if (v <= 0) return 0; for (var i = 4; i >= 0; i--) if (v > t[i]) return i + 1; return 1; }
    if (mode === 'time') { var u = [0, 450, 600, 750, 950]; for (var j = 4; j >= 0; j--) if (v >= u[j]) return j + 1; return 1; }
    return v;
  }
  /*
   * KanaChart. MVP mode: `state` (ADR 058) — the learning table on `/`. `miss` and `time` (heatmaps) and `box`
   * (v9 learning map, superseded by `state`) are kept but not used in the MVP.
   * state data per kana: { state: 'learning'|'confident'|'mastered', box, due, next (ISO date), median (ms), acc (%),
   *   answers (recall answers counted, ≤ 10), mixups: [[kana, n]], recog: [correct, total] }. A kana without data is locked.
   * `due` is a mark over confident or mastered, not a state: it is ignored on learning.
   * `nextUnlock` — the locked kana that opens next: its tooltip adds `opens next`.
   */
  var KC_LABELS = {
    base: 'basic', voiced: 'voiced', combo: 'combinations', ext: 'extended',
    none: 'no data', locked: 'locked', fresh: 'not introduced', box0: 'box 0', box: 'box', mastered: 'mastered',
    learning: 'learning', confident: 'confident', due: 'review due', notIntroduced: 'not introduced yet', opensNext: 'opens next', vowels: 'vowels',
    next: function (d) { return 'next review: ' + d; },
    stats: function (m, a) { return 'median ' + m + ' ms · accuracy ' + a + '%'; },
    answers: function (n) { return n + ' of 10 answers'; },
    date: function (iso) { var d = new Date(iso + 'T00:00:00'); return d.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]; },
    mixedWith: 'mixed up with', noMixups: 'no mixups yet', noRecog: 'no recognition answers yet',
    recog: function (p, a, b) { return 'recognition accuracy ' + p + '% (' + a + ' of ' + b + ')'; }, close: 'close',
    missFmt: function (v, n) { return 'errors ' + Math.round(v * 100) + '% · attempts ' + n; }, timeFmt: function (v) { return 'reaction ' + v + ' ms'; },
    lowMiss: 'fewer errors', highMiss: 'more errors', fast: 'faster', slow: 'slower'
  };
  /* Tooltip / aria-label lines of a kana in the state mode (exception to Tooltip's one-line rule). */
  function isDue(d) { return !!(d && d.due && (d.state === 'confident' || d.state === 'mastered')); }
  function kanaStateLines(k, d, L, romaji, nextUnlock) {
    if (!d) return [k, L.locked + (k === nextUnlock ? ' · ' + L.opensNext : '')];
    var l2 = L[d.state];
    if (d.state !== 'learning') l2 += ' · ' + (isDue(d) ? L.due : L.next(L.date(d.next)));
    var l3 = !d.answers ? L.notIntroduced : L.stats(d.median, d.acc) + (d.answers < 10 ? ' · ' + L.answers(d.answers) : '');
    return [k + ' · ' + (romaji ? romaji(k) : ''), l2, l3];
  }
  /* Activation details: mixups (kana chosen instead of this one in recognition, most first) and recognition accuracy.
     Shown inline under the row of the activated cell. Not a card: no fill, no border. */
  function KanaChartDetails(p) {
    var L = Object.assign({}, KC_LABELS, p.labels), k = p.kana, d = p.data || {}, romaji = p.romaji || function () { return ''; };
    var mx = (d.mixups || []).slice().sort(function (a, b) { return b[1] - a[1]; }), rc = d.recog || [0, 0];
    return h('div', { className: 'nk-kc__detail-cell', 'aria-live': 'polite' },
      h('div', { className: 'nk-kc__detail-head' }, h('span', { className: 'jp-cell', lang: 'ja' }, k), h('span', { className: 'mono-romaji nk-dim' }, romaji(k)),
        p.onClose && h(Button, { variant: 'text', size: 'sm', className: 'nk-kc__close', onClick: p.onClose }, L.close)),
      h('div', { className: 'ui-body' }, mx.length
        ? [h('span', { key: 'l', className: 'nk-dim' }, L.mixedWith + ' '), mx.map(function (m, i) {
            return h('span', { key: m[0], className: 'nk-kc__mix' }, h('span', { className: 'jp-body', lang: 'ja' }, m[0]), h('span', { className: 'nk-dim' }, ' ×' + m[1]), i < mx.length - 1 ? ', ' : '');
          })]
        : h('span', { className: 'nk-dim' }, L.noMixups)),
      h('div', { className: 'ui-body nk-dim' }, rc[1] ? L.recog(Math.round(rc[0] / rc[1] * 100), rc[0], rc[1]) : L.noRecog));
  }
  function KanaChart(p) {
    var mode = p.mode || 'state', script = p.script || 'hiragana', data = p.data || {};
    var L = Object.assign({}, KC_LABELS, p.labels);
    var romaji = p.romaji || function () { return ''; };
    var act = useState(null), active = act[0];
    var det = useState(null), open = det[0];
    var grid = useRef(null);
    var rows = rowsFor(script), first = cellsOf(rows[0], script)[0];
    function isLocked(k) { return mode === 'state' ? !data[k] : data[k] === 'locked'; }
    function stateLines(k) { return kanaStateLines(k, data[k], L, romaji, p.nextUnlock); }
    function describe(k) {
      var d = data[k];
      if (mode === 'state') return stateLines(k);
      if (mode === 'box') { if (d === 'locked') return [L.locked]; if (d == null || d === 'new') return [L.fresh]; return [d === 0 ? L.box0 : L.box + ' ' + d + (d >= 4 ? ' · ' + L.mastered : '')]; }
      if (d == null) return [L.none];
      return [mode === 'miss' ? L.missFmt(d.v, d.n) : L.timeFmt(d.v)];
    }
    function cellCls(k) {
      var d = data[k];
      if (mode === 'state') {
        if (!d) return 'is-st-locked';
        return 'is-st-' + d.state + (d.state === 'mastered' ? ' is-mastered' : '') + (isDue(d) ? ' is-due' : '');
      }
      if (mode === 'box') {
        if (d === 'locked') return 'is-locked'; if (d == null || d === 'new') return 'is-empty';
        if (d === 0) return 'is-box0'; return 'is-fur-' + d + (d >= 4 ? ' is-mastered' : '');
      }
      if (d == null) return 'is-empty';
      var s = stepFor(mode, d.v); if (!s) return 'is-zero';
      return (mode === 'miss' ? 'is-miss-' : 'is-fur-') + s;
    }
    /* Arrows: ← → along the row (then the next row), ↑ ↓ to the nearest column of the row above / below, across blocks. Esc closes the details. */
    function nav(e) {
      var el = document.activeElement;
      if (e.key === 'Escape' && open) { e.preventDefault(); var back = grid.current.querySelector('[data-k="' + open + '"]'); det[1](null); if (back) back.focus(); return; }
      var d = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }[e.key]; if (!d) return;
      if (!el || !el.hasAttribute('data-k')) return;
      e.preventDefault();
      var all = Array.prototype.slice.call(grid.current.querySelectorAll('[data-k]'));
      var target;
      if (d[1]) target = all[all.indexOf(el) + d[1]];
      else {
        var r = +el.getAttribute('data-r') + d[0], c = +el.getAttribute('data-c');
        var line = all.filter(function (x) { return +x.getAttribute('data-r') === r; });
        line.sort(function (a, b) { return Math.abs(+a.getAttribute('data-c') - c) - Math.abs(+b.getAttribute('data-c') - c); });
        target = line[0];
      }
      if (target) target.focus();
    }
    function activate(k) {
      if (p.onSelect) p.onSelect(k);
      if (mode !== 'state' || isLocked(k)) return;
      det[1](open === k ? null : k);
    }
    function details(k) {
      return h('div', { className: 'nk-kc__detail', role: 'row', key: 'detail' },
        h('div', { role: 'gridcell', 'aria-colspan': 6 }, h(KanaChartDetails, { kana: k, data: data[k], romaji: romaji, labels: p.labels,
          onClose: function () { det[1](null); var c = grid.current.querySelector('[data-k="' + k + '"]'); if (c) c.focus(); } })));
    }
    var ri = 0;
    function block(g) {
      var gr = rows.filter(function (r) { return r.group === g; }); if (!gr.length) return null;
      return h('div', { className: cx('nk-kc__block', 'nk-kc__block--' + g), role: 'rowgroup', key: g },
        h('div', { className: 'nk-kc__caption ui-caption' }, L[g]),
        gr.map(function (r) {
          var rIndex = ri++, cells = cellsOf(r, script), n = cells.length;
          var row = h('div', { className: 'nk-kc__row', role: 'row', key: r.id },
            /* The vowel row has no consonant: the head column keeps its width so a i u e o line up, and the row is named
               `vowels` for screen readers. "a" is never used as a head — it would read as the a column. */
            h('span', { className: 'nk-kc__head mono-small', role: 'rowheader', 'aria-label': r.id === 'vowels' ? L.vowels : undefined }, r.head),
            cells.map(function (k, ci) {
              if (!k) return h('span', { key: ci, className: 'nk-kc__gap', role: 'gridcell' });
              var lines = describe(k);
              return h('button', { key: ci, type: 'button', role: 'gridcell', 'data-k': k, 'data-r': rIndex, 'data-c': ci, lang: 'ja', 'aria-label': lines.join(', '),
                'aria-disabled': isLocked(k) || undefined, 'aria-expanded': mode === 'state' && !isLocked(k) ? open === k : undefined,
                tabIndex: active === k || (!active && k === first) ? 0 : -1,
                className: cx('nk-kc__cell', k.length > 1 ? 'jp-cell-sm' : 'jp-cell', cellCls(k), active === k && 'is-active'),
                onFocus: function () { act[1](k); }, onMouseEnter: function () { act[1](k); }, onClick: function () { activate(k); } },
                k, active === k && h('span', { className: cx('nk-kc__tip ui-caption', ci === 0 && 'is-start', ci >= n - 1 && n > 2 && 'is-end'), role: 'tooltip', lang: p.lang },
                  lines.map(function (t, i) { return h('span', { key: i, className: 'nk-kc__tip-line' }, t); })));
            }));
          return open && cells.indexOf(open) >= 0 ? [row, details(open)] : row;
        }));
    }
    var steps = mode === 'miss' ? 'miss' : 'fur';
    var sample = script === 'hiragana' ? 'あ' : 'ア';
    function sw(cls, label) { return [h('span', { key: cls, className: 'nk-kc__sw nk-kc__sw--state jp-body ' + cls, 'aria-hidden': true }, sample), h('span', { key: cls + 'l' }, label)]; }
    return h('div', { className: cx('nk-kc', 'nk-kc--' + mode, p.className) },
      h('div', { className: 'nk-kc__grid', role: 'grid', 'aria-label': p.label, ref: grid, onKeyDown: nav, onMouseLeave: function () { act[1](null); } },
        GROUPS.map(block)),
      mode === 'state'
        ? h('div', { className: 'nk-kc__legend ui-caption' }, sw('is-st-locked', L.locked), sw('is-st-learning', L.learning), sw('is-st-confident', L.confident), sw('is-st-mastered is-mastered', L.mastered),
            h('span', { key: 'sep', className: 'nk-kc__legend-sep', 'aria-hidden': true }), sw('is-st-confident is-due', L.due))
        : h('div', { className: 'nk-kc__legend ui-caption' },
          mode !== 'box' && h('span', null, mode === 'miss' ? L.lowMiss : L.fast),
          [1, 2, 3, 4, 5].map(function (s) { return h('span', { key: s, className: 'nk-kc__sw mono-small is-' + steps + '-' + s + (mode === 'box' && s >= 4 ? ' is-mastered' : '') }, mode === 'box' ? s : ''); }),
          mode !== 'box' && h('span', null, mode === 'miss' ? L.highMiss : L.slow),
          mode === 'box'
            ? [h('span', { key: 'b0', className: 'nk-kc__sw mono-small is-box0' }, '0'), h('span', { key: 'n', className: 'nk-kc__sw mono-small is-empty' }), h('span', { key: 'nl' }, L.fresh), h('span', { key: 'l', className: 'nk-kc__sw jp-body is-locked' }, sample), h('span', { key: 'll' }, L.locked)]
            : [h('span', { key: 'e', className: 'nk-kc__sw mono-small is-empty' }), h('span', { key: 'el' }, L.none)]));
  }

  /* ================= History ================= */
  function HistoryTable(p) {
    var L = Object.assign({ date: 'date', mode: 'mode', kpm: 'kpm', acc: 'accuracy', time: 'time', loading: 'loading history…' }, p.labels);
    return h('div', { className: 'nk-hist' },
      h('table', { className: 'nk-hist__table' },
        h('thead', null, h('tr', { className: 'ui-caption' }, h('th', null, L.date), h('th', null, L.mode), h('th', { className: 'num' }, L.kpm), h('th', { className: 'num' }, L.acc), h('th', { className: 'num' }, L.time))),
        h('tbody', null, (p.rows || []).map(function (r, i) {
          return h('tr', { key: i },
            h('td', { className: 'mono-small nk-dim', 'data-l': L.date }, r.date),
            h('td', { className: 'ui-label', 'data-l': L.mode }, r.mode, r.best && h(PersonalBestBadge, null, p.bestLabel)),
            h('td', { className: 'num mono-romaji', 'data-l': L.kpm }, r.kpm),
            h('td', { className: 'num mono-romaji', 'data-l': L.acc }, r.acc + '%'),
            h('td', { className: 'num mono-romaji nk-dim', 'data-l': L.time }, r.time));
        }))),
      p.loading && h(Notice, null, L.loading));
  }

  function Pagination(p) {
    var L = Object.assign({ prev: '← newer', next: 'older →', label: 'history pages' }, p.labels);
    var page = p.page || 1, pages = p.pages || 1;
    var list = [];
    for (var i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - page) <= 1) list.push(i); else if (list[list.length - 1] !== '…') list.push('…');
    function go(n) { p.onPage && p.onPage(n); }
    return h('nav', { className: 'nk-pages', 'aria-label': L.label },
      h('button', { type: 'button', className: 'nk-seg__item ui-label', disabled: page <= 1, onClick: function () { go(page - 1); } }, L.prev),
      list.map(function (n, i) {
        return n === '…' ? h('span', { key: 'g' + i, className: 'nk-dim ui-label' }, '…')
          : h('button', { key: n, type: 'button', className: cx('nk-seg__item mono-romaji', n === page && 'is-on'), 'aria-current': n === page ? 'page' : undefined, onClick: function () { go(n); } }, n);
      }),
      h('button', { type: 'button', className: 'nk-seg__item ui-label', disabled: page >= pages, onClick: function () { go(page + 1); } }, L.next));
  }

  /* ================= Lesson ================= */
  function OptionCard(p) {
    var state = p.state || 'idle';
    return h('button', { type: 'button', className: cx('nk-opt', 'is-' + state), disabled: p.disabled, onClick: p.onClick,
      'aria-label': p.ariaLabel, 'aria-pressed': state === 'correct' || state === 'wrong' ? true : undefined },
      h(Kbd, null, p.n),
      h('span', { className: cx('nk-opt__label', p.kana ? 'jp-test-sm' : 'mono-stat'), lang: p.kana ? 'ja' : undefined }, p.children));
  }

  function VerticalLabel(p) { return h('span', { className: cx('nk-vlabel', 'jp-vertical', p.className), lang: 'ja', role: 'img', 'aria-label': p.ariaLabel }, p.children); }

  /* ================= Nav & footer ================= */
  function Nav(p) {
    var ref = useRef(null);
    useEffect(function () { var n = ref.current; if (!n) return; if (p.hidden) n.setAttribute('inert', ''); else n.removeAttribute('inert'); }, [p.hidden]);
    var items = p.items || [];
    return h('header', { ref: ref, className: cx('nk-nav', p.hidden && 'is-hidden', p.className) },
      h('a', { className: 'nk-nav__brand', href: p.homeHref || '#', 'aria-label': p.homeLabel || 'Nekotype' },
        h(Cat, { mark: true, variant: 'geometry', size: 28 }), h('span', { className: 'nk-nav__word' }, 'nekotype')),
      h('nav', { className: 'nk-nav__links', 'aria-label': p.label },
        items.map(function (it) {
          return h('a', { key: it.id, href: it.href || '#', className: cx('nk-nav__link', 'ui-label', it.id === p.active && 'is-active'), 'aria-current': it.id === p.active ? 'page' : undefined,
            onClick: p.onNavigate ? function (e) { e.preventDefault(); p.onNavigate(it.id); } : undefined }, it.label);
        })),
      h('div', { className: 'nk-nav__side' },
        h('div', { className: 'nk-lang', role: 'group', 'aria-label': p.langLabel || 'language' }, ['en', 'ru'].map(function (l) {
          return h('button', { key: l, type: 'button', lang: l, className: cx('nk-lang__btn mono-small', p.lang === l && 'is-on'), 'aria-pressed': p.lang === l, onClick: function () { p.onLang && p.onLang(l); } }, l);
        })),
        p.loginLabel && h('a', { href: p.loginHref || '#', className: cx('nk-nav__link ui-label', p.active === 'login' && 'is-active'),
          onClick: p.onNavigate ? function (e) { e.preventDefault(); p.onNavigate('settings'); } : undefined }, p.loginLabel)));
  }

  function Footer(p) {
    var ref = useRef(null);
    useEffect(function () { var n = ref.current; if (!n) return; if (p.hidden) n.setAttribute('inert', ''); else n.removeAttribute('inert'); }, [p.hidden]);
    return h('footer', { ref: ref, className: cx('nk-foot', p.hidden && 'is-hidden') },
      (p.links || []).map(function (l) { return h('a', { key: l.id, href: l.href || '#', className: 'nk-link ui-caption', onClick: l.onClick }, l.label); }));
  }

  /* ================= Empty state ================= */
  function EmptyState(p) {
    return h('div', { className: cx('nk-empty', p.className) },
      h(Cat, { variant: 'geometry', mood: p.mood || 'sleep', size: p.size || 112 }),
      h('div', { className: 'nk-empty__title ui-heading' }, p.title),
      p.text && h('p', { className: 'nk-empty__text ui-body' }, p.text),
      p.action);
  }

  var C = window;
  C.Nekotype = Object.assign(C.Nekotype || {}, {
    TestArea: TestArea, Char: Char, TranslationLine: TranslationLine, Notice: Notice, Kbd: Kbd, ModePanel: ModePanel, RowPicker: RowPicker, Dialog: Dialog,
    Button: Button, Segmented: Segmented, Switch: Switch, Input: Input, Textarea: Textarea, Select: Select, Tooltip: Tooltip,
    Stat: Stat, PersonalBestBadge: PersonalBestBadge, ResultChart: ResultChart, WeakKanaList: WeakKanaList, KanaChart: KanaChart,
    HistoryTable: HistoryTable, Pagination: Pagination, OptionCard: OptionCard, VerticalLabel: VerticalLabel, Nav: Nav, Footer: Footer,
    Cat: Cat, EmptyState: EmptyState, Icon: Icon, KanaTask: KanaTask, KanaChartDetails: KanaChartDetails, kanaStateLines: kanaStateLines, isDue: isDue, KC_LABELS: KC_LABELS,
    /* not components: */ createTestController: createTestController, createTaskController: createTaskController, useNarrow: useNarrow, useCoarse: useCoarse, TASK_LABELS: TASK_LABELS, MODE_LABELS: MODE_LABELS, modeLine: modeLine, KANA_ROWS: ROWS, kanaRows: rowsFor, kanaOf: kanaOf
  });
})();
