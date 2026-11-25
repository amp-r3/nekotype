/* @ds-bundle: {"format":4,"namespace":"Nekotype","components":[{"name":"Notice"},{"name":"Kbd"},{"name":"Dialog"},{"name":"Button"},{"name":"Segmented"},{"name":"Switch"},{"name":"Input"},{"name":"Tooltip"},{"name":"Stat"},{"name":"ResultChart"},{"name":"ActivityMap"},{"name":"KanaChart"},{"name":"OptionCard"},{"name":"Nav"},{"name":"Footer"},{"name":"Cat"},{"name":"EmptyState"}]} */
(function () {
  'use strict';
  var React = window.React;
  var h = React.createElement;
  var useState = React.useState, useRef = React.useRef, useLayoutEffect = React.useLayoutEffect, useEffect = React.useEffect,
    useId = React.useId, useImperativeHandle = React.useImperativeHandle, forwardRef = React.forwardRef;
  var CAT = {"cats":{"geometry":{"neutral":[["path",{"d":"M26 84.5L26 72A22 22 0 0 1 69.79 68.95A4 4 0 0 0 72.92 72.31A14 14 0 0 1 83.96 84.92A1 1 0 0 1 82.96 86L78.94 86A1 1 0 0 1 77.95 85.11A8 8 0 0 0 71.85 78.22A1.5 1.5 0 0 0 70 79.68L70 84.5A1.5 1.5 0 0 1 68.5 86L27.5 86A1.5 1.5 0 0 1 26 84.5Z"},"fur"],["circle",{"cx":"48","cy":"36","r":"18"},"gap"],["path",{"d":"M32.33 28.47L29.66 14.47A1.6 1.6 0 0 1 32.04 12.79L42.82 19.13A2.2 2.2 0 0 0 44.4 19.38A17 17 0 0 1 51.6 19.38A2.2 2.2 0 0 0 53.18 19.13L63.96 12.79A1.6 1.6 0 0 1 66.34 14.47L63.67 28.47A2.2 2.2 0 0 0 63.79 29.7A17 17 0 1 1 32.21 29.7A2.2 2.2 0 0 0 32.33 28.47Z"},"fur"],["circle",{"cx":"41","cy":"37","r":"3.4"},"eye"],["rect",{"x":"40.3","y":"34.7","width":"1.4","height":"4.6","rx":"0.7"},"cut"],["circle",{"cx":"55","cy":"37","r":"3.4"},"eye"],["rect",{"x":"54.3","y":"34.7","width":"1.4","height":"4.6","rx":"0.7"},"cut"]],"sleep":[["path",{"d":"M14 84A34 30 0 0 1 82 84Z"},"fur"],["circle",{"cx":"38","cy":"56","r":"15"},"gap"],["path",{"d":"M25.16 49.64L23.02 38.42A1.31 1.31 0 0 1 24.97 37.05L33.62 42.14A1.8 1.8 0 0 0 34.93 42.34A14 14 0 0 1 41.07 42.34A1.8 1.8 0 0 0 42.38 42.14L51.03 37.05A1.31 1.31 0 0 1 52.98 38.42L50.84 49.64A1.8 1.8 0 0 0 50.94 50.66A14 14 0 1 1 25.06 50.66A1.8 1.8 0 0 0 25.16 49.64Z"},"fur"],["path",{"d":"M29.8 57Q32.5 60 35.2 57"},"cutline"],["path",{"d":"M40.8 57Q43.5 60 46.2 57"},"cutline"]],"content":[["path",{"d":"M26 84.5L26 72A22 22 0 0 1 69.79 68.95A4 4 0 0 0 72.92 72.31A14 14 0 0 1 83.96 84.92A1 1 0 0 1 82.96 86L78.94 86A1 1 0 0 1 77.95 85.11A8 8 0 0 0 71.85 78.22A1.5 1.5 0 0 0 70 79.68L70 84.5A1.5 1.5 0 0 1 68.5 86L27.5 86A1.5 1.5 0 0 1 26 84.5Z"},"fur"],["circle",{"cx":"48","cy":"36","r":"18"},"gap"],["path",{"d":"M32.33 28.47L29.66 14.47A1.6 1.6 0 0 1 32.04 12.79L42.82 19.13A2.2 2.2 0 0 0 44.4 19.38A17 17 0 0 1 51.6 19.38A2.2 2.2 0 0 0 53.18 19.13L63.96 12.79A1.6 1.6 0 0 1 66.34 14.47L63.67 28.47A2.2 2.2 0 0 0 63.79 29.7A17 17 0 1 1 32.21 29.7A2.2 2.2 0 0 0 32.33 28.47Z"},"fur"],["path",{"d":"M38 38.4Q41 34.2 44 38.4"},"eyeline"],["path",{"d":"M52 38.4Q55 34.2 58 38.4"},"eyeline"]],"grumpy":[["path",{"d":"M26 84.5L26 72A22 22 0 0 1 69.79 68.95A4 4 0 0 0 72.92 72.31A14 14 0 0 1 83.96 84.92A1 1 0 0 1 82.96 86L78.94 86A1 1 0 0 1 77.95 85.11A8 8 0 0 0 71.85 78.22A1.5 1.5 0 0 0 70 79.68L70 84.5A1.5 1.5 0 0 1 68.5 86L27.5 86A1.5 1.5 0 0 1 26 84.5Z"},"fur"],["circle",{"cx":"48","cy":"36","r":"18"},"gap"],["path",{"d":"M32.33 28.47L29.66 14.47A1.6 1.6 0 0 1 32.04 12.79L42.82 19.13A2.2 2.2 0 0 0 44.4 19.38A17 17 0 0 1 51.6 19.38A2.2 2.2 0 0 0 53.18 19.13L63.96 12.79A1.6 1.6 0 0 1 66.34 14.47L63.67 28.47A2.2 2.2 0 0 0 63.79 29.7A17 17 0 1 1 32.21 29.7A2.2 2.2 0 0 0 32.33 28.47Z"},"fur"],["path",{"d":"M37.6 37A3.4 3.4 0 0 0 44.4 37Z"},"eye"],["path",{"d":"M51.6 37A3.4 3.4 0 0 0 58.4 37Z"},"eye"]]}},"marks":[["path",{"d":"M32 26.75L29.66 14.47A1.6 1.6 0 0 1 32.04 12.79L41.59 18.4A2.2 2.2 0 0 0 43.28 18.63A18 18 0 0 1 52.72 18.63A2.2 2.2 0 0 0 54.41 18.4L63.96 12.79A1.6 1.6 0 0 1 66.34 14.47L64 26.75A2.2 2.2 0 0 0 64.18 28.12A18 18 0 1 1 31.82 28.12A2.2 2.2 0 0 0 32 26.75Z"},"fur"],["circle",{"cx":"41","cy":"37","r":"3.6"},"eye"],["rect",{"x":"40.25","y":"34.6","width":"1.5","height":"4.8","rx":"0.75"},"cut"],["circle",{"cx":"55","cy":"37","r":"3.6"},"eye"],["rect",{"x":"54.25","y":"34.6","width":"1.5","height":"4.8","rx":"0.75"},"cut"]],"vb":"24 6 48 48"};

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
    cutline: { fill: 'none', stroke: 'var(--cat-ground)', strokeWidth: 2, strokeLinecap: 'round' },
    eyeline: { fill: 'none', stroke: 'var(--cat-eye)', strokeWidth: 2.2, strokeLinecap: 'round' },
    gap: { fill: 'none', stroke: 'var(--cat-ground)', strokeWidth: 2.5 }
  };
  function Cat(p) {
    var mood = p.mood || 'neutral', size = p.size || 96;
    var els = p.mark ? CAT.marks : CAT.cats.geometry[mood] || CAT.cats.geometry.neutral;
    return h('svg', { className: cx('nk-cat', p.className), viewBox: p.mark ? CAT.vb : '0 0 96 96', width: size, height: size,
      role: p.label ? 'img' : undefined, 'aria-label': p.label, 'aria-hidden': p.label ? undefined : true },
      els.map(function (e, i) {
        var props = { key: i, style: ROLE[e[2]] };
        for (var k in e[1]) if (k !== 'fill') props[k] = e[1][k];
        return h(e[0], props);
      }));
  }

  /* ================= KanaTask (ADR 058) =================
   * One task of a learning session: session line, prompt, options slot (recognition), one reserved Notice
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

  var TASK_LABELS = { learning: 'learning', of: 'of', newKana: 'new kana', show: 'show the romaji',
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
      s.total > 0 && h('div', { className: 'nk-task__ticks', 'aria-hidden': true }, Array.apply(null, Array(s.total)).map(function (_, i) {
        return h('span', { key: i, className: cx('nk-task__tick', i < s.n - 1 && 'is-done', i === s.n - 1 && 'is-current', (s.misses || []).indexOf(i) >= 0 && 'is-miss') });
      })),
      h('div', { className: 'nk-task__stage' }, p.later || stage),
      kind === 'recognition' && !p.later && h('div', { className: 'nk-task__options', role: 'group', 'aria-label': p.optionsLabel }, p.children),
      h('div', { className: 'nk-task__blur ui-label', 'aria-hidden': true }, L.blur),
      h('div', { className: 'nk-task__notice' }, p.notice || h(Notice, { reserve: true })),
      h('div', { className: 'nk-task__foot ui-caption' },
        kind === 'recall' && (coarse
          ? h(Button, { variant: 'text', size: 'sm', className: 'nk-task__show', onClick: p.onShow }, L.show)
          : h('span', { className: 'nk-task__hint' }, h(Kbd, null, 'esc'), ' ', L.show)),
        h('span', { className: 'nk-task__focus', 'aria-live': 'polite' }, L.focus)));
  });

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
   * The system's only icon (ADR 055): linear, 24-unit grid, stroke 2, colour from the text. Always next to a label. */
  var ICONS = {
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
    var rest = omit(p, ['label', 'hint', 'error', 'mono', 'className', 'counter']);
    rest.id = id; rest.className = cls;
    if (p.error) rest['aria-invalid'] = true;
    if (p.error || p.hint) rest['aria-describedby'] = id + '-m';
    return rest;
  }
  function Input(p) { var id = useId(); return Field(p, h('input', fieldProps(p, id, cx('nk-input__field', p.mono ? 'mono-romaji' : 'ui-body'))), id); }

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
      p.actions && h('div', { className: 'nk-dialog__actions' }, p.note !== undefined && h('div', { className: 'nk-dialog__note' }, p.note), p.actions));
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

  /* ================= Stats ================= */
  function Stat(p) {
    return h('div', { className: cx('nk-stat', p.className) },
      h('div', { className: 'nk-stat__label ui-caption' }, p.label),
      h('div', { className: 'nk-stat__value' },
        h('span', { className: 'mono-stat' }, p.value),
        p.unit && h('span', { className: 'nk-stat__unit mono-romaji' }, p.unit)),
      p.note && h('div', { className: 'nk-stat__note ui-caption' }, p.note));
  }

  /*
   * ResultChart — the answer-time chart of /progress (lazy chunk; decisions 109, 130, 157). It only draws: the page computes
   * the series. Layers, back to front: grid · `ranges` (one bar per day or week: lo–hi with a `mid` tick) · the cursor.
   * x is time (ms or a day number), never an index. The y axis follows the data
   * (`yDomain`, `yTicks`). Every value is in the tooltip.
   * Keyboard: one Tab stop; ← → step through the bars in time order, Home / End jump, Esc clears.
   */
  function ResultChart(p) {
    var fig = useRef(null), ws = useState(0), tipId = useId();
    useLayoutEffect(function () {
      var ro = new ResizeObserver(function (e) { var w = Math.round(e[0].contentRect.width); if (w) ws[1](w); });
      ro.observe(fig.current); return function () { ro.disconnect(); };
    }, []);
    var W = ws[0], H = p.height || 200, padL = p.axisWidth != null ? p.axisWidth : 44, padB = p.xTicks === false ? 8 : 24, padT = 16, padR = 12;
    var xd = p.xDomain || [0, 1], yd = p.yDomain || [0, 1], yf = p.yFormat || String;
    var fx = function (v) { return padL + (v - xd[0]) / ((xd[1] - xd[0]) || 1) * (W - padL - padR); };
    var fy = function (v) { return padT + (1 - (v - yd[0]) / ((yd[1] - yd[0]) || 1)) * (H - padT - padB); };
    var rgs = p.ranges || [];
    /* what the cursor walks: the bars */
    var items = rgs.map(function (d) { return { x: d.x, y: d.mid, tip: d.tip }; });
    var hov = useState(null);
    var show = p.cursor != null ? p.cursor : hov[0];
    if (show != null && !items[show]) show = null;
    function move(e) {
      var r = e.currentTarget.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, best = null, bd = Infinity;
      items.forEach(function (it, i) { var dx = fx(it.x) - mx, dy = (fy(it.y) - my) / 3, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } });
      hov[1](best);
    }
    function key(e) {
      var n = items.length, c = show == null ? -1 : show, t = null; if (!n) return;
      if (e.key === 'ArrowRight') t = Math.min(n - 1, c + 1); else if (e.key === 'ArrowLeft') t = c < 0 ? n - 1 : Math.max(0, c - 1);
      else if (e.key === 'Home') t = 0; else if (e.key === 'End') t = n - 1; else if (e.key === 'Escape') { hov[1](null); return; } else return;
      e.preventDefault(); hov[1](t);
    }
    var slot = rgs.length ? (W - padL - padR) / Math.max(1, p.slots || rgs.length) : 0, bw = Math.max(2, Math.min(8, Math.round(slot * 0.5)));
    var cur = show != null ? items[show] : null, cx0 = cur ? fx(cur.x) : 0;
    return h('figure', { className: cx('nk-chart', p.className), ref: fig, style: { minHeight: H } },
      W > 0 && h('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', tabIndex: 0, 'aria-label': p.label, 'aria-describedby': cur ? tipId : undefined,
        onMouseMove: move, onMouseLeave: function () { hov[1](null); }, onKeyDown: key, onBlur: function () { hov[1](null); } },
        (p.yTicks || []).map(function (t) {
          return h('g', { key: 'y' + t }, h('line', { className: 'nk-chart__grid', x1: padL, x2: W, y1: fy(t), y2: fy(t) }),
            h('text', { className: 'nk-chart__axis mono-small', x: padL - 8, y: fy(t) + 4, textAnchor: 'end' }, yf(t)));
        }),
        (p.xTicks || []).map(function (t, i) {
          var x = fx(t.x);
          return h('text', { key: 'x' + i, className: 'nk-chart__axis mono-small', x: x, y: H - 4, textAnchor: x < padL + 24 ? 'start' : x > W - 24 ? 'end' : 'middle' }, t.label);
        }),
        rgs.map(function (d, i) {
          var x = fx(d.x), y1 = fy(d.hi), y2 = fy(d.lo);
          return h('g', { key: 'r' + i },
            y2 - y1 >= 2 && h('rect', { className: 'nk-chart__range', x: x - bw / 2, y: y1, width: bw, height: y2 - y1, rx: 2 }),
            h('rect', { className: 'nk-chart__mid', x: x - bw / 2 - 2, y: fy(d.mid) - 1, width: bw + 4, height: 2, rx: 1 }));
        }),
        cur && h('line', { className: 'nk-chart__cursor', x1: cx0, x2: cx0, y1: padT, y2: H - padB }),
        cur && h('circle', { className: 'nk-chart__ring', cx: cx0, cy: fy(cur.y), r: 7 })),
      W > 0 && cur && h('figcaption', { id: tipId, role: 'status', className: cx('nk-chart__tip ui-caption', cx0 < 150 && 'is-start', cx0 > W - 150 && 'is-end'), style: { left: cx0 + 'px', top: Math.max(0, fy(cur.y) - 12) + 'px' } },
        (cur.tip || []).map(function (t, i) { return h('span', { key: i, className: 'nk-chart__tip-line' }, t); })));
  }

  /*
   * ActivityMap — activity by day on /progress (decisions 108, 137): a calendar grid, one column per week (Monday first),
   * one cell per day, the last cell is today. It always fills the width it is given: as many weeks as fit at `minCell`
   * (at most `maxWeeks`), and the cells grow to the edge (at most `maxCell`). The layout never depends on the history. Fill = recall answers of the day on `heat-fur-1…5`; a day without answers is
   * an outlined empty cell; a day of the current streak (`run`) carries a dot in the cell's ink; today has an `eye` border. Nothing is colour alone: the numbers are in the tooltip and in every cell's `aria-label`.
   * One Tab stop; ← → move by a week, ↑ ↓ by a day, Home / End to the first and the last day.
   */
  var AM_LABELS = {
    label: 'activity by day', less: 'fewer', more: 'more answers', today: 'today', run: 'current streak',
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    tip: function (d, date) { return [date, d.answers ? d.answers + ' answers' : 'no answers']; }
  };
  function ActivityMap(p) {
    var L = Object.assign({}, AM_LABELS, p.labels), fig = useRef(null), ws = useState(0);
    useLayoutEffect(function () {
      var ro = new ResizeObserver(function (e) { var w = Math.round(e[0].contentRect.width); if (w) ws[1](w); });
      ro.observe(fig.current); return function () { ro.disconnect(); };
    }, []);
    /* 40px: the weekday column and its gap; 4px: the gap between cells (space-1) */
    var W = ws[0], room = Math.max(0, W - 40), minCell = p.minCell || 16, maxCell = p.maxCell || 28, maxWeeks = p.maxWeeks || 26;
    var weeks = W ? Math.max(4, Math.min(maxWeeks, Math.floor(room / (minCell + 4)))) : maxWeeks;
    var size = W ? Math.min(maxCell, Math.floor(room / weeks) - 4) : minCell, th = p.thresholds || [1, 10, 25, 50, 100];
    var by = {}; (p.days || []).forEach(function (d) { by[d.day] = d; });
    var iso = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    var end = new Date(p.today + 'T00:00:00'), wd = (end.getDay() + 6) % 7, n = (weeks - 1) * 7 + wd + 1;
    var cells = [];
    for (var i = 0; i < n; i++) {
      var dt = new Date(end); dt.setDate(end.getDate() - (n - 1 - i));
      var k = iso(dt), d = by[k] || { day: k, answers: 0 }, lv = 0;
      if (d.answers > 0) { for (var j = 0; j < th.length; j++) if (d.answers >= th[j]) lv = j + 1; } else if (d.active) lv = 1;
      cells.push({ d: d, date: dt, lv: lv, col: Math.floor(i / 7), row: i % 7 });
    }
    var months = [], lastCol = -9;
    cells.forEach(function (c) { if (c.date.getDate() === 1 && c.col - lastCol >= 3 && c.col < weeks - 1) { months.push({ col: c.col, m: c.date.getMonth() }); lastCol = c.col; } });
    var act = useState(null), focS = useState(null), grid = useRef(null);
    var foc = [focS[0] == null ? n - 1 : Math.min(focS[0], n - 1), focS[1]];   /* today until the user moves; the column count follows the width */
    var dateOf = function (c) { return c.date.getDate() + ' ' + L.months[c.date.getMonth()]; };
    function key(e, i) {
      var t = e.key === 'ArrowRight' ? i + 7 : e.key === 'ArrowLeft' ? i - 7 : e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : null;
      if (t == null) return; e.preventDefault(); t = Math.max(0, Math.min(n - 1, t));
      foc[1](t); var b = grid.current.children[t]; if (b) b.focus();
    }
    var a = act[0] != null ? cells[act[0]] : null;
    var sw = function (cls, key) { return h('span', { key: key, className: 'nk-am__cell nk-am__sw ' + cls, 'aria-hidden': true }); };
    return h('figure', { className: cx('nk-am', p.className), ref: fig, style: { '--nk-am-weeks': weeks, '--nk-am-cell': size + 'px', visibility: W ? null : 'hidden' } },
      h('div', { className: 'nk-am__months mono-small', 'aria-hidden': true }, months.map(function (m) { return h('span', { key: m.col, style: { gridColumn: m.col + 1 } }, L.months[m.m]); })),
      h('div', { className: 'nk-am__wd mono-small', 'aria-hidden': true }, [0, 2, 4].map(function (r) { return h('span', { key: r, style: { gridRow: r + 1 } }, L.weekdays[r]); })),
      h('div', { className: 'nk-am__grid', ref: grid, role: 'group', 'aria-label': L.label, onMouseLeave: function () { act[1](null); } },
        cells.map(function (c, i) {
          var today = i === n - 1;
          return h('button', { key: c.d.day, type: 'button', tabIndex: i === foc[0] ? 0 : -1, 'aria-label': L.tip(c.d, dateOf(c)).concat(c.d.run ? [L.run] : [], today ? [L.today] : []).join(', '),
            className: cx('nk-am__cell', 'is-l' + c.lv, c.d.run && 'is-run', today && 'is-today'),
            onMouseEnter: function () { act[1](i); }, onFocus: function () { act[1](i); foc[1](i); }, onBlur: function () { act[1](null); }, onKeyDown: function (e) { key(e, i); } });
        }),
        a && h('div', { className: cx('nk-am__tip nk-kc__tip ui-caption', a.col < 4 && 'is-start', a.col > weeks - 5 && 'is-end'), role: 'tooltip', style: { '--c': a.col, '--r': a.row } },
          L.tip(a.d, dateOf(a)).concat(a.d.run ? [L.run] : [], act[0] === n - 1 ? [L.today] : []).map(function (t, i) { return h('span', { key: i, className: 'nk-kc__tip-line' }, t); }))),
      h('div', { className: 'nk-am__legend ui-caption' },
        h('span', { className: 'nk-am__legend-item' }, L.less, [0, 1, 2, 3, 4, 5].map(function (s) { return sw('is-l' + s, s); }), L.more),
        cells.some(function (c) { return c.d.run; }) && h('span', { className: 'nk-am__legend-item' }, sw('is-l3 is-run', 'r'), L.run),
        h('span', { className: 'nk-am__legend-item' }, sw('is-l0 is-today', 'n'), L.today)));
  }

  /* ================= KanaChart ================= */
  /*
   * KanaChart — the kana table of a track on `/`.
   * Data per introduced kana: { state: 'learning'|'learned'|'mastered', due, next (ISO date), median (ms), acc (%),
   *   answers (recall answers among the last 10), mixups: [[kana, n]], recog: [correct, total] }. A kana without data is locked.
   * `due` is a mark over learned or mastered, not a state: it is ignored on learning.
   * `opensNext` — the locked kana that opens next: its tooltip adds `opens next`.
   */
  var KC_LABELS = {
    base: 'basic', voiced: 'voiced', combo: 'combinations', ext: 'extended',
    locked: 'locked', mastered: 'mastered',
    learning: 'learning', learned: 'learned', due: 'review due', opensNext: 'opens next', vowels: 'vowels',
    next: function (d) { return 'next review: ' + d; },
    stats: function (m, a) { return 'median ' + m + ' ms · accuracy ' + a + '%'; },
    answers: function (n) { return n + ' of 10 answers'; },
    date: function (iso) { var d = new Date(iso + 'T00:00:00'); return d.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]; }
  };
  /* Tooltip / aria-label lines of a kana (exception to Tooltip's one-line rule). An introduced kana without a recall
     answer yet has no third line. */
  /* Due = the mark: a learned or mastered kana whose review comes before the next session. A learning kana is never due. */
  function isDue(d) { return !!(d && d.due && (d.state === 'learned' || d.state === 'mastered')); }
  function kanaStateLines(k, d, L, romaji, opensNext) {
    if (!d) return [k, L.locked + (k === opensNext ? ' · ' + L.opensNext : '')];
    var l2 = L[d.state];
    if (d.state !== 'learning') l2 += ' · ' + (isDue(d) ? L.due : L.next(L.date(d.next)));
    var lines = [k + ' · ' + (romaji ? romaji(k) : ''), l2];
    if (d.answers) lines.push(L.stats(d.median, d.acc) + (d.answers < 10 ? ' · ' + L.answers(d.answers) : ''));
    return lines;
  }
  function KanaChart(p) {
    var script = p.script || 'hiragana', data = p.data || {};
    var L = Object.assign({}, KC_LABELS, p.labels);
    var romaji = p.romaji || function () { return ''; };
    var act = useState(null), active = act[0];
    var grid = useRef(null);
    var rows = rowsFor(script), first = cellsOf(rows[0], script)[0];
    function isLocked(k) { return !data[k]; }
    function stateLines(k) { return kanaStateLines(k, data[k], L, romaji, p.opensNext); }
    function cellCls(k) {
      var d = data[k];
      if (!d) return 'is-st-locked';
      return 'is-st-' + d.state + (d.state === 'mastered' ? ' is-mastered' : '') + (isDue(d) ? ' is-due' : '');
    }
    /* Arrows: ← → along the row (then the next row), ↑ ↓ to the nearest column of the row above / below, across blocks. */
    function nav(e) {
      var el = document.activeElement;
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
    /* Activation of an introduced kana opens its details in the page's dialog (decision 147); a locked kana opens nothing. */
    function activate(k) { if (!isLocked(k) && p.onOpen) p.onOpen(k); }
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
              var lines = stateLines(k);
              return h('button', { key: ci, type: 'button', role: 'gridcell', 'data-k': k, 'data-r': rIndex, 'data-c': ci, lang: 'ja', 'aria-label': lines.join(', '),
                'aria-disabled': isLocked(k) || undefined, 'aria-haspopup': !isLocked(k) && p.onOpen ? 'dialog' : undefined,
                tabIndex: active === k || (!active && k === first) ? 0 : -1,
                className: cx('nk-kc__cell', k.length > 1 ? 'jp-cell-sm' : 'jp-cell', cellCls(k), active === k && 'is-active'),
                onFocus: function () { act[1](k); }, onMouseEnter: function () { act[1](k); }, onClick: function () { activate(k); } },
                k, active === k && h('span', { className: cx('nk-kc__tip ui-caption', ci === 0 && 'is-start', ci >= n - 1 && n > 2 && 'is-end'), role: 'tooltip', lang: p.lang },
                  lines.map(function (t, i) { return h('span', { key: i, className: 'nk-kc__tip-line' }, t); })));
            }));
          return row;
        }));
    }
    var sample = script === 'hiragana' ? 'あ' : 'ア';
    function sw(cls, label) { return [h('span', { key: cls, className: 'nk-kc__sw nk-kc__sw--state jp-body ' + cls, 'aria-hidden': true }, sample), h('span', { key: cls + 'l' }, label)]; }
    return h('div', { className: cx('nk-kc', 'nk-kc--state', p.className) },
      h('div', { className: 'nk-kc__grid', role: 'grid', 'aria-label': p.label, ref: grid, onKeyDown: nav, onMouseLeave: function () { act[1](null); } },
        GROUPS.map(block)),
      h('div', { className: 'nk-kc__legend ui-caption' }, sw('is-st-locked', L.locked), sw('is-st-learning', L.learning), sw('is-st-learned', L.learned), sw('is-st-mastered is-mastered', L.mastered),
        h('span', { key: 'sep', className: 'nk-kc__legend-sep', 'aria-hidden': true }), sw('is-st-learned is-due', L.due)));
  }

  /* ================= Lesson ================= */
  function OptionCard(p) {
    var state = p.state || 'idle';
    return h('button', { type: 'button', className: cx('nk-opt', 'is-' + state), disabled: p.disabled, onClick: p.onClick,
      'aria-label': p.ariaLabel, 'aria-pressed': state === 'correct' || state === 'wrong' ? true : undefined },
      h(Kbd, null, p.n),
      h('span', { className: cx('nk-opt__label', p.kana ? 'jp-test-sm' : 'mono-stat'), lang: p.kana ? 'ja' : undefined }, p.children));
  }

  /* ================= Nav & footer ================= */
  function Nav(p) {
    var items = p.items || [];
    return h('header', { className: cx('nk-nav', p.className) },
      h('a', { className: 'nk-nav__brand', href: p.homeHref || '#', 'aria-label': p.homeLabel || 'Nekotype' },
        h(Cat, { mark: true, size: 28 }), h('span', { className: 'nk-nav__word' }, 'nekotype')),
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
    return h('footer', { className: 'nk-foot' },
      (p.links || []).map(function (l) { return h('a', { key: l.id, href: l.href || '#', className: 'nk-link ui-caption', onClick: l.onClick }, l.label); }));
  }

  /* ================= Empty state ================= */
  function EmptyState(p) {
    return h('div', { className: cx('nk-empty', p.className) },
      h(Cat, { mood: p.mood || 'sleep', size: p.size || 112 }),
      h('div', { className: 'nk-empty__title ui-heading' }, p.title),
      p.text && h('p', { className: 'nk-empty__text ui-body' }, p.text),
      p.action);
  }

  var C = window;
  C.Nekotype = Object.assign(C.Nekotype || {}, {
    Notice: Notice, Kbd: Kbd, Dialog: Dialog,
    Button: Button, Segmented: Segmented, Switch: Switch, Input: Input, Tooltip: Tooltip,
    Stat: Stat, ResultChart: ResultChart, ActivityMap: ActivityMap, KanaChart: KanaChart,
    OptionCard: OptionCard, Nav: Nav, Footer: Footer,
    Cat: Cat, EmptyState: EmptyState, Icon: Icon, KanaTask: KanaTask, kanaStateLines: kanaStateLines, isDue: isDue, KC_LABELS: KC_LABELS,
    /* not components: */ createTaskController: createTaskController, useNarrow: useNarrow, useCoarse: useCoarse, TASK_LABELS: TASK_LABELS, KANA_ROWS: ROWS, kanaRows: rowsFor, kanaOf: kanaOf
  });
})();
