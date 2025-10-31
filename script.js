let workbook, sheetData = [], headers = [], currentIndex = 0; 

document.getElementById('fileInput').addEventListener('change', handleFile);
document.getElementById('prevBtn').addEventListener('click', () => showRecord(currentIndex - 1));
document.getElementById('nextBtn').addEventListener('click', () => showRecord(currentIndex + 1));
document.getElementById('goBtn').addEventListener('click', goToRecord);
document.getElementById('filterBtn').addEventListener('click', filterRecords);

function handleFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    headers = json[0];
    sheetData = json.slice(1);
    currentIndex = 0;
    populateFilterDropdown();
    showRecord(currentIndex);
  };
  reader.readAsArrayBuffer(file);
}

function populateFilterDropdown() {
  const dropdown = document.getElementById('filterColumn');
  dropdown.innerHTML = headers.map((h, i) => `<option value="${i}">${h}</option>`).join('');
}

function showRecord(index) {
  if (index < 0 || index >= sheetData.length) return;
  currentIndex = index;

  const record = sheetData[index];
  const viewer = document.getElementById('recordViewer');
  viewer.innerHTML = `
    <div><b>Record ${index + 1}</b> of ${sheetData.length}</div>
    ${headers.map((header, i) => {
      let value = (record[i] ?? "").toString();
      const maxLength = 120;
      const needsExpand = value.length > maxLength;
      const shortValue = needsExpand ? value.slice(0, maxLength) + "..." : value;

      return `
        <div class="field">
          <span class="label">${header}:</span>
          <span class="field-value">${shortValue}</span>
          ${needsExpand ? `<button class="expand-btn">Expand</button>` : ''}
          <span class="full-text" style="display:none;">${value}</span>
        </div>
      `;
    }).join('')}
  `;

  // Add expand/collapse functionality
  viewer.querySelectorAll('.expand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const parent = btn.parentElement;
      const fullText = parent.querySelector('.full-text').innerText;
      const fieldValue = parent.querySelector('.field-value');

      if (btn.innerText === "Expand") {
        fieldValue.innerText = fullText;
        btn.innerText = "Collapse";
      } else {
        const shortValue = fullText.slice(0, 120) + "...";
        fieldValue.innerText = shortValue;
        btn.innerText = "Expand";
      }
    });
  });
}

function goToRecord() {
  const i = parseInt(document.getElementById('searchIndex').value, 10);
  if (!isNaN(i) && i > 0 && i <= sheetData.length) {
    showRecord(i - 1);
  }
}

function filterRecords() {
  const colIndex = parseInt(document.getElementById('filterColumn').value, 10);
  const searchValue = document.getElementById('filterValue').value.trim().toLowerCase();

  if (!searchValue) return alert("Please enter a value to search.");

  const matchIndex = sheetData.findIndex(row => (row[colIndex] || "").toString().toLowerCase().includes(searchValue));

  if (matchIndex >= 0) {
    showRecord(matchIndex);
  } else {
    alert("No matching record found.");
  }
}
