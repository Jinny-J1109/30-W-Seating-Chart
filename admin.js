let employees = [];
let assignments = {}; // { deskId: empId }
let svg = null;
let draggedEmpId = null;

async function init() {
  const [svgText, empData] = await Promise.all([
    fetch('assets/floorplan.svg').then(r => r.text()),
    fetch('data/employees.json').then(r => r.json())
  ]);

  employees = empData;

  // Load saved assignments from localStorage, fallback to JSON data
  const saved = localStorage.getItem('seating-assignments');
  if (saved) {
    assignments = JSON.parse(saved);
    // Apply saved assignments to employee objects
    employees.forEach(emp => {
      emp.desk = Object.keys(assignments).find(d => assignments[d] === emp.id) || null;
    });
  } else {
    employees.forEach(emp => {
      if (emp.desk) assignments[emp.desk] = emp.id;
    });
  }

  const wrapper = document.getElementById('svg-wrapper');
  wrapper.innerHTML = svgText;
  svg = wrapper.querySelector('svg');

  setupDesks();
  renderSidebar();
  renderAllTags();

  document.getElementById('btn-save').addEventListener('click', saveChanges);
  document.getElementById('btn-export').addEventListener('click', exportJSON);
}

function setupDesks() {
  svg.querySelectorAll('[id^="desk-"]').forEach(desk => {
    desk.classList.add('desk-shape');
    desk.addEventListener('dragover', e => {
      e.preventDefault();
      desk.classList.add('drop-target');
    });
    desk.addEventListener('dragleave', () => {
      desk.classList.remove('drop-target');
    });
    desk.addEventListener('drop', e => {
      e.preventDefault();
      desk.classList.remove('drop-target');
      if (draggedEmpId) assignEmployee(desk.id, draggedEmpId);
    });
    desk.addEventListener('dblclick', () => {
      // Double-click a desk to unassign it
      unassignDesk(desk.id);
    });
  });
}

function renderSidebar() {
  const list = document.getElementById('employee-list');
  list.innerHTML = '';

  // Sort: unassigned first, then alphabetically
  const sorted = [...employees].sort((a, b) => {
    if (!a.desk && b.desk) return -1;
    if (a.desk && !b.desk) return 1;
    return a.name.localeCompare(b.name);
  });

  sorted.forEach(emp => {
    const item = document.createElement('div');
    item.className = 'employee-item' + (emp.desk ? '' : ' unassigned');
    item.draggable = true;
    item.dataset.empId = emp.id;

    const initials = emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    item.innerHTML = `
      <div class="emp-avatar">${initials}</div>
      <div class="emp-info">
        <div class="emp-name">${emp.name}</div>
        <div class="emp-desk">${emp.desk ? emp.desk : 'Unassigned'}</div>
      </div>
    `;

    item.addEventListener('dragstart', e => {
      draggedEmpId = emp.id;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => {
      draggedEmpId = null;
      item.classList.remove('dragging');
    });

    list.appendChild(item);
  });
}

function renderAllTags() {
  // Remove existing name tags
  svg.querySelectorAll('.name-tag').forEach(el => el.remove());

  employees.forEach(emp => {
    if (!emp.desk) return;
    const deskEl = svg.getElementById(emp.desk);
    if (!deskEl) return;

    const bbox = deskEl.getBBox();
    const cx = bbox.x + bbox.width / 2;
    const cy = bbox.y + bbox.height / 2;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('name-tag');
    g.setAttribute('data-emp-id', emp.id);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', cx);
    text.setAttribute('y', cy + 4);
    text.setAttribute('text-anchor', 'middle');
    text.classList.add('name-tag-text');
    text.textContent = emp.name;

    g.appendChild(text);
    svg.appendChild(g);

    requestAnimationFrame(() => {
      const tb = text.getBBox();
      const px = 6, py = 3;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', tb.x - px);
      rect.setAttribute('y', tb.y - py);
      rect.setAttribute('width', tb.width + px * 2);
      rect.setAttribute('height', tb.height + py * 2);
      rect.setAttribute('rx', '3');
      rect.classList.add('name-tag-bg');
      g.insertBefore(rect, text);
    });

    // Allow dragging name tag to reassign
    g.setAttribute('draggable', 'true');
    g.addEventListener('dragstart', e => {
      draggedEmpId = emp.id;
      e.dataTransfer.effectAllowed = 'move';
    });
    g.addEventListener('dragend', () => { draggedEmpId = null; });
  });
}

function assignEmployee(deskId, empId) {
  // Unassign whoever was on this desk before
  const previousOccupant = assignments[deskId];
  if (previousOccupant) {
    const prev = employees.find(e => e.id === previousOccupant);
    if (prev) prev.desk = null;
  }

  // Unassign this employee from their previous desk
  const emp = employees.find(e => e.id === empId);
  if (emp && emp.desk) {
    delete assignments[emp.desk];
  }

  // Make new assignment
  if (emp) emp.desk = deskId;
  assignments[deskId] = empId;

  renderSidebar();
  renderAllTags();
}

function unassignDesk(deskId) {
  const empId = assignments[deskId];
  if (!empId) return;
  const emp = employees.find(e => e.id === empId);
  if (emp) emp.desk = null;
  delete assignments[deskId];
  renderSidebar();
  renderAllTags();
}

function saveChanges() {
  localStorage.setItem('seating-assignments', JSON.stringify(assignments));
  const msg = document.getElementById('status-msg');
  msg.textContent = 'Saved!';
  setTimeout(() => { msg.textContent = ''; }, 2000);
}

function exportJSON() {
  const updated = employees.map(emp => ({
    ...emp,
    desk: Object.keys(assignments).find(d => assignments[d] === emp.id) || null
  }));

  const blob = new Blob([JSON.stringify(updated, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'employees.json';
  a.click();
  URL.revokeObjectURL(url);
}

init();
