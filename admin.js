let employees = [];
let assignments = {}; // { deskId: empId }
let svg = null;
let draggedEmpId = null; // for HTML5 D&D from sidebar
let mouseDrag = null;    // for mouse-based drag from SVG name tags

async function init() {
  const [svgText, empData] = await Promise.all([
    fetch('assets/floorplan.svg').then(r => r.text()),
    fetch('data/employees.json').then(r => r.json())
  ]);

  employees = empData;

  const saved = localStorage.getItem('seating-assignments');
  if (saved) {
    assignments = JSON.parse(saved);
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
  setupTrashZone();
  setupMouseDrag();
  renderSidebar();
  renderAllTags();

  // Fit viewBox tightly to the plan content
  requestAnimationFrame(() => {
    const bb = svg.getBBox();
    const pad = 500;
    svg.setAttribute('viewBox', `${bb.x - pad} ${bb.y - pad} ${bb.width + pad * 2} ${bb.height + pad * 2}`);
    svg.removeAttribute('width');
    svg.removeAttribute('height');
  });

  document.getElementById('btn-save').addEventListener('click', saveChanges);
  document.getElementById('btn-export').addEventListener('click', exportJSON);
}

function getDeskAtPoint(x, y) {
  return document.elementsFromPoint(x, y).find(el => el.id && el.id.startsWith('desk-'));
}

function setupDesks() {
  svg.querySelectorAll('[id^="desk-"]').forEach(desk => {
    desk.classList.add('desk-shape');
    desk.addEventListener('dblclick', () => unassignDesk(desk.id));
  });

  // HTML5 D&D handlers for sidebar → desk drops
  svg.addEventListener('dragover', e => {
    e.preventDefault();
    svg.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    const desk = getDeskAtPoint(e.clientX, e.clientY);
    if (desk) desk.classList.add('drop-target');
  });
  svg.addEventListener('dragleave', e => {
    if (!svg.contains(e.relatedTarget)) {
      svg.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    }
  });
  svg.addEventListener('drop', e => {
    e.preventDefault();
    svg.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    const desk = getDeskAtPoint(e.clientX, e.clientY);
    if (desk && draggedEmpId) assignEmployee(desk.id, draggedEmpId);
  });
}

function setupTrashZone() {
  const trashZone = document.getElementById('trash-zone');

  // Show trash during HTML5 sidebar drags
  document.addEventListener('dragstart', () => trashZone.classList.add('visible'));
  document.addEventListener('dragend', () => {
    trashZone.classList.remove('visible', 'over');
    draggedEmpId = null;
  });

  trashZone.addEventListener('dragover', e => { e.preventDefault(); trashZone.classList.add('over'); });
  trashZone.addEventListener('dragleave', () => trashZone.classList.remove('over'));
  trashZone.addEventListener('drop', e => {
    e.preventDefault();
    trashZone.classList.remove('visible', 'over');
    if (draggedEmpId) {
      const emp = employees.find(em => em.id === draggedEmpId);
      if (emp && emp.desk) unassignDesk(emp.desk);
    }
  });
}

function setupMouseDrag() {
  const trashZone = document.getElementById('trash-zone');

  document.addEventListener('mousemove', e => {
    if (!mouseDrag) return;

    // Move floating label
    mouseDrag.label.style.left = (e.clientX + 14) + 'px';
    mouseDrag.label.style.top = (e.clientY + 14) + 'px';

    // Highlight desk under cursor
    svg.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    const desk = getDeskAtPoint(e.clientX, e.clientY);
    if (desk) desk.classList.add('drop-target');

    // Highlight trash zone
    const tr = trashZone.getBoundingClientRect();
    const overTrash = e.clientX >= tr.left && e.clientX <= tr.right &&
                      e.clientY >= tr.top && e.clientY <= tr.bottom;
    trashZone.classList.toggle('over', overTrash);
  });

  document.addEventListener('mouseup', e => {
    if (!mouseDrag) return;
    const { empId, label } = mouseDrag;
    mouseDrag = null;
    label.remove();

    svg.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));

    // Check trash BEFORE hiding it (display:none gives zero rect)
    const tr = trashZone.getBoundingClientRect();
    const droppedOnTrash = e.clientX >= tr.left && e.clientX <= tr.right &&
                           e.clientY >= tr.top && e.clientY <= tr.bottom;
    trashZone.classList.remove('visible', 'over');

    if (droppedOnTrash) {
      const emp = employees.find(em => em.id === empId);
      if (emp && emp.desk) unassignDesk(emp.desk);
      return;
    }

    // Dropped on a desk
    const desk = getDeskAtPoint(e.clientX, e.clientY);
    if (desk) assignEmployee(desk.id, empId);
  });
}

function renderSidebar() {
  const list = document.getElementById('employee-list');
  list.innerHTML = '';

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
      e.dataTransfer.setData('text/plain', emp.id);
    });
    item.addEventListener('dragend', () => {
      draggedEmpId = null;
      item.classList.remove('dragging');
    });

    list.appendChild(item);
  });
}

function renderAllTags() {
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
    g.style.cursor = 'grab';

    const fullName = emp.name.trim();
    const parts = fullName.split(' ');
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');

    // Compute best font size for each layout, pick whichever is larger
    const longestPart = Math.max(firstName.length, lastName.length || 0);
    const fontSizeTwoLine = lastName ? Math.min(
      bbox.height * 0.35,
      bbox.width * 0.72 / (longestPart * 0.62)
    ) : 0;
    const fontSizeOneLine = Math.min(
      bbox.height * 0.45,
      bbox.width * 0.80 / (fullName.length * 0.62)
    );
    const useSingleLine = !lastName || fontSizeOneLine >= fontSizeTwoLine;
    const fontSize = useSingleLine ? fontSizeOneLine : fontSizeTwoLine;
    const lineHeight = fontSize * 1.3;

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', cx);
    text.setAttribute('y', cy);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', fontSize);
    text.setAttribute('font-family', 'Arial, sans-serif');
    text.classList.add('name-tag-text');

    if (useSingleLine) {
      const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      tspan.setAttribute('x', cx);
      tspan.setAttribute('dy', '0');
      tspan.textContent = fullName;
      text.appendChild(tspan);
    } else {
      const tspan1 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      tspan1.setAttribute('x', cx);
      tspan1.setAttribute('dy', '0');
      tspan1.textContent = firstName;

      const tspan2 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      tspan2.setAttribute('x', cx);
      tspan2.setAttribute('dy', lineHeight);
      tspan2.textContent = lastName;

      text.appendChild(tspan1);
      text.appendChild(tspan2);
    }
    g.appendChild(text);
    svg.appendChild(g);

    requestAnimationFrame(() => {
      const tb = text.getBBox();
      const offsetX = cx - (tb.x + tb.width / 2);
      const offsetY = cy - (tb.y + tb.height / 2);
      text.setAttribute('transform', `translate(${offsetX}, ${offsetY})`);

      const px = fontSize * 0.5, py = fontSize * 0.3;
      const maxW = bbox.width * 0.88;
      const maxH = bbox.height * 0.84;
      const btnW = Math.min(tb.width + px * 2, maxW);
      const btnH = Math.min(tb.height + py * 2, maxH);

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', cx - btnW / 2);
      rect.setAttribute('y', cy - btnH / 2);
      rect.setAttribute('width', btnW);
      rect.setAttribute('height', btnH);
      rect.setAttribute('rx', fontSize * 0.4);
      rect.classList.add('name-tag-bg');
      g.insertBefore(rect, text);
    });

    // Mouse-based drag (reliable for SVG elements)
    g.addEventListener('mousedown', e => {
      e.preventDefault();
      g.style.cursor = 'grabbing';

      const label = document.createElement('div');
      label.className = 'drag-label';
      label.textContent = emp.name;
      label.style.left = (e.clientX + 14) + 'px';
      label.style.top = (e.clientY + 14) + 'px';
      document.body.appendChild(label);

      document.getElementById('trash-zone').classList.add('visible');
      mouseDrag = { empId: emp.id, label };
    });

    document.addEventListener('mouseup', () => { g.style.cursor = 'grab'; }, { once: true });
  });
}

function assignEmployee(deskId, empId) {
  const previousOccupant = assignments[deskId];
  if (previousOccupant) {
    const prev = employees.find(e => e.id === previousOccupant);
    if (prev) prev.desk = null;
  }

  const emp = employees.find(e => e.id === empId);
  if (emp && emp.desk) delete assignments[emp.desk];
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
