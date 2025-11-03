/* script.js — corrected & synced UI + immediate arrow-key navigation */

let workbook, sheetData = [], headers = [], currentIndex = 0;
let matches = [], matchIndex = 0;

const fileInput = document.getElementById('fileInput');
const sheetSelector = document.createElement('select');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const goBtn = document.getElementById('goBtn');
const filterBtn = document.getElementById('filterBtn');
const searchIndexInput = document.getElementById('searchIndex');
const filterColumnSelect = document.getElementById('filterColumn');
const filterValueInput = document.getElementById('filterValue');
const recordViewer = document.getElementById('recordViewer');
const container = document.querySelector('.container');


let visibleHeaders = JSON.parse(localStorage.getItem("visibleHeaders")) || [];

// Modal elements
const selectFieldsBtn = document.getElementById("selectFieldsBtn");
const headerModal = document.getElementById("headerModal");
const headerOptions = document.getElementById("headerOptions");
const selectAllBtn = document.getElementById("selectAllBtn");
const unselectAllBtn = document.getElementById("unselectAllBtn");
const closeModalBtn = document.getElementById("closeModalBtn");


sheetSelector.id = 'sheetSelector';
sheetSelector.style.marginBottom = '10px';
sheetSelector.style.display = 'none';
container.insertBefore(sheetSelector, container.querySelector('hr'));

// make body programmatically focusable so we can reliably focus it
if (!document.body.hasAttribute('tabindex')) {
  document.body.setAttribute('tabindex', '-1');
}

disableUI(true);

// Event listeners
fileInput.addEventListener('change', handleFile);
prevBtn.addEventListener('click', () => showRecord(currentIndex - 1));
nextBtn.addEventListener('click', () => showRecord(currentIndex + 1));
goBtn.addEventListener('click', goToRecord);
filterBtn.addEventListener('click', filterRecords);
sheetSelector.addEventListener('change', () => loadSheet(sheetSelector.value));

searchIndexInput.addEventListener('keydown', e => { if (e.key === 'Enter') goToRecord(); });
filterValueInput.addEventListener('keydown', e => { if (e.key === 'Enter') filterRecords(); });

recordViewer.addEventListener('click', e => {
  if (e.target.classList.contains('expand-btn')) {
    const field = e.target.closest('.field');
    const fieldValue = field.querySelector('.field-value');
    const fullText = field.querySelector('.full-text').textContent;

    if (e.target.textContent === 'Expand') {
      fieldValue.textContent = fullText;
      e.target.textContent = 'Collapse';
    } else {
      fieldValue.textContent = fullText.slice(0, 60) + '...';
      e.target.textContent = 'Expand';
    }
  }
});

function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const data = new Uint8Array(event.target.result);
    workbook = XLSX.read(data, { type: 'array' });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      showEmptyMessage("No sheets found in file.");
      return;
    }

    // Populate sheet selector if multiple sheets
    sheetSelector.innerHTML = '';
    workbook.SheetNames.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sheetSelector.appendChild(opt);
    });

    sheetSelector.style.display = workbook.SheetNames.length > 1 ? 'inline-block' : 'none';

    // Load first sheet
    loadSheet(workbook.SheetNames[0]);
    disableUI(false);

    // ensure body is focused so keyboard navigation works immediately
    try { document.body.focus(); } catch (err) { /* ignore */ }

    // final UI sync
    syncUI();
  };
  reader.readAsArrayBuffer(file);
}

function loadSheet(name) {
  const sheet = workbook.Sheets[name];
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (!Array.isArray(json) || json.length === 0 || (Array.isArray(json[0]) && json[0].length === 0)) {
    headers = [];
    sheetData = [];
    showEmptyMessage("No records found in this sheet.");
    disableUI(true);
    syncUI();
    return;
  }

  headers = json[0].map(h => h == null ? '' : String(h));

  if (!visibleHeaders.length) visibleHeaders = [...headers];
renderHeaderOptions();

  sheetData = json.slice(1).map(r => Array.isArray(r) ? r : []);
  currentIndex = 0;
  matches = [];
  matchIndex = 0;

  populateFilterDropdown();
  showRecord(currentIndex);

  // ensure body is focused so arrow keys work immediately
  try { document.body.focus(); } catch (err) { /* ignore */ }

  syncUI();
}

function populateFilterDropdown() {
  filterColumnSelect.innerHTML = '';
  headers.forEach((h, i) => {

    
    // your existing code for displaying field
 

    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = h || `Column ${i + 1}`;
    filterColumnSelect.appendChild(opt);

  });
}

function showRecord(index) {
  // clamp index
  if (!sheetData || sheetData.length === 0) {
    showEmptyMessage("No records.");
    return;
  }
  if (index < 0) index = 0;
  if (index >= sheetData.length) index = sheetData.length - 1;

  currentIndex = index;
  const record = sheetData[currentIndex];

  // render record safely using DOM methods
  recordViewer.innerHTML = '';
  recordViewer.classList.remove('empty-message');

  const headerDiv = document.createElement('div');
  headerDiv.textContent = `Record ${currentIndex + 1} of ${sheetData.length}`;
  headerDiv.style.gridColumn = '1 / -1';
  headerDiv.style.marginBottom = '6px';
  headerDiv.style.fontWeight = '600';
  recordViewer.appendChild(headerDiv);

  headers.forEach((header, i) => {
    if (visibleHeaders.includes(header)) {
          
      const value = record[i] != null ? String(record[i]) : '';
      const fieldDiv = document.createElement('div');
      fieldDiv.className = 'field';

      const labelSpan = document.createElement('span');
      labelSpan.className = 'label';
      labelSpan.textContent = header + ':';

      const fieldValue = document.createElement('span');
      fieldValue.className = 'field-value';

      const fullTextSpan = document.createElement('span');
      fullTextSpan.className = 'full-text';
      fullTextSpan.style.display = 'none';
      fullTextSpan.textContent = value;

      const maxLength = 60;
      if (value.length > maxLength) {
        fieldValue.textContent = value.slice(0, maxLength) + '...';
        const expandBtn = document.createElement('button');
        expandBtn.className = 'expand-btn';
        expandBtn.type = 'button';
        expandBtn.textContent = 'Expand';
        fieldDiv.append(labelSpan, fieldValue, expandBtn, fullTextSpan);
      } else {
        fieldValue.textContent = value;
        fieldDiv.append(labelSpan, fieldValue);
      }

      recordViewer.appendChild(fieldDiv);
    }
  });

  // update UI
  updateNavButtons();
  updateMatchInfo();
  syncUI();
}

function updateNavButtons() {
  // If a filter is active we may want different behavior, but keep basic logic for raw prev/next
  prevBtn.disabled = (currentIndex <= 0);
  nextBtn.disabled = (currentIndex >= sheetData.length - 1);
}

function disableUI(disabled) {
  prevBtn.disabled = disabled;
  nextBtn.disabled = disabled;
  goBtn.disabled = disabled;
  filterBtn.disabled = disabled;
  searchIndexInput.disabled = disabled;
  filterColumnSelect.disabled = disabled;
  filterValueInput.disabled = disabled;
}

function goToRecord() {
  const i = parseInt(searchIndexInput.value, 10);
  if (!isNaN(i) && i > 0 && i <= sheetData.length) {
    showRecord(i - 1);
  } else {
    alert("Invalid row number.");
  }
}

function filterRecords() {
  if (!sheetData || sheetData.length === 0) {
    alert("No data loaded.");
    return;
  }

  const colIndex = parseInt(filterColumnSelect.value, 10);
  const raw = String(filterValueInput.value || '');
  const searchValue = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!searchValue) {
    alert("Please enter a value to search.");
    return;
  }

  matches = [];
  sheetData.forEach((row, idx) => {
    const cell = (row[colIndex] ?? '').toString().toLowerCase().replace(/\s+/g, ' ');
    if (cell.includes(searchValue)) matches.push(idx);
  });

  if (matches.length === 0) {
    alert("No matching records found.");
    return;
  }

  matchIndex = 0;
  showRecord(matches[matchIndex]);
  updateMatchInfo(true);
  syncUI();
}

function updateMatchInfo(showClear = false) {
  let infoDiv = document.getElementById('matchInfo');
  if (!infoDiv) {
    infoDiv = document.createElement('div');
    infoDiv.id = 'matchInfo';
    infoDiv.style.marginTop = '8px';
    container.insertBefore(infoDiv, recordViewer);
  }

  if (matches.length > 0) {
    // build text safely with DOM
    infoDiv.innerHTML = ''; // clear
    const text = document.createElement('span');
    text.textContent = `Found ${matches.length} match(es). Showing ${matchIndex + 1} of ${matches.length} (Row ${matches[matchIndex] + 1})`;
    infoDiv.appendChild(text);

    if (showClear) {
      const prevMatchBtn = document.createElement('button');
      prevMatchBtn.id = 'prevMatchBtn';
      prevMatchBtn.type = 'button';
      prevMatchBtn.textContent = 'Prev Match';
      prevMatchBtn.style.marginLeft = '10px';
      prevMatchBtn.addEventListener('click', () => {
        if (matchIndex > 0) matchIndex--;
        showRecord(matches[matchIndex]);
        updateMatchInfo(true);
      });

      const nextMatchBtn = document.createElement('button');
      nextMatchBtn.id = 'nextMatchBtn';
      nextMatchBtn.type = 'button';
      nextMatchBtn.textContent = 'Next Match';
      nextMatchBtn.style.marginLeft = '8px';
      nextMatchBtn.addEventListener('click', () => {
        if (matchIndex < matches.length - 1) matchIndex++;
        showRecord(matches[matchIndex]);
        updateMatchInfo(true);
      });

      const clearBtn = document.createElement('button');
      clearBtn.id = 'clearFilterBtn';
      clearBtn.type = 'button';
      clearBtn.textContent = 'Clear Filter';
      clearBtn.style.marginLeft = '8px';
      clearBtn.addEventListener('click', () => {
        matches = [];
        matchIndex = 0;
        filterValueInput.value = '';
        showRecord(currentIndex);
        updateMatchInfo();
        syncUI();
      });

      infoDiv.appendChild(prevMatchBtn);
      infoDiv.appendChild(nextMatchBtn);
      infoDiv.appendChild(clearBtn);
    }
  } else {
    infoDiv.textContent = '';
  }
}

function showEmptyMessage(msg) {
  recordViewer.className = 'card';
  recordViewer.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'no-record';
  box.textContent = msg;
  recordViewer.appendChild(box);
}

/* syncUI: central function to ensure nav buttons, filter UI, and focus are consistent */
function syncUI() {
  // update nav buttons considering active filter matches
  if (matches && matches.length > 0) {
    prevBtn.disabled = (matchIndex <= 0);
    nextBtn.disabled = (matchIndex >= matches.length - 1);
  } else {
    prevBtn.disabled = (currentIndex <= 0);
    nextBtn.disabled = (currentIndex >= sheetData.length - 1);
  }

  // ensure controls enabled when data present
  const hasData = (sheetData && sheetData.length > 0);
  goBtn.disabled = !hasData;
  filterBtn.disabled = !hasData;
  searchIndexInput.disabled = !hasData;
  filterColumnSelect.disabled = !hasData;
  filterValueInput.disabled = !hasData;

  // make sure arrow keys will work: focus the body (body is set tabindex="-1" above)
  try { document.body.focus(); } catch (err) { /* ignore */ }
}

// ✅ Keyboard navigation: works immediately after file/sheet load
document.addEventListener('keydown', (event) => {
  // don't interfere when user types in inputs or textareas or selects
  const tag = event.target && event.target.tagName && event.target.tagName.toUpperCase();
  if (!sheetData || sheetData.length === 0) return;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.ctrlKey || event.metaKey) return;

  if (event.key === 'ArrowRight') {
    event.preventDefault();
    // if filter active, navigate matches
    if (matches && matches.length > 0) {
      if (matchIndex < matches.length - 1) {
        matchIndex++;
        showRecord(matches[matchIndex]);
        updateMatchInfo(true);
      }
    } else {
      if (currentIndex < sheetData.length - 1) {
        showRecord(currentIndex + 1);
      }
    }
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    if (matches && matches.length > 0) {
      if (matchIndex > 0) {
        matchIndex--;
        showRecord(matches[matchIndex]);
        updateMatchInfo(true);
      }
    } else {
      if (currentIndex > 0) {
        showRecord(currentIndex - 1);
      }
    }
  }
});

function renderHeaderOptions() {
  headerOptions.innerHTML = "";
  headers.forEach((header) => {
    const div = document.createElement("div");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = header;
    checkbox.checked = visibleHeaders.includes(header);
    checkbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        if (!visibleHeaders.includes(header)) visibleHeaders.push(header);
      } else {
        visibleHeaders = visibleHeaders.filter((h) => h !== header);
      }
      saveHeaderPrefs();
      showRecord(currentIndex); // refresh
    });
    const label = document.createElement("label");
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(header));
    div.appendChild(label);
    headerOptions.appendChild(div);
  });
}

// Listen for any change in header checkboxes
// headerOptions.addEventListener('change', () => {
//   // Get all checked headers
//   const checkedHeaders = Array.from(document.querySelectorAll('#headerOptions input[type="checkbox"]:checked'))
//     .map(cb => cb.value);

//   // Save selection in localStorage so it persists
//   localStorage.setItem('selectedHeaders', JSON.stringify(checkedHeaders));

//   // ✅ Immediately refresh the current record view
//   showRecord(currentIndex);
// });


// headerOptions.addEventListener("change", () => {
//   updateSelectedHeaders();
// });

// // Handle "Select All" button
// document.getElementById("selectAllBtn").addEventListener("click", () => {
//   const checkboxes = headerOptions.querySelectorAll('input[type="checkbox"]');
//   checkboxes.forEach(cb => cb.checked = true);

//   localStorage.setItem('selectedHeaders', JSON.stringify(checkedHeaders));
//   debugger
//   showRecord(currentIndex);
//   // updateSelectedHeaders();
// });

// // Handle "Unselect All" button
// document.getElementById("unselectAllBtn").addEventListener("click", () => {
//   const checkboxes = headerOptions.querySelectorAll('input[type="checkbox"]');
//   checkboxes.forEach(cb => cb.checked = false);
//   updateSelectedHeaders();
// });

// // Helper to save and refresh record view
// function updateSelectedHeaders() {
//   const checkedHeaders = Array.from(
//     headerOptions.querySelectorAll('input[type="checkbox"]:checked')
//   ).map(cb => cb.value);

//   localStorage.setItem("selectedHeaders", JSON.stringify(checkedHeaders));

//   // ✅ Immediately refresh displayed record
//   showRecord(currentIndex);
// }


function saveHeaderPrefs() {
  localStorage.setItem("visibleHeaders", JSON.stringify(visibleHeaders));
}

selectFieldsBtn.addEventListener("click", () => {
  headerModal.style.display = "flex";
});

closeModalBtn.addEventListener("click", () => {
  headerModal.style.display = "none";
});

window.onclick = (e) => {
  if (e.target === headerModal) headerModal.style.display = "none";
};

selectAllBtn.addEventListener("click", () => {
  visibleHeaders = [...headers];
  saveHeaderPrefs();
  renderHeaderOptions();
  showRecord(currentIndex);
});

unselectAllBtn.addEventListener("click", () => {
  visibleHeaders = [];
  saveHeaderPrefs();
  renderHeaderOptions();
  showRecord(currentIndex);
});
