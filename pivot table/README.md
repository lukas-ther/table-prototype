# Orders Table

A minimal, framework-free web project that displays a sortable and groupable table of order data.

## Features

- **Sortable columns**: Click any column header to cycle through ascending → descending → unsorted
- **Grouping**: Use the ⋮ menu next to column headers to group rows by that column
- **Collapsible groups**: When grouped, click group headers to expand/collapse child rows
- **On-demand aggregation**: Optional aggregation for group totals and table totals
- **Responsive design**: Works on desktop and mobile devices
- **Accessibility**: Full keyboard navigation and screen reader support

## Technology Stack

- Pure HTML5 with semantic markup
- Vanilla CSS3 (no frameworks or libraries)
- Vanilla ES6 JavaScript modules
- No build tools or dependencies required

## Getting Started

1. Open `index.html` in any modern web browser, or
2. Serve the files using a local web server:

```bash
# Using Python
python3 -m http.server 8000

# Using Node.js
npx serve .

# Using PHP
php -S localhost:8000
```

Then visit `http://localhost:8000` in your browser.

## File Structure

```
orders-table/
├── index.html    # Main HTML structure
├── styles.css    # All styling (no external libraries)
├── script.js     # All JavaScript functionality (no dependencies)
└── README.md     # This file
```

## Usage

### Sorting
- Click any column header to sort by that column
- First click: ascending order (▲)
- Second click: descending order (▼)
- Third click: return to original unsorted order

### Grouping
- Click the ⋮ menu icon next to any column header
- Select "Group by [column]" to group rows by that column
- Select "Ungroup" to remove grouping
- Only one column can be grouped at a time

### Group Interaction
- When rows are grouped, groups appear collapsed by default
- Click the ▸/▾ chevron to expand/collapse groups
- Group headers show the total orders count for that group

### Aggregation
- Available for numeric columns (currently only the "Orders" column)
- Click the ⋮ menu icon next to any numeric column header
- Select aggregation options:
  - **"Aggregate by Group"**: Shows aggregated values in group headers (when data is grouped)
  - **"Aggregate Entire Table"**: Shows aggregated values in a summary row at the bottom
- Choose from aggregation functions:
  - **Sum**: Total of all values
  - **Average**: Mean of all values (shows one decimal place)
  - **Count**: Number of entries
- Aggregation settings persist across page reloads

## Browser Support

This project uses modern web standards and is compatible with:
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## License

MIT License - feel free to use this code for any purpose. 