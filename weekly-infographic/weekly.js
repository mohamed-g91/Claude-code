const AC = window.ACCENTS, C = window.CTX;
wk.textContent = C.n;  hd.textContent = C.handle;  hu.textContent = C.url_txt;
au.textContent = C.author;  rg.textContent = C.range;

// Card text arrives as data and may contain < or &, so escape first and only
// then turn **spans** into bold. Emphasis is chosen per card by whoever wrote
// it - it marks the threshold, dose or drug, not a fixed-size opening chunk.
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const emph = s => esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
const body = p => p.text != null ? emph(p.text)
                                 : `<b>${esc(p.lead)}</b> ${esc(p.rest)}`;  // legacy

list.innerHTML = PEARLS.map((p,i)=>`<div class="card">
  <div class="accent" style="background:${AC[i]}"></div>
  <div class="ico" style="color:${AC[i]}">${ICON_WRAP(p.topic)}</div>
  <div><div class="topic" style="color:${AC[i]}">${esc(p.topic)}</div>
  <div class="txt">${body(p)}</div>
  ${p.src ? `<div class="src">${esc(p.src)}</div>` : ''}</div></div>`).join('');
