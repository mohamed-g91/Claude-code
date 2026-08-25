const AC = window.ACCENTS, C = window.CTX;
wk.textContent = C.n;  hd.textContent = C.handle;  hu.textContent = C.url_txt;
au.textContent = C.author;  rg.textContent = C.range;
list.innerHTML = PEARLS.map((p,i)=>`<div class="card">
  <div class="accent" style="background:${AC[i]}"></div>
  <div class="ico" style="color:${AC[i]}">${ICON_WRAP(p.topic)}</div>
  <div><div class="topic" style="color:${AC[i]}">${p.topic}</div>
  <div class="txt"><b>${p.lead}</b> ${p.rest}</div>
  ${p.src ? `<div class="src">${p.src}</div>` : ''}</div></div>`).join('');
