/* Final script.js - adds Table View + Export (CSV/XLSX) + uses selected headers for both views */
/* Requires XLSX (sheetjs) which is already included in HTML head */

let workbook, sheetData = [], headers = [], currentIndex = 0;
let matches = [], matchIndex = 0;
let visibleHeaders = JSON.parse(localStorage.getItem('visibleHeaders') || 'null') || [];

// Elements
const fileInput = document.getElementById('fileInput');
const sheetSelector = document.getElementById('sheetSelector');
const sheetSelectorContainer = document.getElementById('sheetSelectorContainer');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const goBtn = document.getElementById('goBtn');
const filterBtn = document.getElementById('filterBtn');
const searchIndexInput = document.getElementById('searchIndex');
const filterColumnSelect = document.getElementById('filterColumn');
const filterValueInput = document.getElementById('filterValue');
const recordViewer = document.getElementById('recordViewer');
const tableViewContainer = document.getElementById('tableViewContainer');
const filterInfoDiv = document.getElementById('filterInfo');
const matchInfoDiv = document.getElementById('matchInfo');

const selectFieldsBtn = document.getElementById('selectFieldsBtn');
const headerModal = document.getElementById('headerModal');
const headerOptions = document.getElementById('headerOptions');
const selectAllBtn = document.getElementById('selectAllBtn');
const unselectAllBtn = document.getElementById('unselectAllBtn');
const closeModalBtn = document.getElementById('closeModalBtn');

const toggleTableBtn = document.getElementById('toggleTableBtn');
const exportBtn = document.getElementById('exportBtn');
const installBtn = document.getElementById('installBtn');

// focusable body for keyboard navigation
if (!document.body.hasAttribute('tabindex')) document.body.setAttribute('tabindex', '-1');

// view mode state: 'form' or 'table'
let viewMode = localStorage.getItem('viewMode') || 'form';

// UI initial state
disableUI(true);

// Event listeners
fileInput.addEventListener('change', handleFile);
prevBtn.addEventListener('click', () => navigateRelative(-1));
nextBtn.addEventListener('click', () => navigateRelative(1));
goBtn.addEventListener('click', goToRecord);
filterBtn.addEventListener('click', filterRecords);
sheetSelector.addEventListener('change', () => loadSheet(sheetSelector.value));

searchIndexInput.addEventListener('keydown', e => { if (e.key === 'Enter') goToRecord(); });
filterValueInput.addEventListener('keydown', e => { if (e.key === 'Enter') filterRecords(); });

// field selector modal
selectFieldsBtn.addEventListener('click', openHeaderModal);
closeModalBtn.addEventListener('click', () => { headerModal.style.display = 'none'; headerModal.setAttribute('aria-hidden','true'); });
selectAllBtn.addEventListener('click', () => { visibleHeaders = [...headers]; saveVisibleHeaders(); renderHeaderOptions(); showCurrentView(); });
unselectAllBtn.addEventListener('click', () => { visibleHeaders = []; saveVisibleHeaders(); renderHeaderOptions(); showCurrentView(); });
window.addEventListener('click', (e) => { if (e.target === headerModal) { headerModal.style.display = 'none'; headerModal.setAttribute('aria-hidden','true'); }});

// toggle table view
toggleTableBtn.addEventListener('click', () => {
  viewMode = (viewMode === 'form') ? 'table' : 'form';
  localStorage.setItem('viewMode', viewMode);
  updateViewButtons();
  showCurrentView();
});

// export
exportBtn.addEventListener('click', () => {
  showExportMenu();
});

// PWA install (kept from earlier)
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.style.display = 'inline-block';
});
installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  if (choice.outcome === 'accepted') {
    installBtn.textContent = '✅ Installed';
    installBtn.disabled = true;
  }
  deferredPrompt = null;
});
window.addEventListener('appinstalled', () => {
  installBtn.textContent = '✅ Installed'; installBtn.disabled = true;
});

// keyboard nav
document.addEventListener('keydown', (e) => {
  const tag = e.target && e.target.tagName && e.target.tagName.toUpperCase();
  if (!sheetData || sheetData.length === 0) return;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.ctrlKey || e.metaKey) return;

  if (e.key === 'ArrowRight') { e.preventDefault(); if (matches && matches.length) { if (matchIndex < matches.length -1) { matchIndex++; showRecord(matches[matchIndex]); updateMatchInfo(true); } } else { if (currentIndex < sheetData.length -1) showRecord(currentIndex+1); } }
  if (e.key === 'ArrowLeft') { e.preventDefault(); if (matches && matches.length) { if (matchIndex > 0) { matchIndex--; showRecord(matches[matchIndex]); updateMatchInfo(true); } } else { if (currentIndex > 0) showRecord(currentIndex-1); } }
});

// click expand in form view (delegation)
recordViewer.addEventListener('click', (e) => {
  if (e.target.classList.contains('expand-btn')) {
    const field = e.target.closest('.field');
    const fv = field.querySelector('.field-value');
    const full = field.querySelector('.full-text').textContent;
    if (e.target.textContent === 'Expand') { fv.textContent = full; e.target.textContent = 'Collapse'; } else { fv.textContent = full.slice(0,60) + '...'; e.target.textContent = 'Expand'; }
  }
});

// table row click -> open form view
tableViewContainer.addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-row-index]');
  if (!tr) return;
  const idx = parseInt(tr.dataset.rowIndex,10);
  if (!isNaN(idx)) { viewMode = 'form'; localStorage.setItem('viewMode', viewMode); updateViewButtons(); showRecord(idx); }
});

/* ---------- Helpers: storage ---------- */
function saveVisibleHeaders(){ try { localStorage.setItem('visibleHeaders', JSON.stringify(visibleHeaders)); } catch(e){} }
function loadVisibleHeaders(){ try { const v = JSON.parse(localStorage.getItem('visibleHeaders')); return Array.isArray(v) ? v : null; } catch(e){ return null; } }

/* ---------- File handling ---------- */
function handleFile(e){
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = new Uint8Array(ev.target.result);
      workbook = XLSX.read(data, { type: 'array' });
    } catch(err) { showEmptyMessage('Unable to read file.'); return; }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) { showEmptyMessage('No sheets found in file.'); return; }

    // sheet selector
    sheetSelector.innerHTML = ''; workbook.SheetNames.forEach(name => { const opt = document.createElement('option'); opt.value = name; opt.textContent = name; sheetSelector.appendChild(opt); });
    sheetSelectorContainer.style.display = workbook.SheetNames.length > 1 ? 'block' : 'none';

    loadSheet(workbook.SheetNames[0]);
    disableUI(false);
    try { document.body.focus(); } catch(e){}
    syncUI();
  };
  reader.readAsArrayBuffer(file);
}

function loadSheet(name){
  const sheet = workbook.Sheets[name];
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, cellDates: true, dateNF: "dd-mm-yyyy" });
  
  if (!Array.isArray(json) || json.length === 0 || (Array.isArray(json[0]) && json[0].length === 0)) {
    headers = []; sheetData = []; showEmptyMessage('No data in this sheet.'); disableUI(true); syncUI(); return;
  }

  headers = json[0].map(h => h == null ? '' : String(h));
  // sheetData = json.slice(1).map(r => Array.isArray(r) ? r : []);

sheetData = json.slice(1).map(row =>
  (Array.isArray(row) ? row : []).map(cell => {
    if (cell instanceof Date) {
      // Format pure Date objects
      const d = cell;
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    }

    // Handle numbers that are Excel date serials
    if (typeof cell === "number" && cell > 20000 && cell < 60000) {
      const excelEpoch = new Date(1899, 11, 30);
      const parsed = new Date(excelEpoch.getTime() + Math.floor(cell) * 86400000);
      const dd = String(parsed.getDate()).padStart(2, "0");
      const mm = String(parsed.getMonth() + 1).padStart(2, "0");
      const yyyy = parsed.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    }

    // Replace slashes (1/7/19 → 01-07-2019) if string looks like a date
    if (typeof cell === "string" && /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(cell.trim())) {
      const [d, m, y] = cell.split("/");
      const dd = String(d).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      const yyyy = y.length === 2 ? "20" + y : y;
      return `${dd}-${mm}-${yyyy}`;
    }

    // Otherwise, return as-is
    return cell ?? "";
  })
);

  currentIndex = 0; matches = []; matchIndex = 0;

  // visible headers preference
  const saved = loadVisibleHeaders();
  if (saved && Array.isArray(saved)) {
    // keep intersection
    visibleHeaders = saved.filter(h => headers.includes(h));
    if (visibleHeaders.length === 0) visibleHeaders = headers.slice();
  } else {
    visibleHeaders = headers.slice();
  }

  populateFilterDropdown();
  renderHeaderOptions();
  updateViewButtons();
  showCurrentView();
  syncUI();
}

/* ---------- UI helpers ---------- */
function disableUI(disabled){
  [prevBtn,nextBtn,goBtn,filterBtn,searchIndexInput,filterColumnSelect,filterValueInput].forEach(el => el.disabled = disabled);
  toggleTableBtn.style.display = disabled ? 'none' : 'inline-block';
  exportBtn.style.display = disabled ? 'none' : 'inline-block';
}

function showEmptyMessage(msg){
  recordViewer.style.display = 'block';
  tableViewContainer.style.display = 'none';
  recordViewer.className = 'card';
  recordViewer.innerHTML = '';
  const box = document.createElement('div'); box.className = 'no-record'; box.textContent = msg; recordViewer.appendChild(box);
  matchInfoDiv.style.display = 'none'; filterInfoDiv.style.display = 'none';
}

/* ---------- Filters ---------- */
function populateFilterDropdown(){
  filterColumnSelect.innerHTML = '';
  headers.forEach((h,i) => {
    const opt = document.createElement('option'); opt.value = i; opt.textContent = h || `Column ${i+1}`; filterColumnSelect.appendChild(opt);
  });
}

/* ---------- Field selector modal ---------- */
function openHeaderModal(){
  renderHeaderOptions();
  headerModal.style.display = 'flex';
  headerModal.setAttribute('aria-hidden','false');
}

function renderHeaderOptions(){
  headerOptions.innerHTML = '';
  if (!headers || !headers.length) { headerOptions.textContent = 'No headers found.'; return; }
  headers.forEach((h) => {
    const div = document.createElement('div');
    const cb = document.createElement('input'); cb.type='checkbox'; cb.value = h; cb.checked = visibleHeaders.includes(h);
    cb.addEventListener('change', (e) => {
      if (e.target.checked) { if (!visibleHeaders.includes(h)) visibleHeaders.push(h); }
      else { visibleHeaders = visibleHeaders.filter(x=>x!==h); }
      saveVisibleHeaders(); showCurrentView();
    });
    const label = document.createElement('label'); label.style.marginLeft='6px'; label.textContent = h;
    div.appendChild(cb); div.appendChild(label); headerOptions.appendChild(div);
  });
}

/* ---------- Rendering Form View ---------- */
function showRecord(index){
  if (!sheetData || sheetData.length === 0) { showEmptyMessage('0 records.'); return; }
  if (index < 0) index = 0;
  if (index >= sheetData.length) index = sheetData.length - 1;
  currentIndex = index;

  viewMode = 'form'; localStorage.setItem('viewMode', viewMode);
  updateViewButtons();

  // recordViewer.style.display = 'block';
  tableViewContainer.style.display = 'none';
  recordViewer.className = 'card form-view';
  recordViewer.innerHTML = '';

  const headerDiv = document.createElement('div');
  headerDiv.style.gridColumn = '1 / -1';
  headerDiv.style.marginBottom = '6px';
  headerDiv.style.fontWeight = '600';
  headerDiv.textContent = `Record ${currentIndex + 1} of ${sheetData.length}`;
  recordViewer.appendChild(headerDiv);

  const record = sheetData[currentIndex];
  const fieldsToRender = (visibleHeaders && visibleHeaders.length) ? visibleHeaders : headers;

  fieldsToRender.forEach(h => {
    const i = headers.indexOf(h);
    if (i === -1) return;
    const value = record[i] != null ? String(record[i]) : '';
    const fieldDiv = document.createElement('div'); fieldDiv.className = 'field';
    const labelSpan = document.createElement('span'); labelSpan.className = 'label'; labelSpan.textContent = h + ':';
    const fieldValue = document.createElement('span'); fieldValue.className = 'field-value';
    const fullText = document.createElement('span'); fullText.className='full-text'; fullText.style.display='none'; fullText.textContent = value;
    const maxLength = 80;
    if (value.length > maxLength) { fieldValue.textContent = value.slice(0,maxLength) + '...'; const exp = document.createElement('button'); exp.className='expand-btn'; exp.type='button'; exp.textContent='Expand'; fieldDiv.append(labelSpan, fieldValue, exp, fullText); }
    else { fieldValue.textContent = value; fieldDiv.append(labelSpan, fieldValue); }
    recordViewer.appendChild(fieldDiv);
  });

  updateNavButtons();
  updateMatchInfo();
  syncUI();
}

/* ---------- Rendering Table View ---------- */
function renderTableView(){
  tableViewContainer.innerHTML = '';
  tableViewContainer.style.display = 'block';
  recordViewer.style.display = 'none';

  if (!sheetData || sheetData.length === 0) { const box = document.createElement('div'); box.className='no-record'; box.textContent='No records to show.'; tableViewContainer.appendChild(box); return; }

  const fieldsToRender = (visibleHeaders && visibleHeaders.length) ? visibleHeaders : headers;

  const table = document.createElement('table'); table.className='table';
  const thead = document.createElement('thead'); const trHead = document.createElement('tr');
  fieldsToRender.forEach(h => {
    const th = document.createElement('th'); th.textContent = h; th.style.userSelect='none';
    // optional: sort on click
    th.addEventListener('click', () => sortByColumn(h));
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  // If matches exist (filter), show only matched rows, otherwise show all rows
  const rowsToShow = (matches && matches.length) ? matches.map(i=>sheetData[i]) : sheetData;
  const rowIndexes = (matches && matches.length) ? matches.slice() : sheetData.map((_,i)=>i);

  rowsToShow.forEach((row, idx) => {
    const tr = document.createElement('tr');
    tr.dataset.rowIndex = rowIndexes[idx]; // store original index so clicking opens that record
    fieldsToRender.forEach(h => {
      const colIndex = headers.indexOf(h);
      const td = document.createElement('td'); td.textContent = (colIndex > -1 && row[colIndex] != null) ? String(row[colIndex]) : '';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  tableViewContainer.appendChild(table);

  // update match info visibility
  if (matches && matches.length) { matchInfoDiv.style.display='block'; matchInfoDiv.textContent = `Found ${matches.length} matches. Showing ${matchIndex+1} of ${matches.length}.`; }
  else { matchInfoDiv.style.display='none'; }
}

/* ---------- Sorting used in table view ---------- */
function sortByColumn(headerName){
  const colIndex = headers.indexOf(headerName);
  if (colIndex === -1) return;
  const lastSort = tableViewContainer.dataset.lastSort || '';
  let dir = 'asc';
  if (lastSort === headerName) dir = tableViewContainer.dataset.lastDir === 'asc' ? 'desc' : 'asc';
  tableViewContainer.dataset.lastSort = headerName; tableViewContainer.dataset.lastDir = dir;

  sheetData.sort((a,b) => {
    const va = a[colIndex] != null ? a[colIndex] : '';
    const vb = b[colIndex] != null ? b[colIndex] : '';
    const na = parseFloat(String(va).replace(/[^0-9.\-]/g,'')), nb = parseFloat(String(vb).replace(/[^0-9.\-]/g,''));
    if (!isNaN(na) && !isNaN(nb)) return dir === 'asc' ? na - nb : nb - na;
    const sa = String(va).toLowerCase(), sb = String(vb).toLowerCase();
    if (sa < sb) return dir === 'asc' ? -1 : 1;
    if (sa > sb) return dir === 'asc' ? 1 : -1;
    return 0;
  });

  renderTableView();
}

/* ---------- Navigation & filters ---------- */
function navigateRelative(delta){
  if (matches && matches.length) {
    matchIndex = Math.max(0, Math.min(matches.length-1, matchIndex + (delta>0?1:-1)));
    showRecord(matches[matchIndex]);
    updateMatchInfo(true);
  } else {
    showRecord(currentIndex + delta);
  }
}

function updateNavButtons(){
  if (matches && matches.length) { prevBtn.disabled = matchIndex <= 0; nextBtn.disabled = matchIndex >= matches.length -1; }
  else { prevBtn.disabled = currentIndex <= 0; nextBtn.disabled = currentIndex >= sheetData.length -1; }
}

function goToRecord(){
  const i = parseInt(searchIndexInput.value, 10);
  if (!isNaN(i) && i > 0 && i <= sheetData.length) showRecord(i-1);
  else alert('Invalid row number.');
}

function filterRecords(){
  if (!sheetData || sheetData.length === 0) { alert('No data loaded.'); return; }
  const colIndex = parseInt(filterColumnSelect.value,10);
  const raw = String(filterValueInput.value || '');
  const searchValue = raw.trim().toLowerCase().replace(/\s+/g,' ');
  if (!searchValue) { alert('Please enter a value to search.'); return; }

  matches = [];
  sheetData.forEach((row, idx) => {
    const cell = (row[colIndex] ?? '').toString().toLowerCase().replace(/\s+/g,' ');
    if (cell.includes(searchValue)) matches.push(idx);
  });

  if (!matches.length) { alert('No matching records found.'); return; }
  matchIndex = 0;
  showRecord(matches[matchIndex]);

  filterInfoDiv.style.display = 'block'; filterInfoDiv.textContent = `Filter: ${headers[colIndex]} contains "${raw}"`;
  updateMatchInfo(true); syncUI();
}

function updateMatchInfo(showClear=false){
  if (!matches || matches.length === 0) { matchInfoDiv.style.display='none'; return; }
  matchInfoDiv.style.display='block';
  matchInfoDiv.textContent = `Found ${matches.length} match(es). Showing ${matchIndex+1} of ${matches.length} (out of ${sheetData.length})`;
  if (showClear) {
    // could add clear controls here if desired
  }
}

/* ---------- UI sync ---------- */
function syncUI(){
  const hasData = sheetData && sheetData.length > 0;
  goBtn.disabled = !hasData;
  filterBtn.disabled = !hasData;
  searchIndexInput.disabled = !hasData;
  filterColumnSelect.disabled = !hasData;
  filterValueInput.disabled = !hasData;
  toggleTableBtn.style.display = hasData ? 'inline-block' : 'none';
  exportBtn.style.display = hasData ? 'inline-block' : 'none';
  updateNavButtons();
  try { document.body.focus(); } catch(e){}
}

/* ---------- Show current view based on viewMode ---------- */
function showCurrentView(){
  if (viewMode === 'table') { updateViewButtons(); renderTableView(); }
  else { updateViewButtons(); showRecord(currentIndex); }
}

function updateViewButtons(){
  if (viewMode === 'table') {
    toggleTableBtn.textContent = 'Show Form';
    tableViewContainer.style.display = 'block';
    recordViewer.style.display = 'none';

    // Disable both buttons
    prevBtn.disabled = true;
    nextBtn.disabled = true;
  } else {
    toggleTableBtn.textContent = 'Show Table';
    tableViewContainer.style.display = 'none';
    recordViewer.style.removeProperty('display');
    //recordViewer.style.display = 'block';
    // Disable both buttons
    prevBtn.disabled = false;
    nextBtn.disabled = false;
  }
}

/* ---------- Export (CSV/XLSX) ---------- */
function showExportMenu(){
  exportVisibleXLSX();
}

function getDisplayedRowsAndHeaders(){
  const cols = (visibleHeaders && visibleHeaders.length) ? visibleHeaders : headers;
  const rowIndexes = (matches && matches.length) ? matches.slice() : sheetData.map((_,i) => i);
  const rows = rowIndexes.map(i => sheetData[i].map(cell => cell != null ? String(cell) : ''));
  return { cols, rowIndexes, rows };
}

function exportVisibleCSV(){
  const { cols, rowIndexes } = getDisplayedRowsAndHeaders();
  // build CSV rows for visible columns only
  const lines = [];
  lines.push(cols.map(c => `"${c.replace(/"/g,'""')}"`).join(','));
  rowIndexes.forEach(i => {
    const row = sheetData[i];
    const vals = cols.map(h => {
      const idx = headers.indexOf(h);
      const v = (idx > -1 && row[idx] != null) ? String(row[idx]) : '';
      return `"${v.replace(/"/g,'""')}"`;
    });
    lines.push(vals.join(','));
  });
  const csv = lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'export.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function exportVisibleXLSX(){
  const { cols, rowIndexes } = getDisplayedRowsAndHeaders();
  const aoa = [];
  aoa.push(cols);
  rowIndexes.forEach(i => {
    const row = sheetData[i];
    const out = cols.map(h => {
      const idx = headers.indexOf(h);
      return (idx > -1 && row[idx] != null) ? row[idx] : '';
    });
    aoa.push(out);
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Export');
  const wbout = XLSX.write(wb, { bookType:'xlsx', type:'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'export.xlsx'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

/* ---------- Init (no-op until load) ---------- */
function init(){ updateViewButtons(); syncUI(); }
init();