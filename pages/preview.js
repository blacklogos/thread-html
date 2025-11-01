/* Minimal preview renderer and actions (MV3-safe, no inline handlers) */
(function(){
  const state = {
    renderData: null,
    blobUrls: [],
  };

  function showToast(msg){
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(()=> t.remove(), 2000);
  }

  function setAvatar(avatarUrl, initials, bgColor){
    const img = document.getElementById('avatarImg');
    const init = document.getElementById('avatarInitials');
    const container = document.getElementById('avatarContainer');
    container.style.backgroundColor = bgColor || '#999';
    init.textContent = (initials || 'U').slice(0,2).toUpperCase();
    if (avatarUrl){
      img.src = avatarUrl;
      img.onerror = function(){ img.style.display='none'; init.style.display='flex'; };
    } else {
      img.style.display='none'; init.style.display='flex';
    }
  }

  function htmlToPlain(article){
    let html = article.innerHTML || '';
    html = html.replace(/<br\s*\/?>(\s*)/gi, '\n');
    html = html.replace(/<\/(?:p|div|section|article|li|ul|ol|h[1-6])>/gi, '$&\n\n');
    html = html.replace(/<(?:p|div|section|article|li|ul|ol|h[1-6])[^>]*>/gi, '');
    const div = document.createElement('div');
    div.innerHTML = html;
    return (div.textContent || '').replace(/\r/g,'').replace(/\n{3,}/g,'\n\n').trim();
  }

  function copyText2(){
    const article = document.getElementById('article');
    if (!article) return;
    const text = htmlToPlain(article);
    function onSuccess(){ const b=document.getElementById('btnCopy'); if(b){ const t=b.textContent; b.textContent='Copied!'; setTimeout(()=>b.textContent=t,2000);} }
    function fallback(){
      try{ const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.focus(); ta.select(); const ok=document.execCommand('copy'); document.body.removeChild(ta); if(ok){ onSuccess(); return; } }catch(e){}
      try{ const sel=window.getSelection(); const range=document.createRange(); range.selectNodeContents(article); sel.removeAllRanges(); sel.addRange(range); const ok2=document.execCommand('copy'); sel.removeAllRanges(); if(ok2){ onSuccess(); return; } }catch(e2){}
      alert('Failed to copy text.');
    }
    if (navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(onSuccess).catch(fallback); } else { fallback(); }
  }

  function collectImageUrls(article){
    const urls = new Set();
    function pickFromSrcset(srcset){ try{ const parts=String(srcset).split(',').map(s=>s.trim()).filter(Boolean); if(!parts.length) return ''; return parts[parts.length-1].split(/\s+/)[0]||''; }catch{return '';} }
    Array.from(article.querySelectorAll('img')).forEach(img=>{
      let u=''; if(img.currentSrc) u=img.currentSrc; if(!u && img.getAttribute('srcset')) u=pickFromSrcset(img.getAttribute('srcset')); if(!u) u=img.getAttribute('src')||''; if(/^https?:\/\//i.test(u)) urls.add(u);
    });
    Array.from(article.querySelectorAll('picture source[srcset]')).forEach(src=>{ const u=pickFromSrcset(src.getAttribute('srcset')); if(/^https?:\/\//i.test(u)) urls.add(u); });
    (article.innerHTML.match(/\[Image:\s*(https?:\/\/[^\]\s]+)\]/gi)||[]).map(m=>m.replace(/^\[Image:\s*/i,'').replace(/\]$/,'').trim()).forEach(u=>{ if(/^https?:\/\//i.test(u)) urls.add(u); });
    return Array.from(urls);
  }

  function downloadImages(){
    const article = document.getElementById('article'); if(!article){ showToast('No content'); return; }
    const urls = collectImageUrls(article); if(!urls.length){ showToast('No images found'); return; }
    const author = (document.getElementById('authorUsername')?.textContent||'unknown').replace(/^@/, '');
    const now=new Date(); const pad=n=>String(n).padStart(2,'0'); const date = '' + now.getFullYear() + pad(now.getMonth()+1) + pad(now.getDate()); const domain=(location.hostname||'threads');
    let idx=0; (function next(){ if(idx>=urls.length){ showToast('Done'); return; } const u=urls[idx++]; const m=(u.split('?')[0].split('#')[0].match(/\.(jpg|jpeg|png|gif|webp)$/i)); const ext=(m?m[0]:'.jpg'); const fname = domain + '_' + author + '_' + date + '_' + String(idx).padStart(2,'0') + (ext.startsWith('.') ? '' : '.') + ext.replace(/^\./,'');
      try{ chrome.runtime.sendMessage({ action:'downloadImageUrl', url:u, filename: fname }, (resp)=>{ if(!resp || resp.success!==true){ try{ const a=document.createElement('a'); a.href=u; a.download=fname; a.style.display='none'; document.body.appendChild(a); a.click(); a.remove(); }catch(e){} } }); }catch(e){}
      setTimeout(next, 250); })();
  }

  function toggleEditMode(){
    const article = document.getElementById('article'); if(!article) return;
    const enabled = article.getAttribute('contenteditable') === 'true';
    if (!enabled){ article.setAttribute('contenteditable','true'); showToast('Edit Mode ON'); }
    else { article.setAttribute('contenteditable','false'); showToast('Edit Mode OFF'); }
  }

  function saveAsMarkdown(){
    const article = document.getElementById('article'); if(!article) return;
    const text = htmlToPlain(article);
    const author = document.getElementById('authorName')?.textContent || 'Unknown Author';
    const handle = document.getElementById('authorUsername')?.textContent || '';
    const info = document.getElementById('threadInfo')?.textContent || '';
    const header = '# ' + author + ' ' + handle + '\n' + '> ' + info + '\n\n';
    const md = header + text + '\n';
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob); state.blobUrls.push(url);
    try{ chrome.downloads.download({ url, filename: 'thread.md', saveAs: true }); }catch(e){ const a=document.createElement('a'); a.href=url; a.download='thread.md'; document.body.appendChild(a); a.click(); a.remove(); }
  }

  function attachImgFallbacks(root){
    function tryProxy(src, onSuccess, onFail){
      try{
        chrome.runtime.sendMessage({ action:'proxyFetchImage', url: src }, (resp)=>{
          if(resp && resp.ok && resp.buffer){
            const bytes=new Uint8Array(resp.buffer);
            const blob=new Blob([bytes], { type: resp.type||'image/jpeg' });
            const u=URL.createObjectURL(blob);
            state.blobUrls.push(u);
            onSuccess(u);
          } else { onFail && onFail(resp && resp.error); }
        });
      }catch(e){ onFail && onFail(e && e.message || String(e)); }
    }

    function makePlaceholder(src, img){
      const placeholder = document.createElement('div');
      placeholder.className = 'img-fallback';
      placeholder.innerHTML = 'Image blocked by site policy.<div class="img-actions"></div>';
      const actions = placeholder.querySelector('.img-actions');
      const open = document.createElement('a'); open.textContent='Open original'; open.href=src; open.target='_blank'; open.rel='noopener noreferrer'; actions.appendChild(open);
      const btn = document.createElement('button'); btn.textContent='Load via Proxy'; btn.className='action-button'; btn.addEventListener('click', ()=>{
        tryProxy(src, (u)=>{ img.src=u; img.style.display=''; placeholder.replaceWith(img); }, ()=>showToast('Proxy failed'));
      }); actions.appendChild(btn);
      return placeholder;
    }

    root.querySelectorAll('img').forEach(img=>{
      // Set helpful attributes
      try{ img.loading = 'lazy'; img.decoding = 'async'; img.referrerPolicy = 'no-referrer'; }catch(e){}

      const handleError = ()=>{
        const src = img.getAttribute('src')||'';
        // Auto attempt proxy first
        tryProxy(src, (u)=>{ img.src=u; }, (err)=>{
          const ph = makePlaceholder(src, img);
          img.replaceWith(ph);
        });
      };

      img.addEventListener('error', handleError, { once: true });

      // If already complete but failed, handle immediately
      if (img.complete && (img.naturalWidth === 0 || img.naturalHeight === 0)) {
        handleError();
      } else {
        // Also re-check shortly in case error fired before listener attached
        setTimeout(()=>{
          if (img.complete && (img.naturalWidth === 0 || img.naturalHeight === 0)) {
            handleError();
          }
        }, 250);
      }
    });
  }

  function render(data){
    state.renderData = data;
    document.getElementById('authorName').textContent = data.authorName || 'Unknown Author';
    document.getElementById('authorUsername').textContent = data.authorUsername || '';
    document.getElementById('threadInfo').textContent = (data.totalWords||0) + ' words · ' + (data.readTimeMinutes||1) + ' min read' + (data.originalDate ? ' · ' + data.originalDate : '');
    setAvatar(data.avatarUrl||'', data.authorInitials||'U', data.avatarColor||'#999');
    const article = document.getElementById('article');
    article.innerHTML = data.threadContentHtml || '';
    attachImgFallbacks(article);
  }

  function bindUI(){
    document.getElementById('btnCopy').addEventListener('click', copyText2);
    document.getElementById('btnPdf').addEventListener('click', ()=> window.print());
    document.getElementById('btnImages').addEventListener('click', downloadImages);
    document.getElementById('btnEdit').addEventListener('click', toggleEditMode);
    document.getElementById('btnMd').addEventListener('click', saveAsMarkdown);
  }

  window.addEventListener('beforeunload', ()=>{ state.blobUrls.forEach(u=>{ try{ URL.revokeObjectURL(u); }catch(e){} }); state.blobUrls = []; });

  document.addEventListener('DOMContentLoaded', ()=>{
    bindUI();
    try {
      chrome.runtime.onMessage.addListener((msg)=>{
        if (msg && msg.type === 'preview:init') { render(msg.payload || {}); }
      });
      // Request init in case background wants us to pull
      chrome.runtime.sendMessage({ action: 'previewReady' });
    } catch (e) {
      // Not in extension context
    }
  });
})();
