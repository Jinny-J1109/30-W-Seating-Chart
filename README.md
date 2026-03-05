# Office Seating Chart

Interactive seating chart for the architecture office, built with SVG + vanilla JS.

## Project Structure

```
Seating Chart/
├── index.html          # Main seating chart (public view)
├── admin.html          # Admin panel (drag-and-drop seating editor)
├── app.js              # Seating chart logic
├── admin.js            # Admin panel logic
├── style.css           # All styles
├── data/
│   └── employees.json  # Employee data and desk assignments
├── assets/
│   ├── floorplan.svg   # Floor plan (replace with your real SVG)
│   └── photos/         # Employee headshot photos
└── README.md
```

## Setup

### 1. Replace the Floor Plan

Export your floor plan to SVG (see SVG Prep Guide below) and replace `assets/floorplan.svg`.

Each desk must have a unique ID matching the format `desk-01`, `desk-02`, etc.

### 2. Update Employee Data

Edit `data/employees.json`. Each employee object:

```json
{
  "id": "emp-001",
  "name": "Full Name",
  "title": "Job Title",
  "email": "email@firm.com",
  "phone": "+1 555-0000",
  "desk": "desk-01",
  "photo": "assets/photos/filename.jpg",
  "profileUrl": "/people/full-name"
}
```

- `desk`: set to `null` if unassigned
- `profileUrl`: link to their profile page on your intranet
- `photo`: path to headshot image (shows on hover)

### 3. Add Employee Photos

Drop headshot photos into `assets/photos/`. JPG or PNG, square crop recommended.
Name them to match the `photo` field in `employees.json`.

### 4. Run Locally

Open `index.html` in a browser. For the fetch() calls to work, you need a local server:

```bash
# Python
python -m http.server 8000

# Node
npx serve .
```

Then open `http://localhost:8000`.

### 5. Deploy to Netlify (for testing)

1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag the entire `Seating Chart` folder onto the page
3. Get a shareable URL instantly

---

## SVG Floor Plan Prep Guide

1. In CAD, organize layers: `walls`, `desks`, `rooms`, `furniture`
2. Hide dimensions, gridlines, north arrows
3. Ensure each desk is a **closed polygon** (not loose lines)
4. Name each desk element with a unique ID: `desk-01`, `desk-02`...
5. Export to SVG (or PDF → Illustrator → SVG)
6. In Illustrator/Inkscape, clean up and verify desk IDs in the XML
7. Export with: SVG 1.1, Responsive ON, Minify OFF, Decimal Places 2

---

## Admin Panel

Go to `admin.html` to edit seating:

- **Drag** an employee from the sidebar onto a desk to assign them
- **Drag** a name tag from one desk to another to reassign
- **Double-click** a desk to unassign it
- **Save Changes** stores assignments in localStorage
- **Export JSON** downloads updated `employees.json` — replace the file and redeploy

---

## Embedding in Synthesis (Intranet)

Once deployed, embed via iFrame:

```html
<iframe src="https://your-url.netlify.app" width="100%" height="800px" frameborder="0"></iframe>
```

Ask your IT director to host on the firm's server and embed the same way.
