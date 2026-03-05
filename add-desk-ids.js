const fs = require('fs');

const file = 'assets/floorplan.svg';
let svg = fs.readFileSync(file, 'utf8');

// Find the employeedesk group and add IDs to each path inside it
let deskCounter = 0;
let inDeskGroup = false;

const lines = svg.split('\n');
const result = [];

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  if (line.includes('<g id="employeedesk">')) {
    inDeskGroup = true;
  }

  if (inDeskGroup && line.includes('</g>')) {
    inDeskGroup = false;
  }

  if (inDeskGroup && line.includes('<path') && !line.includes('id=')) {
    deskCounter++;
    const id = `desk-${String(deskCounter).padStart(2, '0')}`;
    line = line.replace('<path', `<path id="${id}"`);
  }

  result.push(line);
}

fs.writeFileSync(file, result.join('\n'), 'utf8');
console.log(`Done! Added IDs to ${deskCounter} desks (desk-01 to desk-${String(deskCounter).padStart(2, '0')})`);
