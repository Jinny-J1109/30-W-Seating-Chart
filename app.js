const tooltip = document.getElementById('tooltip');
const tooltipPhoto = document.getElementById('tooltip-photo');
const tooltipInitials = document.getElementById('tooltip-initials');
const tooltipName = document.getElementById('tooltip-name');
const tooltipTitle = document.getElementById('tooltip-title');
const tooltipEmail = document.getElementById('tooltip-email');

let employees = [];

async function init() {
  const [svgText, empData] = await Promise.all([
    fetch('assets/floorplan.svg').then(r => r.text()),
    fetch('data/employees.json').then(r => r.json())
  ]);

  employees = empData;

  const wrapper = document.getElementById('svg-wrapper');
  wrapper.innerHTML = svgText;

  const svg = wrapper.querySelector('svg');
  applyDeskStyles(svg);
  renderNameTags(svg, employees);
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

    // Text first (need it in DOM to measure)
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', cx);
    text.setAttribute('y', cy + 4);
    text.setAttribute('text-anchor', 'middle');
    text.classList.add('name-tag-text');
    text.textContent = emp.name;

    g.appendChild(text);
    svg.appendChild(g);

    // Measure then add background
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

    g.addEventListener('mouseenter', e => showTooltip(e, emp));
    g.addEventListener('mousemove', e => moveTooltip(e));
    g.addEventListener('mouseleave', hideTooltip);
    g.addEventListener('click', () => {
      if (emp.profileUrl && emp.profileUrl !== '#') {
        window.location.href = emp.profileUrl;
      }
    });

    // Also make the desk itself interactive
    deskEl.addEventListener('mouseenter', e => showTooltip(e, emp));
    deskEl.addEventListener('mousemove', e => moveTooltip(e));
    deskEl.addEventListener('mouseleave', hideTooltip);
    deskEl.addEventListener('click', () => {
      if (emp.profileUrl && emp.profileUrl !== '#') {
        window.location.href = emp.profileUrl;
      }
    });
  });
}

function showTooltip(e, emp) {
  tooltipName.textContent = emp.name;
  tooltipTitle.textContent = emp.title;
  tooltipEmail.textContent = emp.email;

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
