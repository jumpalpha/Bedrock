// Bedrock Book Studio — client. Ported from the Dopps Class Book Studio (book-studio/studio.js).
// Dopps keeps one private manuscript on a Supabase backend (sign-in, row-level security, edge functions).
// Bedrock is a static site with no backend for this, so the same workflow runs on the device:
// the whole book lives in localStorage (bedrock_bookstudio_v1). All book text is written with textContent only.
(() => {
  'use strict';

  const KEY = 'bedrock_bookstudio_v1';
  const $ = (id) => document.getElementById(id);
  const S = {
    db: null, title: 'Book Studio',
    chapters: [], current: null, paras: [],
    annotations: [], bookmarks: [], pending: [],
    tts: { idx: 0, playing: false, paused: false, token: 0 },
  };

  // ------------------------------------------------------------ helpers
  function el(tag, props, ...kids) {
    const n = document.createElement(tag);
    if (props) for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(n.dataset, v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null) n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return n;
  }
  const fmtDate = (s) => new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const now = () => new Date().toISOString();
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const wordCount = (s) => (String(s).match(/\S+/g) || []).length;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch { /* */ } },
  };
  let toastTimer;
  function toast(msg, bad) {
    let t = $('toast');
    if (!t) { t = el('div', { id: 'toast', class: 'toast', role: 'status' }); document.body.append(t); }
    t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : '');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.className = 'toast'), bad ? 6000 : 3000);
  }
  function fail(e, fallback) { console.warn(e); toast((e && e.message) || fallback || 'Something went wrong', true); }
  function gateMsg(text, ok) { const m = $('gateMsg'); m.textContent = text || ''; m.classList.toggle('ok', !!ok); }

  // ------------------------------------------------------------ theme (shared with all of Bedrock)
  function toggleTheme() {
    const light = !document.documentElement.classList.contains('light');
    document.documentElement.classList.toggle('light', light);
    store.set('bedrock_theme', light ? 'light' : 'dark');
  }

  // ------------------------------------------------------------ dialog
  function dialog(title, body, buttons = []) {
    const d = $('dlg');
    $('dlgTitle').textContent = title;
    const b = $('dlgBody'); b.textContent = ''; b.append(...[].concat(body));
    const f = $('dlgFoot'); f.textContent = '';
    for (const btn of buttons) {
      f.append(el('button', { type: 'button', class: btn.cls || '', text: btn.label, onclick: async (ev) => {
        ev.target.disabled = true;
        try { const keep = await btn.onClick?.(); if (keep !== true) d.close(); }
        catch (e) { fail(e); }
        finally { ev.target.disabled = false; }
      } }));
    }
    if (!d.open) d.showModal();
  }

  // ------------------------------------------------------------ local database
  // Same shape as the Dopps bs_* tables, kept in one JSON document.
  // Versions and snapshots ("masters") are append-only: nothing in this file edits or deletes them.
  function emptyDb(title) {
    return { v: 1, title: title || 'My Book', created_at: now(), chapters: [], versions: [], proposals: [], annotations: [],
      bookmarks: [], reading: null, masters: [], audit: [], notes: [] };
  }
  function loadDb() { try { const v = JSON.parse(store.get(KEY) || 'null'); return v && Array.isArray(v.chapters) ? v : null; } catch { return null; } }
  function saveDb() {
    if (!S.db) return;
    if (!store.set(KEY, JSON.stringify(S.db))) toast('This device is out of space for the book. Export it (⋯ → Export) so nothing is lost.', true);
  }
  function audit(action, entity, detail) {
    S.db.audit.push({ id: S.db.audit.length + 1, at: now(), action, entity, detail: detail || {} });
    if (S.db.audit.length > 1000) S.db.audit = S.db.audit.slice(-1000);
  }
  function addVersion(ch, title, body, source, note) {
    const no = S.db.versions.filter((v) => v.chapter_id === ch.id).reduce((m, v) => Math.max(m, v.version_no), 0) + 1;
    const v = { id: uid(), chapter_id: ch.id, version_no: no, title, body, source, note: note || null, created_at: now() };
    S.db.versions.push(v);
    ch.title = title; ch.body = body; ch.current_version_id = v.id; ch.updated_at = v.created_at;
    return v;
  }
  function newChapter(title, body, source) {
    const no = S.db.chapters.reduce((m, c) => Math.max(m, c.chapter_no), 0) + 1;
    const ch = { id: uid(), chapter_no: no, title: title || `Chapter ${no}`, body: body || '', current_version_id: null, updated_at: now() };
    S.db.chapters.push(ch);
    addVersion(ch, ch.title, ch.body, source || 'new', null);
    audit('chapter_created', 'chapter', { title: ch.title });
    return ch;
  }

  async function init() {
    S.db = loadDb();
    if (!S.db) { $('gate').hidden = false; $('app').hidden = true; return; }
    enterStudio();
  }
  function enterStudio(keepChapterId) {
    $('gate').hidden = true; $('app').hidden = false;
    loadAll(keepChapterId);
  }

  function loadAll(keepChapterId) {
    const db = S.db;
    S.title = db.title || 'Book Studio';
    $('bookTitle').textContent = S.title; document.title = S.title + ' · Book Studio';
    S.chapters = db.chapters.slice().sort((a, b) => a.chapter_no - b.chapter_no);
    S.bookmarks = db.bookmarks.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    S.annotations = db.annotations.slice().sort((a, b) => a.start_offset - b.start_offset);
    S.pending = db.proposals.filter((p) => p.status === 'pending');
    $('proposalsBtn').textContent = S.pending.length ? `Proposals (${S.pending.length})` : 'Proposals';
    renderBookmarks();

    if (!S.chapters.length) {
      S.current = null; S.paras = [];
      renderChapterList(); renderComments();
      const r = $('reader'); r.textContent = '';
      r.append(el('h2', { text: 'No chapters yet' }),
        el('p', { text: 'Use “+ New chapter” to start writing, or ⋯ → “Import…” to bring in a Word, Markdown or text file.' }));
      $('progressLabel').textContent = '';
      return;
    }
    const wanted = keepChapterId || db.reading?.chapter_id;
    const target = S.chapters.find((c) => c.id === wanted) || S.chapters[0];
    openChapter(target, keepChapterId ? null : db.reading?.scroll_pct);
  }

  // ------------------------------------------------------------ reader
  function splitParas(body) {
    const out = []; let last = 0;
    const push = (s, e) => { if (body.slice(s, e).trim()) out.push({ start: s, text: body.slice(s, e) }); };
    for (const m of body.matchAll(/\n[ \t]*\n\s*/g)) { push(last, m.index); last = m.index + m[0].length; }
    push(last, body.length);
    return out;
  }

  function renderChapterList() {
    const ol = $('chapterList'); ol.textContent = '';
    for (const c of S.chapters) {
      ol.append(el('li', null, el('button', {
        'aria-current': S.current?.id === c.id ? 'true' : 'false',
        onclick: () => { openChapter(c, 0); $('nav').classList.remove('open'); },
      }, c.title, S.pending.some((p) => p.chapter_id === c.id) ? el('span', { class: 'pct', text: '✎' }) : null)));
    }
  }

  function openChapter(c, scrollPct) {
    ttsStop();
    S.current = c;
    S.paras = splitParas(c.body);
    const r = $('reader'); r.textContent = '';
    r.append(el('h2', { text: c.title }));
    const anns = S.annotations.filter((a) => a.chapter_id === c.id && a.version_id === c.current_version_id && !a.resolved);
    S.paras.forEach((p, i) => r.append(renderPara(p, i, anns)));
    if (!S.paras.length) r.append(el('p', { class: 'empty-chapter', text: 'This chapter is empty. Press “✎ Propose edit” to write it.' }));
    renderChapterList(); renderComments();
    const idx = S.chapters.indexOf(c);
    $('progressLabel').textContent = `${idx + 1} of ${S.chapters.length} · ${wordCount(c.body).toLocaleString()} words`;
    const wrap = document.querySelector('.reader-wrap');
    requestAnimationFrame(() => { wrap.scrollTop = scrollPct ? scrollPct * (wrap.scrollHeight - wrap.clientHeight) : 0; });
    saveProgress();
  }

  function renderPara(p, i, anns) {
    const node = el('p', { dataset: { start: p.start, idx: i } });
    const s0 = p.start, s1 = p.start + p.text.length;
    const hits = anns.filter((a) => a.end_offset > s0 && a.start_offset < s1);
    if (!hits.length) { node.textContent = p.text; return node; }
    const cuts = new Set([s0, s1]);
    for (const a of hits) { cuts.add(Math.max(s0, a.start_offset)); cuts.add(Math.min(s1, a.end_offset)); }
    const pts = [...cuts].sort((x, y) => x - y);
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1], text = p.text.slice(a - s0, b - s0);
      const on = hits.filter((h) => h.start_offset <= a && h.end_offset >= b);
      if (!on.length) node.append(document.createTextNode(text));
      else node.append(el('mark', { dataset: { ids: on.map((h) => h.id).join(',') }, onclick: () => focusComment(on[0].id), text }));
    }
    return node;
  }

  function step(delta) {
    const i = S.chapters.indexOf(S.current) + delta;
    if (S.chapters[i]) openChapter(S.chapters[i], 0);
  }

  let progTimer;
  function saveProgress() {
    clearTimeout(progTimer);
    progTimer = setTimeout(() => {
      if (!S.current || !S.db) return;
      const w = document.querySelector('.reader-wrap');
      const pct = Math.max(0, Math.min(1, w.scrollTop / Math.max(1, w.scrollHeight - w.clientHeight)));
      S.db.reading = { chapter_id: S.current.id, scroll_pct: pct, updated_at: now() };
      saveDb();
    }, 1500);
  }

  function firstVisibleParaIdx() {
    const w = document.querySelector('.reader-wrap'), top = w.getBoundingClientRect().top + 60;
    const ps = [...$('reader').querySelectorAll('p[data-idx]')];
    const p = ps.find((x) => x.getBoundingClientRect().bottom > top);
    return p ? Number(p.dataset.idx) : 0;
  }
  function scrollToOffset(off) {
    const ps = [...$('reader').querySelectorAll('p[data-start]')];
    const p = ps.reverse().find((x) => Number(x.dataset.start) <= off) || ps[ps.length - 1];
    p?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  // ------------------------------------------------------------ bookmarks
  function renderBookmarks() {
    const ul = $('bookmarkList'); ul.textContent = '';
    if (!S.bookmarks.length) ul.append(el('li', { class: 'muted', text: 'None yet' }));
    for (const b of S.bookmarks) {
      const ch = S.chapters.find((c) => c.id === b.chapter_id);
      ul.append(el('li', null,
        el('button', { class: 'link', text: b.label || ch?.title || 'Bookmark', onclick: () => {
          if (ch) { if (S.current !== ch) openChapter(ch, 0); setTimeout(() => scrollToOffset(b.char_offset), 50); }
          $('nav').classList.remove('open');
        } }), ' ',
        el('button', { class: 'link', 'aria-label': 'Remove bookmark', text: '×', onclick: () => {
          S.db.bookmarks = S.db.bookmarks.filter((x) => x.id !== b.id); saveDb();
          S.bookmarks = S.bookmarks.filter((x) => x !== b); renderBookmarks();
        } })));
    }
  }
  function addBookmark() {
    if (!S.current) return;
    const p = S.paras[firstVisibleParaIdx()] || { start: 0, text: '' };
    const label = `${S.current.title} — “${p.text.trim().split(/\s+/).slice(0, 6).join(' ')}…”`;
    const b = { id: uid(), chapter_id: S.current.id, char_offset: p.start, label: label.slice(0, 200), created_at: now() };
    S.db.bookmarks.push(b); saveDb();
    S.bookmarks.unshift(b); renderBookmarks(); toast('Bookmarked');
  }

  // ------------------------------------------------------------ comments
  function renderComments() {
    const ul = $('commentList'); ul.textContent = '';
    const list = S.annotations.filter((a) => a.chapter_id === S.current?.id);
    if (!list.length) ul.append(el('li', { class: 'muted small', text: 'No comments on this chapter.' }));
    for (const a of list) {
      const old = a.version_id !== S.current.current_version_id;
      ul.append(el('li', { class: 'comment' + (a.resolved ? ' resolved' : ''), id: 'c-' + a.id },
        el('q', { text: a.quote.length > 220 ? a.quote.slice(0, 220) + '…' : a.quote }),
        el('div', { text: a.comment }),
        el('div', { class: 'small muted', text: fmtDate(a.updated_at) + (old ? ' · on an earlier version' : '') }),
        el('div', { class: 'row' },
          !old && !a.resolved ? el('button', { text: 'Show', onclick: () => scrollToOffset(a.start_offset) }) : null,
          el('button', { text: 'Edit', onclick: () => editComment(a) }),
          el('button', { text: a.resolved ? 'Reopen' : 'Resolve', onclick: () => updateComment(a, { resolved: !a.resolved }) }),
          el('button', { class: 'danger', text: 'Delete', onclick: () => {
            dialog('Delete comment?', el('p', { text: 'This removes the comment. A copy is kept in the edit log.' }), [
              { label: 'Cancel' },
              { label: 'Delete', cls: 'danger', onClick: () => {
                S.db.annotations = S.db.annotations.filter((x) => x.id !== a.id);
                audit('comment_deleted', 'annotation', { quote: a.quote, comment: a.comment }); saveDb();
                S.annotations = S.annotations.filter((x) => x !== a); openChapterKeepScroll();
              } }]);
          } }))));
    }
  }
  function focusComment(id) {
    const li = $('c-' + id); if (!li) return;
    li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    li.animate([{ outline: '2px solid var(--accent)' }, { outline: '2px solid transparent' }], { duration: 1400 });
  }
  function openChapterKeepScroll() {
    const w = document.querySelector('.reader-wrap'), top = w.scrollTop;
    openChapter(S.current, null); requestAnimationFrame(() => (w.scrollTop = top));
  }
  function updateComment(a, patch) {
    const row = S.db.annotations.find((x) => x.id === a.id); if (!row) return;
    if (patch.comment != null) audit('comment_edited', 'annotation', { old_comment: row.comment, new_comment: patch.comment });
    if (patch.resolved != null) audit(patch.resolved ? 'comment_resolved' : 'comment_reopened', 'annotation', { quote: row.quote });
    Object.assign(row, patch, { updated_at: now() }); saveDb();
    Object.assign(a, row); openChapterKeepScroll();
  }
  function editComment(a) {
    const ta = el('textarea', { rows: 6, class: 'short' }); ta.value = a.comment;
    dialog('Edit comment', [el('q', { class: 'small muted', text: a.quote }), ta], [
      { label: 'Cancel' },
      { label: 'Save', cls: 'primary', onClick: () => { if (ta.value.trim()) updateComment(a, { comment: ta.value.trim() }); } }]);
  }

  // selection -> comment button
  let pendingSel = null;
  function selectionOffsets() {
    const sel = getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount || !S.current) return null;
    const range = sel.getRangeAt(0);
    const pa = (range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement)?.closest('p[data-start]');
    const pb = (range.endContainer.nodeType === 1 ? range.endContainer : range.endContainer.parentElement)?.closest('p[data-start]');
    if (!pa || !pb || !$('reader').contains(pa)) return null;
    const off = (p, node, o) => { const r = document.createRange(); r.setStart(p, 0); r.setEnd(node, o); return Number(p.dataset.start) + r.toString().length; };
    const start = off(pa, range.startContainer, range.startOffset), end = off(pb, range.endContainer, range.endOffset);
    if (end <= start) return null;
    return { start, end, rect: range.getBoundingClientRect() };
  }
  function onSelection() {
    const fab = $('commentFab');
    const s = selectionOffsets();
    pendingSel = s;
    if (!s) { fab.hidden = true; return; }
    fab.hidden = false;
    const x = Math.min(innerWidth - 140, Math.max(16, s.rect.left + s.rect.width / 2 - 60));
    const y = s.rect.bottom + 10 > innerHeight - 50 ? s.rect.top - 48 : s.rect.bottom + 10;
    fab.style.left = x + 'px'; fab.style.top = y + 'px';
  }
  let selTimer;
  document.addEventListener('selectionchange', () => { clearTimeout(selTimer); selTimer = setTimeout(onSelection, 180); });

  function newComment() {
    const s = pendingSel; if (!s || !S.current) return;
    const quote = S.current.body.slice(s.start, s.end).slice(0, 5000);
    const ta = el('textarea', { rows: 6, class: 'short', placeholder: 'Your note: a question, a fact to check, a better word…' });
    dialog('Comment', [el('q', { class: 'small muted', text: quote.length > 400 ? quote.slice(0, 400) + '…' : quote }), ta], [
      { label: 'Cancel' },
      { label: 'Save comment', cls: 'primary', onClick: () => {
        if (!ta.value.trim()) return true;
        const a = { id: uid(), chapter_id: S.current.id, version_id: S.current.current_version_id,
          start_offset: s.start, end_offset: s.end, quote, comment: ta.value.trim(), resolved: false, created_at: now(), updated_at: now() };
        S.db.annotations.push(a); audit('comment_added', 'annotation', { quote, comment: a.comment }); saveDb();
        S.annotations.push(a); getSelection().removeAllRanges(); $('commentFab').hidden = true;
        openChapterKeepScroll(); toast('Comment saved');
      } }]);
    setTimeout(() => ta.focus(), 50);
  }

  // ------------------------------------------------------------ proposals
  function saveProposal(c, title, body, why, label) {
    const p = { id: uid(), chapter_id: c.id, base_version_id: c.current_version_id, proposed_title: title, proposed_body: body,
      rationale: why || null, author_label: label || 'you', status: 'pending', created_at: now() };
    S.db.proposals.push(p); audit('proposal_created', 'proposal', { chapter: c.title, rationale: why || '' });
    return p;
  }
  function approve(p, note) {
    const ch = S.db.chapters.find((c) => c.id === p.chapter_id);
    if (!ch) throw new Error('That chapter no longer exists.');
    if (ch.current_version_id !== p.base_version_id) throw new Error('This proposal was written against an older version, so it can’t be approved.');
    const v = addVersion(ch, p.proposed_title || ch.title, p.proposed_body, p.author_label === 'import' ? 'import' : 'proposal', note || p.rationale);
    p.status = 'approved'; p.decided_at = now();
    // stale proposals for the same base are now conflicts; they stay pending so you can read them
    audit('proposal_approved', 'proposal', { chapter: ch.title, version: v.version_no });
    return v;
  }
  function proposeEdit() {
    const c = S.current; if (!c) return toast('Make a chapter first (+ New chapter)', true);
    const t = el('input', { 'aria-label': 'Chapter title' }); t.value = c.title;
    const ta = el('textarea', { 'aria-label': 'Chapter text', placeholder: 'Write here. Leave a blank line between paragraphs.' }); ta.value = c.body;
    const why = el('input', { placeholder: 'What changed and why (optional)', maxlength: 500 });
    const changed = () => !(ta.value === c.body && t.value === c.title);
    dialog('Propose an edit — ' + c.title, [
      el('p', { class: 'small muted', text: 'Proposals never change the text by themselves. You review the differences and approve them first — or approve right away if you are sure.' }),
      t, ta, why,
    ], [
      { label: 'Cancel' },
      { label: 'Save proposal', onClick: () => {
        if (!changed()) { toast('No changes to propose'); return true; }
        saveProposal(c, t.value.trim() || c.title, ta.value, why.value.trim()); saveDb();
        toast('Saved as a proposal'); loadAll(c.id);
      } },
      { label: 'Save & approve now', cls: 'primary', onClick: () => {
        if (!changed()) { toast('No changes to save'); return true; }
        const p = saveProposal(c, t.value.trim() || c.title, ta.value, why.value.trim());
        const v = approve(p); saveDb();
        toast(`Saved as version ${v.version_no}`); loadAll(c.id);
      } }]);
    setTimeout(() => ta.focus(), 50);
  }

  function showProposals() {
    if (!S.pending.length) return dialog('Proposals', el('p', { class: 'muted', text: 'Nothing waiting for review.' }), [{ label: 'Close' }]);
    const list = el('ul', { class: 'list' });
    for (const p of S.pending) {
      const ch = S.chapters.find((c) => c.id === p.chapter_id);
      const stale = ch && ch.current_version_id !== p.base_version_id;
      list.append(el('li', null,
        el('div', { class: 'grow' },
          el('strong', { text: ch?.title || 'Chapter' }), ' ',
          el('span', { class: 'tag', text: p.author_label }), stale ? el('span', { class: 'tag', text: 'out of date' }) : null,
          el('div', { class: 'small muted', text: fmtDate(p.created_at) + (p.rationale ? ' · ' + p.rationale : '') })),
        el('button', { text: 'Review', onclick: () => reviewProposal(p) })));
    }
    dialog(`Proposals (${S.pending.length})`, list, [{ label: 'Close' }]);
  }

  function reviewProposal(p) {
    const ch = S.chapters.find((c) => c.id === p.chapter_id);
    if (!ch) return toast('That chapter no longer exists', true);
    const stale = ch.current_version_id !== p.base_version_id;
    const box = el('div');
    const n = window.StudioDiff.render(box, ch.body, p.proposed_body);
    const parts = [];
    if (stale) parts.push(el('div', { class: 'notice', text: 'This proposal was written against an older version of the chapter, so it can’t be approved as-is. Reject it, or copy what you like into a fresh proposal.' }));
    if (p.proposed_title !== ch.title) { const tb = el('div'); window.StudioDiff.render(tb, ch.title, p.proposed_title); parts.push(el('div', { class: 'small muted', text: 'Title' }), tb); }
    parts.push(el('div', { class: 'small muted', text: `${n} change${n === 1 ? '' : 's'} · green = added, red = removed` }), box);
    dialog('Review — ' + ch.title, parts, [
      { label: 'Back', onClick: () => { showProposals(); return true; } },
      { label: 'Reject', cls: 'danger', onClick: () => {
        const row = S.db.proposals.find((x) => x.id === p.id); row.status = 'rejected'; row.decided_at = now();
        audit('proposal_rejected', 'proposal', { chapter: ch.title }); saveDb();
        toast('Proposal rejected'); loadAll(S.current?.id);
      } },
      stale ? null : { label: 'Approve & replace text', cls: 'primary', onClick: () => {
        approve(S.db.proposals.find((x) => x.id === p.id)); saveDb();
        toast('Approved — new version saved'); loadAll(ch.id);
      } },
    ].filter(Boolean));
  }

  // ------------------------------------------------------------ history
  function showHistory() {
    const c = S.current; if (!c) return;
    const data = S.db.versions.filter((v) => v.chapter_id === c.id).sort((a, b) => b.version_no - a.version_no);
    const list = el('ul', { class: 'list' });
    for (const v of data) {
      const isCur = v.id === c.current_version_id;
      list.append(el('li', null,
        el('div', { class: 'grow' }, el('strong', { text: 'Version ' + v.version_no }), ' ', el('span', { class: 'tag', text: v.source.replace('_', ' ') }),
          isCur ? el('span', { class: 'tag', text: 'current' }) : null,
          el('div', { class: 'small muted', text: fmtDate(v.created_at) + ' · ' + wordCount(v.body).toLocaleString() + ' words' + (v.note ? ' · ' + v.note : '') })),
        isCur ? null : el('button', { text: 'Compare', onclick: () => compareVersion(v) })));
    }
    dialog('History — ' + c.title, [el('p', { class: 'small muted', text: 'Every version is kept. Restoring copies an old version forward as a new one.' }), list], [{ label: 'Close' }]);
  }
  function compareVersion(v) {
    const c = S.current;
    const box = el('div'); const n = window.StudioDiff.render(box, v.body, c.body);
    dialog(`Version ${v.version_no} → current`, [el('div', { class: 'small muted', text: `${n} change${n === 1 ? '' : 's'} since version ${v.version_no} · green = added since, red = removed since` }), box], [
      { label: 'Back', onClick: () => { showHistory(); return true; } },
      { label: `Restore version ${v.version_no}`, cls: 'primary', onClick: () => {
        const ch = S.db.chapters.find((x) => x.id === c.id);
        const nv = addVersion(ch, v.title || ch.title, v.body, 'rollback', `restored from version ${v.version_no}`);
        audit('chapter_rolled_back', 'chapter', { chapter: ch.title, from: v.version_no, to: nv.version_no }); saveDb();
        toast(`Restored version ${v.version_no} as a new version`); loadAll(c.id);
      } }]);
  }

  // ------------------------------------------------------------ book + chapters
  function renameBook() {
    const t = el('input', { 'aria-label': 'Book title', maxlength: 200 }); t.value = S.title;
    dialog('Rename book', [t], [{ label: 'Cancel' }, { label: 'Save', cls: 'primary', onClick: () => {
      const v = t.value.trim(); if (!v) return true;
      audit('book_renamed', 'book', { from: S.db.title, to: v }); S.db.title = v; saveDb(); loadAll(S.current?.id);
    } }]);
    setTimeout(() => t.select(), 50);
  }
  function addChapter() {
    const t = el('input', { 'aria-label': 'Chapter title', maxlength: 200, placeholder: 'Chapter title' });
    t.value = `Chapter ${S.chapters.length + 1}`;
    dialog('New chapter', [t], [{ label: 'Cancel' }, { label: 'Create', cls: 'primary', onClick: () => {
      const ch = newChapter(t.value.trim() || undefined, '', 'new'); saveDb(); loadAll(ch.id);
      $('nav').classList.remove('open'); setTimeout(proposeEdit, 60);
    } }]);
    setTimeout(() => t.select(), 50);
  }
  function deleteChapter() {
    const c = S.current; if (!c) return;
    dialog('Delete chapter?', [el('p', { text: `“${c.title}” will be removed from the book. Its versions stay in any dated snapshots you saved, and the edit log keeps a note.` })], [
      { label: 'Cancel' },
      { label: 'Delete chapter', cls: 'danger', onClick: () => {
        S.db.chapters = S.db.chapters.filter((x) => x.id !== c.id);
        S.db.proposals.forEach((p) => { if (p.chapter_id === c.id && p.status === 'pending') p.status = 'withdrawn'; });
        S.db.bookmarks = S.db.bookmarks.filter((b) => b.chapter_id !== c.id);
        audit('chapter_deleted', 'chapter', { title: c.title, words: wordCount(c.body) }); saveDb(); loadAll();
      } }]);
  }
  function closeBook() {
    dialog('Close this book?', [el('p', { text: 'This erases the book, its history, comments and snapshots from this device. Export it first if you want to keep it.' })], [
      { label: 'Cancel' },
      { label: 'Export .md first', onClick: () => { exportText('md'); return true; } },
      { label: 'Erase from this device', cls: 'danger', onClick: () => { ttsStop(); store.del(KEY); location.replace(location.pathname); } }]);
  }

  // ------------------------------------------------------------ snapshots ("dated masters"), import, export, audit
  function download(blob, name) {
    const a = el('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const safeName = (s) => (s || 'book').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'book';
  function bookText(kind, title, chapters) {
    if (kind === 'md') return ['# ' + title, '', ...chapters.flatMap((c) => ['## ' + c.title, '', c.body, ''])].join('\n');
    return [title.toUpperCase(), '', ...chapters.flatMap((c) => [c.title, '-'.repeat(Math.min(60, c.title.length)), '', c.body, '', ''])].join('\n');
  }
  function exportText(kind, master) {
    const chs = master ? master.chapters : S.chapters;
    if (!chs.length) return toast('Nothing to export yet', true);
    const title = master ? `${S.title} (${master.label})` : S.title;
    download(new Blob([bookText(kind, title, chs)], { type: kind === 'md' ? 'text/markdown' : 'text/plain' }),
      `${safeName(S.title)}_${(master?.master_date) || new Date().toISOString().slice(0, 10)}.${kind}`);
  }
  function printBook() {
    if (!S.chapters.length) return toast('Nothing to print yet', true);
    const w = window.open('', '_blank'); if (!w) return toast('Your browser blocked the print window. Use Export instead.', true);
    const d = w.document;
    d.open(); d.write('<!doctype html><meta charset="utf-8"><title></title><style>body{font:12pt/1.6 Georgia,serif;max-width:40em;margin:2em auto;color:#111}h1{text-align:center}h2{page-break-before:always}p{white-space:pre-line}</style><body></body>'); d.close();
    d.title = S.title;
    d.body.append(Object.assign(d.createElement('h1'), { textContent: S.title }));
    for (const c of S.chapters) {
      d.body.append(Object.assign(d.createElement('h2'), { textContent: c.title }));
      for (const p of splitParas(c.body)) d.body.append(Object.assign(d.createElement('p'), { textContent: p.text }));
    }
    setTimeout(() => w.print(), 300);
  }
  function snapshot(label, filename) {
    const chs = S.db.chapters.slice().sort((a, b) => a.chapter_no - b.chapter_no).map((c) => ({ title: c.title, body: c.body }));
    const m = { id: uid(), label: label || 'Snapshot', master_date: new Date().toISOString().slice(0, 10), source_filename: filename || null,
      word_count: chs.reduce((n, c) => n + wordCount(c.body), 0), created_at: now(), chapters: chs };
    S.db.masters.push(m); audit('snapshot_saved', 'master', { label: m.label, words: m.word_count });
    return m;
  }
  function askSnapshot() {
    const label = el('input', { maxlength: 120 }); label.value = 'Draft ' + (S.db.masters.length + 1);
    dialog('Save a dated snapshot', [el('p', { class: 'small muted', text: 'A snapshot is a frozen copy of the whole book as it is right now. Snapshots are never edited, and you can download any of them later.' }),
      el('label', { class: 'stack' }, 'Label', label)], [
      { label: 'Cancel' },
      { label: 'Save snapshot', cls: 'primary', onClick: () => { snapshot(label.value.trim()); saveDb(); toast('Snapshot saved'); } }]);
  }
  function showMasters() {
    const data = S.db.masters.slice().reverse();
    const list = el('ul', { class: 'list' });
    if (!data.length) list.append(el('li', { class: 'muted', text: 'No snapshots yet. ⋯ → “Save a dated snapshot…” makes one; every import makes one too.' }));
    for (const m of data) list.append(el('li', null,
      el('div', { class: 'grow' }, el('strong', { text: m.label }), el('div', { class: 'small muted', text: `${m.master_date} · ${m.word_count?.toLocaleString() ?? '?'} words · ${m.chapters.length} chapters${m.source_filename ? ' · ' + m.source_filename : ''}` })),
      el('button', { text: 'Download .md', onclick: () => exportText('md', m) })));
    dialog('Dated snapshots (permanent, never edited)', list, [{ label: 'Close' }]);
  }

  // --- import: split a file into chapters (same rules as the Dopps import-docx function) ---
  const WORD_NUMS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20 };
  function romanToInt(s) { const v = { i: 1, v: 5, x: 10, l: 50, c: 100 }; let t = 0; for (let i = 0; i < s.length; i++) { const a = v[s[i]], b = v[s[i + 1]] || 0; if (!a) return NaN; t += a < b ? -a : a; } return t; }
  function parseChapterHeading(line) {
    const m = /^\s*chapter\s+([0-9]+|[ivxlc]+|[a-z]+)\b[\s.:—–-]*(.*)$/i.exec(line || '');
    if (!m) return null;
    const tok = m[1].toLowerCase(); const n = /^\d+$/.test(tok) ? parseInt(tok, 10) : WORD_NUMS[tok] ?? romanToInt(tok);
    if (!Number.isFinite(n) || n <= 0) return null;
    return { number: n, rest: m[2].trim() };
  }
  /** blocks [{kind:'h1'|'h2'|'p', text}] → [{title, body}] */
  function splitChapters(blocks) {
    const hasChapterWord = blocks.some((b) => parseChapterHeading(b.text) && (b.kind.startsWith('h') || b.text.length < 120));
    const out = []; let cur = null; const front = [];
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const isHead = hasChapterWord ? !!(parseChapterHeading(b.text) && (b.kind.startsWith('h') || b.text.length < 120)) : b.kind === 'h1' || (b.kind === 'h2' && !blocks.some((x) => x.kind === 'h1'));
      if (isHead) {
        let title = b.text.trim();
        const parsed = parseChapterHeading(b.text);
        if (parsed && !parsed.rest) {
          const nx = blocks[i + 1];
          if (nx && (nx.kind.startsWith('h') || nx.text.length < 120) && !parseChapterHeading(nx.text)) { title = `${title}: ${nx.text.trim()}`; i++; }
        }
        cur = { title, paras: [] }; out.push(cur);
      } else (cur ? cur.paras : front).push(b.text);
    }
    if (front.join('').trim()) out.unshift({ title: out.length ? 'Front matter' : 'Chapter 1', paras: front });
    return out.map((c) => ({ title: c.title.slice(0, 200), body: c.paras.join('\n\n').trim() }));
  }
  function textToBlocks(text, md) {
    const blocks = [];
    for (const para of text.replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
      const lines = para.split('\n');
      let buf = [];
      const flush = () => { const t = buf.join(md ? ' ' : '\n').trim(); if (t) blocks.push({ kind: 'p', text: md ? t.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/(^|\s)\*([^*]+)\*/g, '$1$2') : t }); buf = []; };
      for (const l of lines) {
        const h = md && /^(#{1,6})\s+(.*)$/.exec(l.trim());
        if (h) { flush(); blocks.push({ kind: 'h' + h[1].length, text: h[2].trim() }); }
        else buf.push(l);
      }
      flush();
    }
    // a Markdown "# Book title" alone at the top is the book's title, not a chapter
    return blocks;
  }
  function htmlToBlocks(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return [...doc.body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote')]
      .map((n) => ({ kind: n.tagName.toLowerCase(), text: n.textContent.replace(/\s+/g, ' ').trim() })).filter((b) => b.text);
  }
  async function readDocx(file) {
    if (!window.mammoth) await new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js';
      s.onload = res; s.onerror = () => rej(new Error('Couldn’t load the Word reader. Check your connection, or save the file as .txt or .md.'));
      document.head.appendChild(s);
    });
    const r = await window.mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    return htmlToBlocks(r.value);
  }

  function warn(msg) { if (S.db) toast(msg, true); else gateMsg(msg); }
  function pickImport() { $('fileInput').value = ''; $('fileInput').click(); }
  async function onFilePicked() {
    const file = $('fileInput').files[0]; if (!file) return;
    const kind = /\.docx$/i.test(file.name) ? 'docx' : /\.(md|markdown)$/i.test(file.name) ? 'md' : /\.txt$/i.test(file.name) ? 'txt' : null;
    if (!kind) return warn('Please choose a .docx, .md or .txt file');
    if (file.size > 10 * 1024 * 1024) return warn('That file is over 10 MB');
    let blocks;
    try { blocks = kind === 'docx' ? await readDocx(file) : textToBlocks(await file.text(), kind === 'md'); }
    catch (e) { console.warn(e); return warn(e.message || 'That file could not be read.'); }
    let bookTitle = file.name.replace(/\.(docx|md|markdown|txt)$/i, '').replace(/[_-]+/g, ' ').trim();
    if (kind === 'md' && blocks[0]?.kind === 'h1' && blocks.filter((b) => b.kind === 'h1').length === 1 && blocks.some((b) => b.kind === 'h2')) bookTitle = blocks.shift().text;
    const chs = splitChapters(blocks).filter((c) => c.body || c.title);
    if (!chs.length) return warn('No text was found in that file.');
    const words = chs.reduce((n, c) => n + wordCount(c.body), 0);
    const first = !S.db || !S.db.chapters.length;
    const label = el('input'); label.value = file.name.replace(/\.(docx|md|markdown|txt)$/i, '').replace(/_/g, ' ');
    dialog('Import ' + file.name, [
      el('p', { text: `Found ${chs.length} chapter${chs.length === 1 ? '' : 's'} and ${words.toLocaleString()} words. It is read on this device only — nothing is uploaded.` }),
      el('p', { class: 'small muted', text: first ? 'This first import sets up your chapters and saves a dated snapshot.' : 'Your current text will NOT be overwritten — any chapter with the same title that differs becomes a proposal for you to review; new titles become new chapters.' }),
      el('label', { class: 'stack' }, 'Snapshot label', label),
    ], [
      { label: 'Cancel' },
      { label: 'Import', cls: 'primary', onClick: () => {
        if (!S.db) S.db = emptyDb(bookTitle);
        let seeded = 0, proposed = 0, unchanged = 0;
        for (const c of chs) {
          const match = S.db.chapters.find((x) => x.title.trim().toLowerCase() === c.title.trim().toLowerCase());
          if (!match) { newChapter(c.title, c.body, 'import'); seeded++; }
          else if (match.body.trim() === c.body.trim()) unchanged++;
          else { saveProposal(match, match.title, c.body, `from ${file.name}`, 'import'); proposed++; }
        }
        snapshot(label.value.trim() || file.name, file.name);
        audit('file_imported', 'master', { file: file.name, chapters: chs.length, words, seeded, proposed, unchanged });
        saveDb();
        toast(`Imported ${chs.length} chapters · ${words.toLocaleString()} words · ${seeded} new, ${proposed} proposed, ${unchanged} unchanged`);
        enterStudio(S.current?.id);
      } }]);
  }
  function showAudit() {
    const data = S.db.audit.slice(-150).reverse();
    const list = el('ul', { class: 'list' });
    if (!data.length) list.append(el('li', { class: 'muted', text: 'No edits yet.' }));
    for (const a of data) {
      const d = { ...a.detail }; for (const k of ['old_comment', 'new_comment', 'comment', 'quote', 'rationale']) if (d[k]) d[k] = String(d[k]).slice(0, 60) + (String(d[k]).length > 60 ? '…' : '');
      list.append(el('li', null, el('div', { class: 'grow' }, el('strong', { text: a.action.replace(/_/g, ' ') }), el('div', { class: 'small muted', text: fmtDate(a.at) + (Object.keys(d).length ? ' · ' + Object.entries(d).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' · ') : '') }))));
    }
    dialog('Edit log', list, [{ label: 'Close' }]);
  }

  // ------------------------------------------------------------ research notes
  // Notes and sources that sit beside the book (never part of it).
  const NOTE_STATUSES = ['open', 'verified', 'integrated', 'archived'];
  function showResearch() {
    const data = S.db.notes.slice().sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    const filter = el('select', { 'aria-label': 'Show' },
      el('option', { value: 'active', text: 'Open + verified' }),
      ...NOTE_STATUSES.map((s) => el('option', { value: s, text: s[0].toUpperCase() + s.slice(1) })),
      el('option', { value: 'all', text: 'All notes' }));
    const list = el('ul', { class: 'list' });
    const render = () => {
      list.textContent = '';
      const f = filter.value;
      const rows = data.filter((n) => f === 'all' || (f === 'active' ? ['open', 'verified'].includes(n.status) : n.status === f));
      if (!rows.length) list.append(el('li', { class: 'muted', text: 'No research notes here yet.' }));
      for (const n of rows) {
        list.append(el('li', null,
          el('div', { class: 'grow' }, el('strong', { text: n.title }),
            el('div', { class: 'small muted', text: `${fmtDate(n.updated_at)}${n.tags.length ? ' · ' + n.tags.join(', ') : ''}` })),
          el('span', { class: 'tag', text: n.status }),
          el('button', { type: 'button', text: 'Open', onclick: () => openNote(n) })));
      }
    };
    filter.addEventListener('change', render); render();
    dialog('Research notes', [el('p', { class: 'small muted', text: 'Facts to check, sources, and open questions that sit beside the book. They are not part of the text.' }), filter, list],
      [{ label: '+ New note', cls: 'primary', onClick: () => { openNote(null); return true; } }, { label: 'Close' }]);
  }
  function openNote(n) {
    const title = el('input', { value: n?.title || '', maxlength: 300, 'aria-label': 'Title', placeholder: 'Title' });
    const status = el('select', { 'aria-label': 'Status' }, ...NOTE_STATUSES.map((s) => el('option', { value: s, text: s, selected: (n?.status || 'open') === s })));
    const tags = el('input', { value: (n?.tags || []).join(', '), 'aria-label': 'Tags', placeholder: 'Tags, comma separated' });
    const body = el('textarea', { 'aria-label': 'Note' }); body.value = n?.body || '';
    const save = () => {
      const row = { title: title.value.trim(), body: body.value, status: status.value, tags: tags.value.split(',').map((t) => t.trim()).filter(Boolean), updated_at: now() };
      if (!row.title) { toast('Give the note a title.', true); return true; }
      if (n) Object.assign(S.db.notes.find((x) => x.id === n.id), row); else S.db.notes.push({ id: uid(), created_at: now(), ...row });
      saveDb(); toast('Note saved'); showResearch(); return true;
    };
    const buttons = [{ label: 'Save', cls: 'primary', onClick: save }];
    if (n) buttons.push({ label: 'Delete', cls: 'danger', onClick: () => {
      if (!confirm('Delete this research note? This cannot be undone.')) return true;
      S.db.notes = S.db.notes.filter((x) => x.id !== n.id); saveDb(); toast('Note deleted'); showResearch(); return true;
    } });
    buttons.push({ label: 'Back', onClick: () => { showResearch(); return true; } });
    dialog(n ? 'Research note' : 'New research note', [title, el('div', { class: 'row' }, status, tags), body], buttons);
  }

  // ------------------------------------------------------------ start screen
  const SAMPLE = {
    title: 'A Field Guide to Idaho Rocks',
    chapters: [
      ['The Snake River Plain', 'Drive across southern Idaho and the land is flat, dark and wide. That flat land is the Snake River Plain, a curved path of volcanic rock about 400 miles long.\n\nMost of the rock here is basalt, a dark, fine-grained igneous rock that forms when runny lava cools quickly. Layer after layer of basalt flows built the plain over millions of years.\n\nWhy is it here? The North American Plate has been sliding southwest over a hot spot in the mantle. The hot spot stayed put while the plate moved, so the volcanoes it fed left a trail. Today the hot spot sits under Yellowstone.\n\nThe Snake River cut down through the basalt. At Shoshone Falls near Twin Falls, the river drops about 212 feet over a cliff of volcanic rock.'],
      ['Craters of the Moon', 'Craters of the Moon National Monument looks like another world. Black lava fields, cinder cones and lava tubes spread across more than 600 square miles.\n\nThe lava came out of the Great Rift, a set of deep cracks in the crust. Eruptions here started about 15,000 years ago, and the youngest flows are only about 2,000 years old. Geologists expect it to erupt again someday.\n\nLook for two kinds of basalt lava. Pahoehoe has a smooth, ropy surface. Aa is rough and broken into sharp chunks. In the 1960s, Apollo astronauts trained here to study volcanic rock before going to the Moon.'],
      ['Gems of the Gem State', 'Idaho is nicknamed the Gem State, and its state gem is the star garnet. When light hits a polished star garnet, a four- or six-rayed star seems to glide across its surface.\n\nThe star comes from tiny, needle-shaped crystals of another mineral lined up inside the garnet. They reflect light in a star pattern. Idaho and India are the only places where star garnets are found in useful amounts.\n\nCollectors also find opal, jasper, agate and quartz crystals in Idaho. Each gem is a mineral or rock with a crystal structure that formed under certain conditions of heat, pressure and chemistry.'],
    ],
  };
  function startSample() {
    S.db = emptyDb(SAMPLE.title);
    for (const [t, b] of SAMPLE.chapters) newChapter(t, b, 'sample');
    const ch = S.db.chapters[0];
    const i = ch.body.indexOf('basalt, a dark'); if (i > -1) S.db.annotations.push({ id: uid(), chapter_id: ch.id, version_id: ch.current_version_id, start_offset: i, end_offset: i + 6, quote: 'basalt', comment: 'Add a photo of a basalt sample here? (This is a sample comment. Select any text to add your own.)', resolved: false, created_at: now(), updated_at: now() });
    S.db.notes.push({ id: uid(), title: 'Check: how long is the Snake River Plain?', body: 'Find a source for the length of the plain (USGS or Idaho Geological Survey).', status: 'open', tags: ['fact check'], created_at: now(), updated_at: now() });
    snapshot('Sample book');
    audit('book_started', 'book', { from: 'sample' });
    saveDb(); enterStudio();
  }
  function startBlank() {
    const t = el('input', { 'aria-label': 'Book title', maxlength: 200, placeholder: 'e.g. My Rock Collection Journal' });
    dialog('Start a new book', [el('label', { class: 'stack' }, 'Book title', t)], [{ label: 'Cancel' }, { label: 'Create', cls: 'primary', onClick: () => {
      S.db = emptyDb(t.value.trim() || 'My Book');
      newChapter('Chapter 1', '', 'new');
      audit('book_started', 'book', { from: 'blank' }); saveDb(); enterStudio();
      setTimeout(proposeEdit, 80);
    } }]);
    setTimeout(() => t.focus(), 50);
  }

  // ------------------------------------------------------------ text-to-speech (browser voice, on this device)
  const synth = window.speechSynthesis;
  function loadVoices() {
    if (!synth) { document.querySelector('.tts').hidden = true; return; }
    const sel = $('ttsVoice');
    // Rank voices so the most natural-sounding ones come first and are picked by default:
    // Microsoft "Natural"/"Online" (Edge), Apple Premium/Enhanced/Siri (Safari), then Google (Chrome).
    const score = (v) => (/natural|neural|online/i.test(v.name) ? 40 : /premium|enhanced|siri/i.test(v.name) ? 35 : /google/i.test(v.name) ? 20 : 0)
      + (/^en-US/i.test(v.lang) ? 3 : /^en/i.test(v.lang) ? 2 : 0) + (v.localService ? 0 : 1);
    const voices = synth.getVoices().slice().sort((a, b) => score(b) - score(a));
    const saved = store.get('bedrock_bookstudio_voice');
    const pick = voices.find((v) => v.name === saved) || voices[0];
    sel.textContent = '';
    for (const v of voices) sel.append(el('option', { value: v.name, text: `${score(v) >= 20 ? '★ ' : ''}${v.name} (${v.lang})`, selected: v === pick }));
    sel.hidden = !voices.length;
  }
  function ttsUtter(i) {
    const p = S.paras[i];
    const u = new SpeechSynthesisUtterance(p.text.replace(/\s+/g, ' '));
    const v = synth.getVoices().find((x) => x.name === $('ttsVoice').value); if (v) u.voice = v;
    u.rate = Number($('ttsRate').value) || 1;
    return u;
  }
  function markSpeaking(i) {
    for (const n of $('reader').querySelectorAll('p.speaking')) n.classList.remove('speaking');
    const n = $('reader').querySelector(`p[data-idx="${i}"]`);
    if (n) { n.classList.add('speaking'); const r = n.getBoundingClientRect(); if (r.top < 80 || r.bottom > innerHeight - 20) n.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }
  function ttsSpeakFrom(i) {
    if (!synth || !S.paras.length) return;
    if (i < 0) i = 0;
    if (i >= S.paras.length) return ttsStop();
    const token = ++S.tts.token;
    synth.cancel();
    Object.assign(S.tts, { idx: i, playing: true, paused: false });
    $('ttsPlay').textContent = '⏸'; $('ttsPlay').setAttribute('aria-label', 'Pause');
    markSpeaking(i);
    const u = ttsUtter(i);
    u.onend = () => { if (token === S.tts.token && S.tts.playing && !S.tts.paused) ttsSpeakFrom(i + 1); };
    synth.speak(u);
  }
  function ttsPlayPause() {
    if (!synth) return;
    if (S.tts.playing && !S.tts.paused) { synth.pause(); S.tts.paused = true; $('ttsPlay').textContent = '▶'; $('ttsPlay').setAttribute('aria-label', 'Resume'); return; }
    if (S.tts.paused) { synth.resume(); S.tts.paused = false; $('ttsPlay').textContent = '⏸'; $('ttsPlay').setAttribute('aria-label', 'Pause'); return; }
    ttsSpeakFrom(firstVisibleParaIdx());
  }
  function ttsStop() {
    if (!synth) return;
    S.tts.token++; Object.assign(S.tts, { playing: false, paused: false }); synth.cancel();
    $('ttsPlay').textContent = '▶'; $('ttsPlay').setAttribute('aria-label', 'Play');
    for (const n of $('reader').querySelectorAll('p.speaking')) n.classList.remove('speaking');
  }
  function ttsSkip(d) {
    const i = S.tts.idx + d;
    if (S.tts.playing) ttsSpeakFrom(i); else { S.tts.idx = Math.max(0, Math.min(S.paras.length - 1, i)); markSpeaking(S.tts.idx); }
  }
  // click a paragraph while listening to jump there (paragraph seek)
  $('reader').addEventListener('click', (e) => {
    if (!S.tts.playing || getSelection()?.toString()) return;
    const p = e.target.closest('p[data-idx]'); if (p && !e.target.closest('mark')) ttsSpeakFrom(Number(p.dataset.idx));
  });

  // ------------------------------------------------------------ wiring
  const ACTIONS = {
    theme: toggleTheme,
    'toggle-nav': () => $('nav').classList.toggle('open'),
    'prev-chapter': () => step(-1), 'next-chapter': () => step(1),
    bookmark: addBookmark, propose: proposeEdit, history: showHistory, proposals: showProposals,
    'export-md': () => exportText('md'), 'export-txt': () => exportText('txt'), print: printBook,
    snapshot: askSnapshot, 'show-masters': showMasters, 'import-docx': pickImport, 'show-audit': showAudit, research: showResearch,
    'rename-book': renameBook, 'new-chapter': addChapter, 'delete-chapter': deleteChapter, 'close-book': closeBook,
    'start-sample': startSample, 'start-blank': startBlank,
    'tts-play': ttsPlayPause, 'tts-stop': ttsStop, 'tts-prev': () => ttsSkip(-1), 'tts-next': () => ttsSkip(1),
  };
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-action]'); if (!b) return;
    const fn = ACTIONS[b.dataset.action]; if (!fn) return;
    ev.preventDefault();
    b.closest('details')?.removeAttribute('open');
    Promise.resolve(fn()).catch((e) => fail(e));
  });
  $('commentFab').addEventListener('mousedown', (e) => e.preventDefault());   // keep the selection
  $('commentFab').addEventListener('click', newComment);
  $('fileInput').addEventListener('change', onFilePicked);
  document.querySelector('.reader-wrap').addEventListener('scroll', saveProgress, { passive: true });
  $('ttsVoice').addEventListener('change', () => { store.set('bedrock_bookstudio_voice', $('ttsVoice').value); if (S.tts.playing) ttsSpeakFrom(S.tts.idx); });
  $('ttsRate').addEventListener('change', () => { if (S.tts.playing) ttsSpeakFrom(S.tts.idx); });
  if (synth) { loadVoices(); synth.onvoiceschanged = loadVoices; }
  addEventListener('keydown', (e) => {
    if (e.target.closest('input,textarea,select,dialog')) return;
    if (e.key === 'ArrowRight' && e.altKey) step(1);
    if (e.key === 'ArrowLeft' && e.altKey) step(-1);
  });
  addEventListener('pagehide', () => synth && synth.cancel());
  // another tab changed the book: reload it here too
  addEventListener('storage', (e) => { if (e.key === KEY) { S.db = loadDb(); if (S.db) loadAll(S.current?.id); else location.replace(location.pathname); } });

  init().catch((e) => { console.warn(e); gateMsg('Could not start the Book Studio.'); });
})();
