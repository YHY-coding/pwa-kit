// 画面の幅・はみ出し・文字の大きさ・押す所の大きさを、数値で返す。ページを書き換えない。
// 使い方: この式を、ブラウザを操作する道具の「ページの中でJavaScriptを動かす」機能にそのまま渡す。
// 戻り値は1つのオブジェクト(JSON)。画像を読まずに、まずこの数値で判断する。
(() => {
  // スマホの表示では、中身が幅を超えると、ブラウザが画面の幅(innerWidth)のほうを広げて全体を縮める。
  // そのため、端末の幅(screen.width)と小さいほうを「本来の幅」として比べる。
  const vw = Math.min(window.innerWidth, screen.width || window.innerWidth);
  const vh = window.innerHeight;
  const root = document.documentElement;
  const TAP_MIN = 44;   // 押す所の目安(px)
  const FONT_MIN = 12;  // これより小さい文字を数える(px)

  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const label = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    else if (typeof el.className === 'string' && el.className.trim()) s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
    return s;
  };
  const clippedByParent = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox !== 'visible') {
        const pr = p.getBoundingClientRect();
        if (pr.right <= vw + 0.5 && pr.left >= -0.5) return true; // 親の中で切られる・横に動かせる
      }
    }
    return false;
  };

  const overflow = [];
  const smallTap = [];
  let smallFont = 0;
  let minFont = Infinity;

  for (const el of document.body.querySelectorAll('*')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if ((r.right > vw + 0.5 || r.left < -0.5) && !clippedByParent(el)) {
      overflow.push({ el: label(el), left: Math.round(r.left), right: Math.round(r.right) });
    }
    if (el.matches('a[href], button, input:not([type=hidden]), select, textarea, [role=button]')) {
      if (r.width < TAP_MIN || r.height < TAP_MIN) {
        smallTap.push({ el: label(el), w: Math.round(r.width), h: Math.round(r.height) });
      }
    }
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (hasText) {
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (px < minFont) minFont = px;
      if (px < FONT_MIN) smallFont++;
    }
  }

  // 本文の文字と地の色の濃さの比(目安。重なりや半透明は見ていない)
  const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 4).map(Number);
  const lum = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const bodyCs = getComputedStyle(document.body);
  let bg = rgb(bodyCs.backgroundColor);
  if (bg.length === 4 && bg[3] === 0) bg = rgb(getComputedStyle(root).backgroundColor);
  if (bg.length < 3 || (bg.length === 4 && bg[3] === 0)) bg = [255, 255, 255];
  const fg = rgb(bodyCs.color);
  const l1 = lum(fg), l2 = lum(bg);
  const contrast = Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100;

  const scrollW = Math.max(root.scrollWidth, document.body.scrollWidth, window.innerWidth);
  return {
    viewport: { width: vw, height: vh },
    layoutWidth: window.innerWidth,                   // 本来の幅より大きければ、ブラウザが全体を縮めて見せている
    scheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    scrollWidth: scrollW,
    overflowPx: Math.max(0, scrollW - vw),          // 0 なら横にはみ出していない
    overflowCount: overflow.length,
    overflowTop: overflow.slice(0, 10),
    minFontPx: minFont === Infinity ? null : minFont,
    smallFontCount: smallFont,                        // 12px 未満の文字を持つ要素の数
    smallTapCount: smallTap.length,                   // 44px に満たない、押す所の数
    smallTapTop: smallTap.slice(0, 10),
    bodyColor: bodyCs.color,
    bodyBackground: 'rgb(' + bg.slice(0, 3).join(', ') + ')',
    bodyContrast: contrast                            // 4.5 以上が目安
  };
})()
