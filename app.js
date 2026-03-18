const tooltip = document.getElementById('tooltip');
const tooltipPhoto = document.getElementById('tooltip-photo');
const tooltipInitials = document.getElementById('tooltip-initials');
const tooltipName = document.getElementById('tooltip-name');
const tooltipTitle = document.getElementById('tooltip-title');
const tooltipEmail = document.getElementById('tooltip-email');

let employees = [];

async function init() {
  let empData;
  const svgText = await fetch('assets/floorplan.svg').then(r => r.text());
  try {
    const res = await fetch('/api/employees');
    if (res.ok) empData = await res.json();
    else throw new Error('API failed');
  } catch (e) {
    empData = await fetch('data/employees.json').then(r => r.json());
  }

  employees = empData;

  // Load seat assignments from SharePoint (fall back to localStorage)
  let assignments = {};
  try {
    const res = await fetch('/api/assignments');
    if (res.ok) {
      assignments = await res.json();
    }
  } catch (e) {
    const saved = localStorage.getItem('seating-assignments');
    if (saved) assignments = JSON.parse(saved);
  }
  const lastUpdated = assignments._lastUpdated || null;
  const lastUpdatedBy = assignments._lastUpdatedBy || null;
  delete assignments._lastUpdated;
  delete assignments._lastUpdatedBy;

  employees.forEach(emp => {
    emp.desk = Object.keys(assignments).find(d => assignments[d] === emp.id) || null;
  });

  if (lastUpdated) {
    const d = new Date(lastUpdated);
    let text = `Last updated: ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    if (lastUpdatedBy) text += ` by ${lastUpdatedBy}`;
    document.getElementById('last-updated').textContent = text;
  }

  const wrapper = document.getElementById('svg-wrapper');
  wrapper.innerHTML = svgText;

  const svg = wrapper.querySelector('svg');
  applyDeskStyles(svg);
  renderNameTags(svg, employees);

  // Fit viewBox tightly to the plan content
  requestAnimationFrame(() => {
    const bb = svg.getBBox();
    const pad = 500;
    svg.setAttribute('viewBox', `${bb.x - pad} ${bb.y - pad} ${bb.width + pad * 2} ${bb.height + pad * 2}`);
    svg.removeAttribute('width');
    svg.removeAttribute('height');
  });
}

function applyDeskStyles(svg) {
  svg.querySelectorAll('[id^="desk-"]').forEach(el => {
    el.classList.add('desk-shape');
  });
}

function renderNameTags(svg, employees) {
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

    // Consistent font size based on desk height, allow text to overflow horizontally
    const fullName = emp.name.trim();
    const parts = fullName.split(' ');
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');

    const fontSize = bbox.height * 0.3;
    const useSingleLine = !lastName;
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

      // Shift text so its visual center aligns exactly with desk center
      const offsetX = cx - (tb.x + tb.width / 2);
      const offsetY = cy - (tb.y + tb.height / 2);
      text.setAttribute('transform', `translate(${offsetX}, ${offsetY})`);

      // Button rect centered at desk center
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

      g.addEventListener('mouseenter', e => showTooltip(e, emp));
      g.addEventListener('mouseleave', hideTooltip);
      g.addEventListener('mousemove', e => moveTooltip(e));
    });
    g.addEventListener('click', () => {
      if (emp.profileUrl && emp.profileUrl !== '#') {
        window.open(emp.profileUrl, '_blank');
      }
    });

    // Also make the desk itself interactive
    deskEl.addEventListener('mouseenter', e => showTooltip(e, emp));
    deskEl.addEventListener('mousemove', e => moveTooltip(e));
    deskEl.addEventListener('mouseleave', hideTooltip);
    deskEl.addEventListener('click', () => {
      if (emp.profileUrl && emp.profileUrl !== '#') {
        window.open(emp.profileUrl, '_blank');
      }
    });
  });
}

function showTooltip(e, emp) {
  tooltipName.textContent = emp.name;
  tooltipTitle.textContent = emp.title || '';
  tooltipEmail.textContent = '';

  // Initials fallback
  const initials = emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  tooltipInitials.textContent = initials;
  tooltipPhoto.classList.remove('loaded');

  if (emp.photo) {
    tooltipPhoto.onload = () => {
      tooltipPhoto.classList.add('loaded');
      tooltipInitials.style.display = 'none';
    };
    tooltipPhoto.onerror = () => {
      tooltipInitials.style.display = 'flex';
    };
    tooltipPhoto.src = emp.photo;
    tooltipInitials.style.display = '';
  }

  tooltip.classList.remove('hidden');
  moveTooltip(e);
}

function moveTooltip(e) {
  const offset = 16;
  let x = e.clientX + offset;
  let y = e.clientY + offset;

  // Keep within viewport
  if (x + 240 > window.innerWidth) x = e.clientX - 240 - offset;
  if (y + 100 > window.innerHeight) y = e.clientY - 100 - offset;

  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
}

function hideTooltip() {
  tooltip.classList.add('hidden');
}

init();
