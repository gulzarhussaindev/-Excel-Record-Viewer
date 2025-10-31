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

sheetSelector.id = 'sheetSelector';
sheetSelector.style.marginBottom = '10px';
sheetSelector.style.display = 'none';
container.insertBefore(sheetSelector, container.querySelector('hr'));

disableUI(true);

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
      fieldValue.textContent = fullText.slice(0, 120) + '...';
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
      recordViewer.textContent = "No sheets found in file.";
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
    loadSheet(workbook.SheetNames[0]);
    disableUI(false);
  };
  reader.readAsArrayBuffer(file);
}

function loadSheet(name) {
  const sheet = workbook.Sheets[name];
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (json.length === 0) {
    headers = [];
    sheetData = [];
    recordViewer.textContent = "No records found in this sheet.";
    disableUI(true);
    return;
  }

  headers = json[0];
  sheetData = json.slice(1);
  currentIndex = 0;
  matches = [];
  matchIndex = 0;

  populateFilterDropdown();
  showRecord(currentIndex);
  updateMatchInfo();
}

function populateFilterDropdown() {
  filterColumnSelect.innerHTML = '';
  headers.forEach((h, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = h;
    filterColumnSelect.appendChild(opt);
  });
}

function showRecord(index) {
  if (sheetData.length === 0) {
    recordViewer.textContent = "0 records.";
    return;
  }
  if (index < 0 || index >= sheetData.length) return;

  currentIndex = index;
  const record = sheetData[index];

  recordViewer.innerHTML = '';
  const headerDiv = document.createElement('div');
  headerDiv.innerHTML = `<b>Record ${index + 1}</b> of ${sheetData.length}`;
  recordViewer.appendChild(headerDiv);

  headers.forEach((header, i) => {
    const value = (record[i] ?? "").toString();
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'field';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'label';
    labelSpan.textContent = `${header}:`;

    const fieldValue = document.createElement('span');
    fieldValue.className = 'field-value';
    const fullTextSpan = document.createElement('span');
    fullTextSpan.className = 'full-text';
    fullTextSpan.style.display = 'none';
    fullTextSpan.textContent = value;

    if (value.length > 120) {
      fieldValue.textContent = value.slice(0, 120) + '...';
      const expandBtn = document.createElement('button');
      expandBtn.className = 'expand-btn';
      expandBtn.textContent = 'Expand';
      fieldDiv.append(labelSpan, fieldValue, expandBtn, fullTextSpan);
    } else {
      fieldValue.textContent = value;
      fieldDiv.append(labelSpan, fieldValue);
    }

    recordViewer.appendChild(fieldDiv);
  });

  updateNavButtons();
  updateMatchInfo();
}

function updateNavButtons() {
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
  }
}

function filterRecords() {
  const colIndex = parseInt(filterColumnSelect.value, 10);
  const searchValue = filterValueInput.value.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!searchValue) {
    alert("Please enter a value to search.");
    return;
  }

  matches = [];
  sheetData.forEach((row, idx) => {
    const cellValue = (row[colIndex] ?? "").toString().toLowerCase().replace(/\s+/g, ' ');
    if (cellValue.includes(searchValue)) matches.push(idx);
  });

  if (matches.length === 0) {
    alert("No matching records found.");
    return;
  }

  matchIndex = 0;
  showRecord(matches[matchIndex]);
  updateMatchInfo(true);
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
    infoDiv.innerHTML = `
      Found ${matches.length} match(es).
      Showing ${matchIndex + 1} of ${matches.length} (Row ${matches[matchIndex] + 1})
      ${showClear ? '<button id="prevMatchBtn">Prev Match</button> <button id="nextMatchBtn">Next Match</button> <button id="clearFilterBtn">Clear Filter</button>' : ''}
    `;

    if (showClear) {
      document.getElementById('prevMatchBtn').onclick = () => {
        if (matchIndex > 0) matchIndex--;
        showRecord(matches[matchIndex]);
        updateMatchInfo(true);
      };
      document.getElementById('nextMatchBtn').onclick = () => {
        if (matchIndex < matches.length - 1) matchIndex++;
        showRecord(matches[matchIndex]);
        updateMatchInfo(true);
      };
      document.getElementById('clearFilterBtn').onclick = () => {
        matches = [];
        matchIndex = 0;
        filterValueInput.value = '';
        showRecord(currentIndex);
        updateMatchInfo();
      };
    }
  } else {
    infoDiv.textContent = '';
  }
}
