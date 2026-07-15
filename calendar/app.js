'use strict';

/* ---------- Constants ---------- */

const MONTH_META = [
  { name: 'January', color: '#C7DAE6', panel: '#B0C7DC', subtitle: 'Snowdrop', dark: false },
  { name: 'February', color: '#D7CBE0', panel: '#C3B2D4', subtitle: 'Hellebore', dark: false },
  { name: 'March', color: '#E3BFC0', panel: '#D3A2A4', subtitle: 'Anemone', dark: false },
  { name: 'April', color: '#F0DCA0', panel: '#E4C87E', subtitle: 'Tiger Lily', dark: false },
  { name: 'May', color: '#CFE0C6', panel: '#B6D1A9', subtitle: 'Peony', dark: false },
  { name: 'June', color: '#C9DCE8', panel: '#AFCADC', subtitle: 'Foxglove', dark: false },
  { name: 'July', color: '#EFC28D', panel: '#E3A968', subtitle: '', dark: false },
  { name: 'August', color: '#E3BFC0', panel: '#D3A2A4', subtitle: '', dark: false },
  { name: 'September', color: '#EDDFA6', panel: '#E1CB79', subtitle: '', dark: false },
  { name: 'October', color: '#E7CBAE', panel: '#D8B187', subtitle: 'Chrysanthemum', dark: false },
  { name: 'November', color: '#33415C', panel: '#425073', subtitle: 'Winterberry', dark: true },
  { name: 'December', color: '#D7CBE0', panel: '#C3B2D4', subtitle: 'Amaryllis', dark: false }
];
const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EVENT_COLOR = '#A85C3B';
const TASK_COLOR = '#4B6B4E';
const STORAGE_KEY = 'calendarApp.v1';

/* ---------- Date utils ---------- */

function pad(n) { return String(n).padStart(2, '0'); }
function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function parseISO(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
function addDaysISO(iso, n) { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); }
function addMonthsISO(iso, n) { const d = parseISO(iso); d.setMonth(d.getMonth() + n); d.setDate(1); return toISO(d); }
function fmtDuration(min) {
  if (min == null) return '';
  if (min < 60) return min + ' min';
  const h = Math.floor(min / 60), m = min % 60;
  return h + 'h' + (m ? ' ' + m + 'm' : '');
}
function to12h(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12; if (h12 === 0) h12 = 12;
  return h12 + (m ? ':' + pad(m) : '') + ' ' + ampm;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Seed data ---------- */

function buildSeedItems(baseISO) {
  const items = [];
  let id = 1;
  const add = (offsetDays, title, type, startTime, duration, notes) => {
    items.push({ id: 'seed-' + (id++), title, type, date: addDaysISO(baseISO, offsetDays), startTime, duration, notes: notes || null });
  };
  add(1, 'Call Home Depot', 'task', null, 15);
  add(1, 'Call union', 'task', null, 15);
  add(1, 'Laundry', 'task', '10:00', 60);
  add(1, 'Car battery', 'task', '12:00', 60);
  add(2, 'Laundry', 'task', '10:00', 60);
  add(3, 'Send info to LIT', 'task', '13:00', 120);
  add(3, 'Car battery', 'task', '16:00', 60);
  add(4, 'Mudgirl Run', 'event', null, 120);
  add(4, 'Pool party', 'event', null, 180);
  add(5, 'Print marketing materials', 'task', '09:00', 120);
  add(5, 'Send files to LIT', 'task', '13:00', 120, 'Depends on info from Wednesday’s calls.');
  // Biweekly Edifice Atelier meeting, starting one week from today, through the end of August.
  {
    const baseD = parseISO(baseISO);
    let augEndYear = baseD.getFullYear();
    if (baseD.getMonth() > 7) augEndYear += 1;
    const augEndISO = toISO(new Date(augEndYear, 8, 0));
    for (let i = 6; i <= 120; i += 14) {
      const dateISO = addDaysISO(baseISO, i);
      if (dateISO > augEndISO) break;
      add(i, 'Meeting with Edifice Atelier', 'event', '18:30', 120);
    }
  }
  return items;
}

/* ---------- Persistence ---------- */

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: state.items, nextId: state.nextId }));
  } catch (e) {
    /* localStorage unavailable; edits just won't persist */
  }
}

/* ---------- State ---------- */

const today = new Date();
const todayISO = toISO(today);
const persisted = loadPersisted();

function freshDraft(iso) {
  return { title: '', type: 'task', date: iso, hasTime: true, startTime: '09:00', duration: 60 };
}

const state = {
  view: 'day',
  selectedISO: todayISO,
  items: persisted ? persisted.items : buildSeedItems(todayISO),
  nextId: persisted ? persisted.nextId : 1,
  detailOpen: false,
  editing: false,
  modalItemId: null,
  editDraft: null,
  addOpen: false,
  addDraft: freshDraft(todayISO),
  printChooserOpen: false,
  printChooserKind: 'day',
  printChooserDate: todayISO,
  printTarget: null
};

/* ---------- Data helpers ---------- */

function monthMetaFor(monthIndex) { return MONTH_META[((monthIndex % 12) + 12) % 12]; }
function dotColor(type) { return type === 'event' ? EVENT_COLOR : TASK_COLOR; }
function shortTitle(t) { return t.replace('Meeting with Edifice Atelier', 'Edifice Atelier'); }

function itemsForDate(iso) {
  return state.items
    .filter(it => it.date === iso)
    .slice()
    .sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));
}

function buildMonthGrid(year, monthIdx) {
  const first = new Date(year, monthIdx, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toISO(new Date(year, monthIdx, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/* ---------- Row builders ---------- */

function dayItemRowHtml(it, opts) {
  opts = opts || {};
  const timeLabel = it.startTime ? to12h(it.startTime) : 'Anytime';
  const durLabel = fmtDuration(it.duration);
  const clickAttr = opts.forPrint ? '' : ` data-action="openDetail" data-id="${escapeHtml(it.id)}"`;
  return `<div class="item-row"${clickAttr}>
    <span class="item-dot" style="background:${dotColor(it.type)};"></span>
    <span class="item-time">${escapeHtml(timeLabel)}</span>
    <span class="item-title">${escapeHtml(it.title)}</span>
    <span class="item-dur">${escapeHtml(durLabel)}</span>
  </div>`;
}

function listItemRowHtml(it, opts) {
  opts = opts || {};
  const rowClass = opts.rowClass || 'list-row';
  const timeLabel = it.startTime ? to12h(it.startTime) : 'Anytime';
  const durLabel = fmtDuration(it.duration);
  const clickAttr = opts.forPrint ? '' : ` data-action="openDetail" data-id="${escapeHtml(it.id)}"`;
  return `<div class="${rowClass}"${clickAttr}>
    <span class="item-dot" style="background:${dotColor(it.type)};"></span>
    <span class="item-title">${escapeHtml(it.title)}</span>
    <span class="item-time">${escapeHtml(timeLabel)}</span>
    <span class="item-dur">${escapeHtml(durLabel)}</span>
  </div>`;
}

function weekdayHeaderHtml(cellClass) {
  return WEEKDAY_INITIALS.map(wd => `<div class="${cellClass}">${wd}</div>`).join('');
}

/* ---------- Card builders ---------- */

function dayCardHtml(iso, opts) {
  opts = opts || {};
  const forPrint = !!opts.forPrint;
  const d = parseISO(iso);
  const mm = monthMetaFor(d.getMonth());
  const items = itemsForDate(iso);
  const dateLabel = WEEKDAY_SHORT[d.getDay()].toUpperCase() + ', ' + mm.name.toUpperCase() + ' ' + d.getDate();
  const cardClasses = ['card', 'card--day'].concat(mm.dark ? ['card--dark'] : []).join(' ');
  const itemsHtml = items.length
    ? items.map(it => dayItemRowHtml(it, { forPrint })).join('')
    : `<div class="empty-note">Nothing on the books.</div>`;
  return `
    <div class="${cardClasses}" style="background:${mm.color}; color:${mm.dark ? '#F2ECDD' : 'var(--text)'};">
      <div class="illo-panel illo-panel--day" style="background:${mm.panel};">${forPrint ? 'Illustration' : ''}</div>
      <div class="title-block">
        <div class="card-header">${escapeHtml(dateLabel)}</div>
        <div class="card-subtitle">${escapeHtml(mm.subtitle)}</div>
      </div>
      <div class="divider-h"></div>
      <div class="items-wrap${forPrint ? ' print-card-items' : ''}">${itemsHtml}</div>
      <div class="credit-line">A page from the desk calendar &middot; ${d.getFullYear()}</div>
    </div>`;
}

function monthCardInnerCells(iso, compact, interactive) {
  interactive = interactive !== false;
  const d = parseISO(iso);
  const weeks = buildMonthGrid(d.getFullYear(), d.getMonth());
  return weeks.map(week => {
    const cellsHtml = week.map(cIso => {
      if (!cIso) {
        return compact ? `<div class="quarter-cell quarter-cell--empty"></div>` : `<div class="month-cell month-cell--empty"></div>`;
      }
      const items = itemsForDate(cIso);
      const isPast = cIso < todayISO;
      const isToday = cIso === todayISO;
      const dNum = parseISO(cIso).getDate();
      const clickAttr = interactive ? ` data-action="jumpDay" data-iso="${cIso}"` : '';
      if (compact) {
        const cls = ['quarter-cell', isToday ? 'quarter-cell--today' : '', isPast ? 'quarter-cell--past' : ''].filter(Boolean).join(' ');
        const hasDot = items.length > 0;
        const dCol = items.some(i => i.type === 'event') ? EVENT_COLOR : TASK_COLOR;
        return `<div class="${cls}"${clickAttr}>
          <span class="quarter-cell-num">${dNum}</span>
          ${hasDot ? `<span class="quarter-cell-dot" style="background:${dCol};"></span>` : ''}
        </div>`;
      }
      const cls = ['month-cell', isToday ? 'month-cell--today' : '', isPast ? 'month-cell--past' : ''].filter(Boolean).join(' ');
      const preview = items.slice(0, 3).map(it => `<div class="month-chip" style="color:${dotColor(it.type)};">${escapeHtml(shortTitle(it.title))}</div>`).join('');
      const moreHtml = items.length > 3 ? `<div class="month-more">+${items.length - 3} more</div>` : '';
      return `<div class="${cls}"${clickAttr}>
        <div class="month-cell-daynum">${dNum}</div>
        ${preview}
        ${moreHtml}
      </div>`;
    }).join('');
    const rowClass = compact ? 'quarter-week-row' : 'week-row';
    return `<div class="${rowClass}">${cellsHtml}</div>`;
  }).join('');
}

function monthPrintCardHtml(iso) {
  const d = parseISO(iso);
  const mm = monthMetaFor(d.getMonth());
  const cardClasses = ['card', 'card--month', 'card--print-month'].concat(mm.dark ? ['card--dark'] : []).join(' ');
  return `
    <div class="${cardClasses}" style="background:${mm.color}; color:${mm.dark ? '#F2ECDD' : 'var(--text)'};">
      <div class="illo-panel illo-panel--month" style="background:${mm.panel};">Illustration</div>
      <div class="title-block">
        <div class="card-header">${escapeHtml(mm.name.toUpperCase())}</div>
        <div class="card-subtitle">${escapeHtml(mm.subtitle)}</div>
      </div>
      <div class="divider-h"></div>
      <div class="grid-header-row">${weekdayHeaderHtml('grid-header-cell')}</div>
      ${monthCardInnerCells(iso, false, false)}
      <div class="credit-line">A page from the desk calendar &middot; ${d.getFullYear()}</div>
    </div>`;
}

/* ---------- View renderers ---------- */

function renderDayView() {
  const iso = state.selectedISO;
  const d = parseISO(iso);
  const rangeLabel = WEEKDAY_SHORT[d.getDay()] + ', ' + MONTH_SHORT[d.getMonth()] + ' ' + d.getDate();
  return `
    <div style="width:min(94vw, 460px);">
      <div class="nav-row">
        <button class="icon-btn" data-action="dayNav" data-delta="-1">&larr;</button>
        <span class="nav-label">${escapeHtml(rangeLabel)}</span>
        <button class="icon-btn" data-action="dayNav" data-delta="1">&rarr;</button>
      </div>
      ${dayCardHtml(iso)}
    </div>`;
}

function renderMonthView() {
  const iso = state.selectedISO;
  const d = parseISO(iso);
  const mm = monthMetaFor(d.getMonth());
  const rangeLabel = mm.name + ' ' + d.getFullYear();
  const cardClasses = ['card', 'card--month'].concat(mm.dark ? ['card--dark'] : []).join(' ');
  return `
    <div style="width:min(96vw, 900px);">
      <div class="nav-row">
        <button class="icon-btn" data-action="monthNav" data-delta="-1">&larr;</button>
        <span class="nav-label">${escapeHtml(rangeLabel)}</span>
        <button class="icon-btn" data-action="monthNav" data-delta="1">&rarr;</button>
      </div>
      <div class="${cardClasses}" style="background:${mm.color}; color:${mm.dark ? '#F2ECDD' : 'var(--text)'};">
        <div class="month-body">
          <div class="month-side">
            <div>
              <div class="card-header">${escapeHtml(mm.name.toUpperCase())}</div>
              <div class="card-subtitle">${escapeHtml(mm.subtitle)}</div>
            </div>
          </div>
          <div class="divider-v"></div>
          <div class="month-grid-wrap">
            <div class="grid-header-row">${weekdayHeaderHtml('grid-header-cell')}</div>
            ${monthCardInnerCells(iso, false, true)}
          </div>
        </div>
      </div>
    </div>`;
}

function renderQuarterView() {
  const iso = state.selectedISO;
  const d = parseISO(iso);
  const rangeEndD = parseISO(addMonthsISO(iso, 2));
  const rangeLabel = MONTH_SHORT[d.getMonth()] + ' – ' + MONTH_SHORT[(d.getMonth() + 2) % 12] + ' ' + rangeEndD.getFullYear();
  const cardsHtml = [0, 1, 2].map(i => {
    const mIso = addMonthsISO(iso, i);
    const md = parseISO(mIso);
    const mm = monthMetaFor(md.getMonth());
    const cardClasses = ['quarter-card'].concat(mm.dark ? ['quarter-card--dark'] : []).join(' ');
    return `
      <div class="${cardClasses}" style="background:${mm.color}; color:${mm.dark ? '#F2ECDD' : 'var(--text)'};">
        <div class="illo-panel illo-panel--quarter" style="background:${mm.panel};"></div>
        <div class="quarter-header">${escapeHtml(mm.name.toUpperCase())}</div>
        <div class="quarter-subtitle">${escapeHtml(mm.subtitle)}</div>
        <div class="quarter-divider"></div>
        <div class="quarter-grid-header-row">${weekdayHeaderHtml('quarter-grid-header-cell')}</div>
        ${monthCardInnerCells(mIso, true, true)}
      </div>`;
  }).join('');
  return `
    <div style="width:100%; max-width:1100px;">
      <div class="nav-row">
        <button class="icon-btn" data-action="quarterNav" data-delta="-1">&larr;</button>
        <span class="nav-label">${escapeHtml(rangeLabel)}</span>
        <button class="icon-btn" data-action="quarterNav" data-delta="1">&rarr;</button>
      </div>
      <div class="quarter-wrap">${cardsHtml}</div>
    </div>`;
}

function renderListView() {
  const byDate = {};
  state.items.filter(it => it.date >= todayISO).forEach(it => {
    (byDate[it.date] = byDate[it.date] || []).push(it);
  });
  const dates = Object.keys(byDate).sort().slice(0, 60);
  const groupsHtml = dates.map(dISO => {
    const d = parseISO(dISO);
    const its = itemsForDate(dISO);
    const label = WEEKDAY_SHORT[d.getDay()] + ', ' + MONTH_SHORT[d.getMonth()] + ' ' + d.getDate();
    const rowsHtml = its.map(it => listItemRowHtml(it, { rowClass: 'list-row' })).join('');
    return `
      <div class="list-group">
        <div class="list-group-label">${escapeHtml(label)}</div>
        ${rowsHtml}
      </div>`;
  }).join('');
  return `<div style="width:min(94vw, 640px);">${groupsHtml}</div>`;
}

function printListSheetHtml() {
  const startISO = todayISO;
  const endISO = addDaysISO(startISO, 13);
  const byDate = {};
  state.items.filter(it => it.date >= startISO && it.date <= endISO).forEach(it => {
    (byDate[it.date] = byDate[it.date] || []).push(it);
  });
  const dates = Object.keys(byDate).sort();
  const sd = parseISO(startISO), ed = parseISO(endISO);
  const rangeLabel = MONTH_SHORT[sd.getMonth()] + ' ' + sd.getDate() + ' – ' + MONTH_SHORT[ed.getMonth()] + ' ' + ed.getDate();
  const groupsHtml = dates.map(dISO => {
    const d = parseISO(dISO);
    const its = itemsForDate(dISO);
    const label = WEEKDAY_SHORT[d.getDay()] + ', ' + MONTH_SHORT[d.getMonth()] + ' ' + d.getDate();
    const rowsHtml = its.map(it => listItemRowHtml(it, { rowClass: 'print-row', forPrint: true })).join('');
    return `
      <div class="print-group">
        <div class="print-date-header">${escapeHtml(label)}</div>
        ${rowsHtml}
      </div>`;
  }).join('');
  return `
    <div class="print-sheet">
      <div class="print-sheet-header">NEXT 14 DAYS</div>
      <div class="print-sheet-subtitle">${escapeHtml(rangeLabel)}</div>
      <div class="print-sheet-divider"></div>
      ${groupsHtml}
    </div>`;
}

function renderPrintView() {
  const target = state.printTarget;
  let bodyHtml = '';
  if (target && target.kind === 'list14') {
    bodyHtml = printListSheetHtml();
  } else if (target && target.kind === 'month') {
    bodyHtml = monthPrintCardHtml(target.iso);
  } else if (target) {
    bodyHtml = dayCardHtml(target.iso, { forPrint: true });
  }
  return `
    <div style="display:flex; flex-direction:column; align-items:center; gap:16px;">
      <div class="print-controls" data-no-print="true">
        <button class="icon-btn text-btn" data-action="closePrint">&larr; Back</button>
        <button class="btn-dark" data-action="doPrint">Print / Save PDF</button>
      </div>
      ${bodyHtml}
    </div>`;
}

function mainViewHtml() {
  switch (state.view) {
    case 'day': return renderDayView();
    case 'month': return renderMonthView();
    case 'quarter': return renderQuarterView();
    case 'list': return renderListView();
    case 'print': return renderPrintView();
    default: return '';
  }
}

/* ---------- Chrome & modals ---------- */

function topbarHtml() {
  const tabs = [['day', 'Day'], ['month', 'Month'], ['quarter', 'Quarter'], ['list', 'List']];
  const tabsHtml = tabs.map(([v, label]) => `<button class="tab ${state.view === v ? 'active' : ''}" data-action="tab" data-view="${v}">${label}</button>`).join('');
  return `
    <div class="topbar" data-no-print="true">
      <div class="tabs">${tabsHtml}</div>
      <div class="topbar-actions">
        <button class="btn-ghost" data-action="openPrintChooser">Print card</button>
        <button class="btn-dark" data-action="openAdd">+ Add</button>
      </div>
    </div>`;
}

function printChooserModalHtml() {
  if (!state.printChooserOpen) return '';
  const kind = state.printChooserKind;
  const needsDate = kind !== 'list14';
  const isList14 = kind === 'list14';
  return `
    <div class="modal-overlay" data-no-print="true" data-action="overlayClose" data-modal="printChooser">
      <div class="modal-box modal-box--sm" data-action="stop">
        <div class="modal-title">Choose a card to print</div>
        <div class="chooser-kind-row">
          <button class="type-btn ${kind === 'day' ? 'active' : ''}" data-action="setPrintKind" data-kind="day">Day card</button>
          <button class="type-btn ${kind === 'month' ? 'active' : ''}" data-action="setPrintKind" data-kind="month">Month card</button>
          <button class="type-btn ${kind === 'list14' ? 'active' : ''}" data-action="setPrintKind" data-kind="list14">14-day list</button>
        </div>
        ${needsDate ? `
        <label class="form-label">Date</label>
        <input type="date" class="form-input" data-bind="printChooserDate" value="${state.printChooserDate}">` : ''}
        ${isList14 ? `<div class="chooser-hint">Starting from today.</div>` : ''}
        <div class="modal-actions">
          <button class="btn-ghost" data-action="closePrintChooser">Cancel</button>
          <button class="btn-dark" data-action="confirmPrintChooser">Continue</button>
        </div>
      </div>
    </div>`;
}

function detailModalHtml() {
  if (!state.detailOpen) return '';
  if (state.editing && state.editDraft) {
    const d = state.editDraft;
    return `
      <div class="modal-overlay" data-no-print="true" data-action="overlayClose" data-modal="detail">
        <div class="modal-box" data-action="stop">
          <div class="modal-title">Edit item</div>
          <label class="form-label">Title</label>
          <input type="text" class="form-input" data-bind="editDraft.title" value="${escapeHtml(d.title)}">
          <div class="type-toggle">
            <button class="type-btn ${d.type === 'event' ? 'active' : ''}" data-action="setType" data-target="edit" data-type="event">Event</button>
            <button class="type-btn ${d.type === 'task' ? 'active' : ''}" data-action="setType" data-target="edit" data-type="task">Task</button>
          </div>
          <label class="form-label">Date</label>
          <input type="date" class="form-input" data-bind="editDraft.date" value="${d.date}">
          <label class="checkbox-row" data-action="toggleHasTime" data-target="edit">
            <input type="checkbox" ${d.hasTime ? 'checked' : ''} tabindex="-1">
            Has a specific start time
          </label>
          ${d.hasTime ? `
          <label class="form-label">Start time</label>
          <input type="time" class="form-input" data-bind="editDraft.startTime" value="${d.startTime}">` : ''}
          <label class="form-label">Duration (minutes)</label>
          <input type="number" class="form-input" data-bind="editDraft.duration" value="${d.duration}">
          <div class="modal-actions">
            <button class="btn-ghost" data-action="cancelEdit">Cancel</button>
            <button class="btn-dark" data-action="saveEdit">Save</button>
          </div>
        </div>
      </div>`;
  }
  const it = state.items.find(i => i.id === state.modalItemId);
  if (!it) return '';
  const d = parseISO(it.date);
  const dateLabel = WEEKDAY_SHORT[d.getDay()] + ', ' + MONTH_SHORT[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  const timeLabel = it.startTime ? to12h(it.startTime) : 'Anytime';
  const durLabel = fmtDuration(it.duration);
  return `
    <div class="modal-overlay" data-no-print="true" data-action="overlayClose" data-modal="detail">
      <div class="modal-box" data-action="stop">
        <div class="detail-type-row">
          <span class="item-dot" style="background:${dotColor(it.type)};"></span>
          <span class="detail-type-label">${it.type === 'event' ? 'Event' : 'Task'}</span>
        </div>
        <div class="detail-title">${escapeHtml(it.title)}</div>
        <div class="detail-meta">${escapeHtml(dateLabel)}</div>
        <div class="detail-meta detail-meta--gap">${escapeHtml(timeLabel)} &middot; ${escapeHtml(durLabel)}</div>
        ${it.notes ? `<div class="detail-notes">${escapeHtml(it.notes)}</div>` : ''}
        <div class="modal-actions">
          <button class="btn-danger" data-action="deleteItem">Delete</button>
          <button class="btn-ghost" data-action="startEdit">Edit</button>
          <button class="btn-dark" data-action="closeDetail">Close</button>
        </div>
      </div>
    </div>`;
}

function addModalHtml() {
  if (!state.addOpen) return '';
  const d = state.addDraft;
  return `
    <div class="modal-overlay" data-no-print="true" data-action="overlayClose" data-modal="add">
      <div class="modal-box" data-action="stop">
        <div class="modal-title">New item</div>
        <label class="form-label">Title</label>
        <input type="text" class="form-input" data-bind="addDraft.title" value="${escapeHtml(d.title)}" placeholder="e.g. Call the plumber">
        <div class="type-toggle">
          <button class="type-btn ${d.type === 'event' ? 'active' : ''}" data-action="setType" data-target="add" data-type="event">Event</button>
          <button class="type-btn ${d.type === 'task' ? 'active' : ''}" data-action="setType" data-target="add" data-type="task">Task</button>
        </div>
        <label class="form-label">Date</label>
        <input type="date" class="form-input" data-bind="addDraft.date" value="${d.date}">
        <label class="checkbox-row" data-action="toggleHasTime" data-target="add">
          <input type="checkbox" ${d.hasTime ? 'checked' : ''} tabindex="-1">
          Has a specific start time
        </label>
        ${d.hasTime ? `
        <label class="form-label">Start time</label>
        <input type="time" class="form-input" data-bind="addDraft.startTime" value="${d.startTime}">` : ''}
        <label class="form-label">Duration (minutes)</label>
        <input type="number" class="form-input" data-bind="addDraft.duration" value="${d.duration}">
        <div class="modal-actions">
          <button class="btn-ghost" data-action="closeAdd">Cancel</button>
          <button class="btn-dark" data-action="saveAdd">Add item</button>
        </div>
      </div>
    </div>`;
}

/* ---------- Master render ---------- */

function render() {
  const app = document.getElementById('app');
  app.innerHTML = topbarHtml() + `<div class="main">${mainViewHtml()}</div>` + printChooserModalHtml() + detailModalHtml() + addModalHtml();
  persist();
}

/* ---------- Action handlers ---------- */

function setView(v) { state.view = v; render(); }

function dayNav(delta) { state.selectedISO = addDaysISO(state.selectedISO, delta); render(); }
function monthNav(delta) { state.selectedISO = addMonthsISO(state.selectedISO, delta); render(); }
function quarterNav(delta) {
  const next = addMonthsISO(state.selectedISO, delta);
  const curBase = addMonthsISO(todayISO, 0);
  if (delta < 0 && next < curBase) return;
  state.selectedISO = next;
  render();
}
function jumpToDay(iso) { state.view = 'day'; state.selectedISO = iso; render(); }

function openDetail(id) { state.detailOpen = true; state.editing = false; state.modalItemId = id; render(); }
function closeDetail() { state.detailOpen = false; state.editing = false; state.modalItemId = null; render(); }

function startEdit() {
  const item = state.items.find(i => i.id === state.modalItemId);
  if (!item) return;
  state.editDraft = { title: item.title, type: item.type, date: item.date, hasTime: !!item.startTime, startTime: item.startTime || '09:00', duration: item.duration };
  state.editing = true;
  render();
}
function cancelEdit() { state.editing = false; render(); }
function saveEdit() {
  const id = state.modalItemId;
  const d = state.editDraft;
  state.items = state.items.map(it => it.id === id ? {
    ...it,
    title: (d.title && d.title.trim()) || it.title,
    type: d.type,
    date: d.date,
    startTime: d.hasTime ? d.startTime : null,
    duration: Number(d.duration) || it.duration
  } : it);
  state.editing = false;
  render();
}
function deleteItem() {
  const id = state.modalItemId;
  state.items = state.items.filter(it => it.id !== id);
  state.detailOpen = false;
  state.editing = false;
  state.modalItemId = null;
  render();
}

function openAdd() { state.addOpen = true; state.addDraft = freshDraft(state.selectedISO); render(); }
function closeAdd() { state.addOpen = false; render(); }
function saveAdd() {
  const d = state.addDraft;
  if (!d.title || !d.title.trim()) { state.addOpen = false; render(); return; }
  state.items.push({
    id: 'u-' + state.nextId,
    title: d.title.trim(),
    type: d.type,
    date: d.date,
    startTime: d.hasTime ? d.startTime : null,
    duration: Number(d.duration) || 30,
    notes: null
  });
  state.nextId += 1;
  state.addOpen = false;
  render();
}

function setType(target, type) {
  const draft = target === 'edit' ? state.editDraft : state.addDraft;
  if (!draft) return;
  draft.type = type;
  render();
}
function toggleHasTime(target) {
  const draft = target === 'edit' ? state.editDraft : state.addDraft;
  if (!draft) return;
  draft.hasTime = !draft.hasTime;
  render();
}

function openPrintChooser() { state.printChooserOpen = true; state.printChooserDate = state.selectedISO; render(); }
function closePrintChooser() { state.printChooserOpen = false; render(); }
function setPrintKind(kind) { state.printChooserKind = kind; render(); }
function confirmPrintChooser() {
  state.printChooserOpen = false;
  state.view = 'print';
  state.printTarget = { kind: state.printChooserKind, iso: state.printChooserDate };
  render();
}
function closePrint() { state.view = 'day'; render(); }

function closeModal(modal) {
  if (modal === 'printChooser') closePrintChooser();
  else if (modal === 'detail') closeDetail();
  else if (modal === 'add') closeAdd();
}

/* ---------- Event delegation ---------- */

function setByPath(path, value) {
  const parts = path.split('.');
  if (parts.length === 1) state[parts[0]] = value;
  else state[parts[0]][parts[1]] = value;
}

function onClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  switch (action) {
    case 'tab': setView(el.dataset.view); break;
    case 'openPrintChooser': openPrintChooser(); break;
    case 'openAdd': openAdd(); break;
    case 'dayNav': dayNav(Number(el.dataset.delta)); break;
    case 'monthNav': monthNav(Number(el.dataset.delta)); break;
    case 'quarterNav': quarterNav(Number(el.dataset.delta)); break;
    case 'jumpDay': jumpToDay(el.dataset.iso); break;
    case 'openDetail': openDetail(el.dataset.id); break;
    case 'closeDetail': closeDetail(); break;
    case 'startEdit': startEdit(); break;
    case 'cancelEdit': cancelEdit(); break;
    case 'saveEdit': saveEdit(); break;
    case 'deleteItem': deleteItem(); break;
    case 'closeAdd': closeAdd(); break;
    case 'saveAdd': saveAdd(); break;
    case 'setType': setType(el.dataset.target, el.dataset.type); break;
    case 'toggleHasTime': toggleHasTime(el.dataset.target); break;
    case 'closePrintChooser': closePrintChooser(); break;
    case 'setPrintKind': setPrintKind(el.dataset.kind); break;
    case 'confirmPrintChooser': confirmPrintChooser(); break;
    case 'closePrint': closePrint(); break;
    case 'doPrint': window.print(); break;
    case 'overlayClose': closeModal(el.dataset.modal); break;
    case 'stop': break;
  }
}

function onFieldChange(e) {
  const bind = e.target.dataset.bind;
  if (!bind) return;
  setByPath(bind, e.target.value);
}

document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  app.addEventListener('click', onClick);
  app.addEventListener('input', onFieldChange);
  app.addEventListener('change', onFieldChange);
  render();
});
