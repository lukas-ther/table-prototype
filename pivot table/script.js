// Hard-coded pivot data with quarterly breakdown
const pivotData = [
    { 
        category: "Books", 
        publisher: "HarperCollins", 
        q1_2024: 1234, 
        q2_2024: 1567, 
        q3_2024: 1000, 
        q4_2024: 1052 
    },
    { 
        category: "Books", 
        publisher: "Penguin Random House", 
        q1_2024: 1234, 
        q2_2024: 2567, 
        q3_2024: 1890, 
        q4_2024: 1098 
    },
    { 
        category: "Books", 
        publisher: "Simon & Schuster", 
        q1_2024: 2345, 
        q2_2024: 1678, 
        q3_2024: 3210, 
        q4_2024: 1001 
    },
    { 
        category: "Games", 
        publisher: "Annapurna Interactive", 
        q1_2024: 1200, 
        q2_2024: 650, 
        q3_2024: 500, 
        q4_2024: 427 
    },
    { 
        category: "Games", 
        publisher: "Epic Odyssey Interactive", 
        q1_2024: 1000, 
        q2_2024: 750, 
        q3_2024: 600, 
        q4_2024: 540 
    },
    { 
        category: "Games", 
        publisher: "Humble Games", 
        q1_2024: 1234, 
        q2_2024: 1456, 
        q3_2024: 1789, 
        q4_2024: 1088 
    }
];

// Application state
let sortStates = []; // Array of sort states: [{ column: 'category', direction: 'asc', priority: 1 }, ...]
let groupBy = null; // null or column name
let collapsedGroups = new Set(); // Track which groups are collapsed
let textWrapStates = {}; // Track which columns have text wrapping enabled
let currentMenuColumn = null; // Track which column's menu is currently open

// New aggregation state
let aggregationStates = {}; // Track aggregation settings per column: { column: { groupAggregation: { function: 'sum' }, tableAggregation: { function: 'sum' } } }

// Cell selection state
let isSelecting = false; // Track if user is currently selecting cells
let selectionStart = null; // { row: number, col: number, cell: HTMLElement }
let selectionEnd = null; // { row: number, col: number, cell: HTMLElement }
let selectedCells = new Set(); // Set of selected cell elements for quick lookup
let selectionContextMenu = null; // Reference to selection context menu

// DOM elements
const tableBody = document.getElementById('table-body');
const contextMenu = document.getElementById('context-menu');
const groupAction = document.getElementById('group-action');
const wrapToggle = document.getElementById('wrap-toggle');

// Column indices for applying classes - updated for pivot structure
const COLUMN_INDICES = {
    category: 0,
    publisher: 1,
    q1_2024: 2,
    q2_2024: 3,
    q3_2024: 4,
    q4_2024: 5
};

// Quarterly columns for numeric operations
const QUARTER_COLUMNS = ['q1_2024', 'q2_2024', 'q3_2024', 'q4_2024'];

// Aggregation functions
const AGGREGATION_FUNCTIONS = {
    sum: (values) => values.reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0),
    average: (values) => {
        const nums = values.filter(val => typeof val === 'number');
        return nums.length > 0 ? nums.reduce((sum, val) => sum + val, 0) / nums.length : 0;
    },
    count: (values) => values.length
};

// Check if a column contains numeric data - updated for pivot columns
function isNumericColumn(column) {
    return QUARTER_COLUMNS.includes(column);
}

// Load aggregation preferences from localStorage
function loadAggregationPreferences() {
    try {
        const saved = localStorage.getItem('orders-table-aggregation-states');
        if (saved) {
            aggregationStates = JSON.parse(saved);
        }
    } catch (e) {
        console.warn('Failed to load aggregation preferences:', e);
        aggregationStates = {};
    }
}

// Save aggregation preferences to localStorage
function saveAggregationPreferences() {
    try {
        localStorage.setItem('orders-table-aggregation-states', JSON.stringify(aggregationStates));
    } catch (e) {
        console.warn('Failed to save aggregation preferences:', e);
    }
}

// Calculate aggregation for a set of values
function calculateAggregation(values, functionName) {
    if (!values || values.length === 0) return 0;
    
    const aggFunction = AGGREGATION_FUNCTIONS[functionName];
    if (!aggFunction) return 0;
    
    return aggFunction(values);
}

// Initialize the application
function init() {
    loadTextWrapPreferences();
    loadAggregationPreferences();
    setupEventListeners();
    renderTable();
}

// Load text wrap preferences from localStorage
function loadTextWrapPreferences() {
    try {
        const saved = localStorage.getItem('orders-table-wrap-states');
        if (saved) {
            textWrapStates = JSON.parse(saved);
        }
    } catch (e) {
        console.warn('Failed to load text wrap preferences:', e);
        textWrapStates = {};
    }
}

// Save text wrap preferences to localStorage
function saveTextWrapPreferences() {
    try {
        localStorage.setItem('orders-table-wrap-states', JSON.stringify(textWrapStates));
    } catch (e) {
        console.warn('Failed to save text wrap preferences:', e);
    }
}

// Set up event listeners
function setupEventListeners() {
    // Sort button listeners
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', handleSort);
    });

    // Menu button listeners
    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.addEventListener('click', handleMenuClick);
    });

    // Context menu actions
    groupAction.addEventListener('click', handleGroupAction);
    wrapToggle.addEventListener('change', handleWrapToggle);

    // Aggregation submenu handlers
    document.getElementById('group-aggregation-item').addEventListener('click', handleGroupAggregationSubmenu);
    document.getElementById('table-aggregation-item').addEventListener('click', handleTableAggregationSubmenu);
    
    // Aggregation option handlers
    document.querySelectorAll('.aggregation-option').forEach(option => {
        option.addEventListener('click', handleAggregationOption);
    });

    // Click outside to close context menu and submenus
    document.addEventListener('click', (event) => {
        if (!contextMenu.contains(event.target) && 
            !document.getElementById('group-aggregation-submenu').contains(event.target) &&
            !document.getElementById('table-aggregation-submenu').contains(event.target)) {
            hideContextMenu();
            hideAllSubmenus();
        }
    });

    // Keyboard support for menu
    document.addEventListener('keydown', handleKeydown);
    
    // Cell selection event listeners
    setupCellSelectionListeners();
}

// Handle multi-column sorting
function handleSort(event) {
    const column = event.currentTarget.dataset.column;
    const isShiftClick = event.shiftKey;
    
    // Find existing sort state for this column
    const existingIndex = sortStates.findIndex(state => state.column === column);
    
    if (!isShiftClick) {
        // Regular click: reset to single-column sort or modify existing single sort
        if (sortStates.length === 1 && existingIndex === 0) {
            // Cycle through states for single column: asc -> desc -> remove
            const currentState = sortStates[0];
            if (currentState.direction === 'asc') {
                sortStates[0].direction = 'desc';
            } else {
                // Remove the sort
                sortStates = [];
            }
        } else {
            // Reset to new single-column sort
            sortStates = [{ column, direction: 'asc', priority: 1 }];
        }
    } else {
        // Shift+click: add to sort chain or modify existing
        if (existingIndex >= 0) {
            // Column is already in sort chain - cycle its direction or remove
            const currentState = sortStates[existingIndex];
            if (currentState.direction === 'asc') {
                sortStates[existingIndex].direction = 'desc';
            } else {
                // Remove this column from sort chain
                sortStates.splice(existingIndex, 1);
                // Reassign priorities
                reassignPriorities();
            }
        } else {
            // Add new column to sort chain
            const newPriority = sortStates.length + 1;
            sortStates.push({ column, direction: 'asc', priority: newPriority });
        }
    }
    
    updateSortIndicators();
    renderTable();
}

// Reassign priorities after removing a column from sort chain
function reassignPriorities() {
    sortStates.forEach((state, index) => {
        state.priority = index + 1;
    });
}

// Update sort indicators with priority numbers
function updateSortIndicators() {
    // Clear all indicators first
    document.querySelectorAll('.sort-indicator').forEach(indicator => {
        indicator.textContent = '';
    });
    
    // Update indicators for active sorts
    sortStates.forEach(sortState => {
        const button = document.querySelector(`[data-column="${sortState.column}"]`);
        if (button) {
            const indicator = button.querySelector('.sort-indicator');
            
            const arrow = sortState.direction === 'asc' ? '▲' : '▼';
            const priority = sortState.priority;
            
            // Use superscript numbers for cleaner look
            const superscriptNumbers = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
            const prioritySymbol = priority <= 9 ? superscriptNumbers[priority] : priority.toString();
            
            indicator.textContent = arrow + prioritySymbol;
        }
    });
}

// Handle menu button clicks
function handleMenuClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const column = event.currentTarget.dataset.column;
    const rect = event.currentTarget.getBoundingClientRect();
    
    showContextMenu(rect.right - 160, rect.bottom + 5, column);
}

// Show context menu
function showContextMenu(x, y, column) {
    currentMenuColumn = column;
    const isCurrentlyGrouped = groupBy === column;
    
    // Check if this is a quarter column (should not have grouping option)
    const isQuarterColumn = QUARTER_COLUMNS.includes(column);
    
    // Update group action button
    if (isQuarterColumn) {
        // Hide group action for quarter columns
        groupAction.style.display = 'none';
    } else {
        groupAction.style.display = 'block';
        if (isCurrentlyGrouped) {
            groupAction.textContent = 'Ungroup';
            groupAction.dataset.action = 'ungroup';
        } else {
            groupAction.textContent = `Group by ${column}`;
            groupAction.dataset.action = 'group';
        }
        groupAction.dataset.column = column;
    }
    
    // Update wrap toggle checkbox
    wrapToggle.checked = textWrapStates[column] || false;
    
    // Show/hide aggregation options based on column type
    const aggregationOptions = document.getElementById('aggregation-options');
    if (isNumericColumn(column)) {
        aggregationOptions.style.display = 'block';
        updateAggregationMenuState(column);
    } else {
        aggregationOptions.style.display = 'none';
    }
    
    // Position and show menu
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    contextMenu.style.display = 'block';
    
    // Focus for keyboard navigation
    wrapToggle.focus();
}

// Hide context menu
function hideContextMenu() {
    contextMenu.style.display = 'none';
    currentMenuColumn = null;
    hideAllSubmenus();
}

// Hide all submenus
function hideAllSubmenus() {
    document.getElementById('group-aggregation-submenu').style.display = 'none';
    document.getElementById('table-aggregation-submenu').style.display = 'none';
}

// Handle group/ungroup action
function handleGroupAction(event) {
    const action = event.target.dataset.action;
    const column = event.target.dataset.column;
    
    if (action === 'group') {
        groupBy = column;
        collapsedGroups.clear(); // Reset collapsed state
        // Set default collapsed state for all groups
        const groups = getGroups();
        groups.forEach(group => collapsedGroups.add(group.key));
    } else if (action === 'ungroup') {
        groupBy = null;
        collapsedGroups.clear();
    }
    
    hideContextMenu();
    renderTable();
}

// Handle text wrap toggle
function handleWrapToggle(event) {
    event.preventDefault();
    event.stopPropagation();
    
    if (!currentMenuColumn) return;
    
    const column = currentMenuColumn;
    const isWrapped = event.target.checked;
    
    console.log(`Toggling wrap for column ${column}: ${isWrapped}`); // Debug log
    
    // Update state
    textWrapStates[column] = isWrapped;
    saveTextWrapPreferences();
    
    // Apply classes to current table immediately
    applyTextWrapClasses();
}

// Apply text wrap classes to all cells in the table - updated for pivot structure
function applyTextWrapClasses() {
    const table = document.getElementById('orders-table');
    const rows = table.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        
        // Skip aggregation rows
        if (row.classList.contains('table-aggregation-row')) {
            return;
        }
        
        // Handle different row types for pivot table
        if (row.classList.contains('group-row')) {
            // Group header rows - 6 columns total for pivot table
            applyWrapToCell(cells[0], 'category');
            applyWrapToCell(cells[1], 'publisher');
            applyWrapToCell(cells[2], 'q1_2024');
            applyWrapToCell(cells[3], 'q2_2024');
            applyWrapToCell(cells[4], 'q3_2024');
            applyWrapToCell(cells[5], 'q4_2024');
        } else if (row.classList.contains('child-row') && row.classList.contains('expanded')) {
            // Expanded group rows - need to detect the structure based on grouping column
            if (cells.length === 6) {
                // First row of expanded group with rowspan
                applyWrapToCell(cells[0], 'category');
                applyWrapToCell(cells[1], 'publisher');
                applyWrapToCell(cells[2], 'q1_2024');
                applyWrapToCell(cells[3], 'q2_2024');
                applyWrapToCell(cells[4], 'q3_2024');
                applyWrapToCell(cells[5], 'q4_2024');
            } else if (cells.length === 5) {
                // Subsequent rows with one column covered by rowspan
                if (groupBy === 'category') {
                    // Missing category column
                    applyWrapToCell(cells[0], 'publisher');
                    applyWrapToCell(cells[1], 'q1_2024');
                    applyWrapToCell(cells[2], 'q2_2024');
                    applyWrapToCell(cells[3], 'q3_2024');
                    applyWrapToCell(cells[4], 'q4_2024');
                } else if (groupBy === 'publisher') {
                    // Missing publisher column
                    applyWrapToCell(cells[0], 'category');
                    applyWrapToCell(cells[1], 'q1_2024');
                    applyWrapToCell(cells[2], 'q2_2024');
                    applyWrapToCell(cells[3], 'q3_2024');
                    applyWrapToCell(cells[4], 'q4_2024');
                } else if (QUARTER_COLUMNS.includes(groupBy)) {
                    // Missing one of the quarter columns
                    applyWrapToCell(cells[0], 'category');
                    applyWrapToCell(cells[1], 'publisher');
                    // Apply to remaining quarter columns based on which one is grouped
                    let quarterIndex = 0;
                    QUARTER_COLUMNS.forEach(col => {
                        if (col !== groupBy && quarterIndex < cells.length - 2) {
                            applyWrapToCell(cells[2 + quarterIndex], col);
                            quarterIndex++;
                        }
                    });
                }
            }
        } else {
            // Regular flat table rows
            applyWrapToCell(cells[0], 'category');
            applyWrapToCell(cells[1], 'publisher');
            applyWrapToCell(cells[2], 'q1_2024');
            applyWrapToCell(cells[3], 'q2_2024');
            applyWrapToCell(cells[4], 'q3_2024');
            applyWrapToCell(cells[5], 'q4_2024');
        }
    });
}

// Helper function to apply wrap classes to a specific cell
function applyWrapToCell(cell, column) {
    if (!cell) return;
    
    // Remove both classes first
    cell.classList.remove('cell-clip', 'cell-wrap');
    
    // Apply appropriate class based on current state
    if (textWrapStates[column]) {
        cell.classList.add('cell-wrap');
    } else {
        cell.classList.add('cell-clip');
    }
}

// Handle keyboard navigation
function handleKeydown(event) {
    if (contextMenu.style.display === 'block') {
        if (event.key === 'Escape') {
            hideContextMenu();
        } else if (event.key === 'Enter') {
            if (event.target === groupAction) {
                handleGroupAction(event);
            } else if (event.target === wrapToggle) {
                // Toggle checkbox with Enter
                wrapToggle.checked = !wrapToggle.checked;
                handleWrapToggle({ target: wrapToggle, preventDefault: () => {}, stopPropagation: () => {} });
            }
        }
    }
}

// Use pivot data instead of original data
function getSortedData() {
    if (sortStates.length === 0) {
        return [...pivotData];
    }
    
    return [...pivotData].sort((a, b) => {
        // Apply each sort criterion in priority order
        for (const sortState of sortStates) {
            const { column, direction } = sortState;
            const aVal = a[column];
            const bVal = b[column];
            
            let comparison = 0;
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                comparison = aVal - bVal;
            } else {
                comparison = aVal.toString().localeCompare(bVal.toString());
            }
            
            if (comparison !== 0) {
                return direction === 'desc' ? -comparison : comparison;
            }
            // If values are equal, continue to next sort criterion
        }
        
        // All sort criteria resulted in equality
        return 0;
    });
}

// Get grouped data (uses sorted data as input)
function getGroups() {
    if (!groupBy) return [];
    
    const sortedData = getSortedData();
    const groups = new Map();
    
    sortedData.forEach(item => {
        const key = item[groupBy];
        if (!groups.has(key)) {
            groups.set(key, { key, items: [] });
        }
        const group = groups.get(key);
        group.items.push(item);
    });
    
    return Array.from(groups.values());
}

// Format number with thousands separator
function formatNumber(num) {
    return num.toLocaleString();
}

// Get group aggregation value for a column
function getGroupAggregationValue(column, items) {
    const columnState = aggregationStates[column];
    if (!columnState || !columnState.groupAggregation) return null;
    
    const values = items.map(item => item[column]);
    return calculateAggregation(values, columnState.groupAggregation.function);
}

// Get table aggregation value for a column
function getTableAggregationValue(column, data) {
    const columnState = aggregationStates[column];
    if (!columnState || !columnState.tableAggregation) return null;
    
    const values = data.map(item => item[column]);
    return calculateAggregation(values, columnState.tableAggregation.function);
}

// Format aggregation value with appropriate precision and units
function formatAggregationValue(value, column) {
    if (typeof value !== 'number') return value.toString();
    
    // For quarter columns, format as integer with thousands separator
    if (QUARTER_COLUMNS.includes(column)) {
        // For averages, show one decimal place
        const columnState = aggregationStates[column];
        const isAverage = columnState?.groupAggregation?.function === 'average' || 
                         columnState?.tableAggregation?.function === 'average';
        
        if (isAverage) {
            return Math.round(value * 10) / 10; // One decimal place
        } else {
            return formatNumber(Math.round(value));
        }
    }
    
    return formatNumber(value);
}

// Handle group row click (toggle collapse)
function handleGroupToggle(event) {
    event.stopPropagation(); // Prevent event bubbling
    
    let groupKey;
    
    // Check if this is a traditional group row or an inline group cell
    if (event.currentTarget.dataset.groupKey) {
        // Traditional group row (collapsed state)
        groupKey = event.currentTarget.dataset.groupKey;
    } else if (event.currentTarget.querySelector && event.currentTarget.querySelector('[data-group-key]')) {
        // Clicked on group cell content (expanded state)
        groupKey = event.currentTarget.querySelector('[data-group-key]').dataset.groupKey;
    } else if (event.currentTarget.dataset && event.currentTarget.dataset.groupKey) {
        // Direct click on group cell content
        groupKey = event.currentTarget.dataset.groupKey;
    } else {
        // Fallback: try to find group key in the element tree
        let element = event.currentTarget;
        while (element && !groupKey) {
            if (element.dataset && element.dataset.groupKey) {
                groupKey = element.dataset.groupKey;
                break;
            }
            element = element.parentElement;
        }
    }
    
    if (!groupKey) {
        console.warn('Could not find group key for toggle event');
        return;
    }
    
    if (collapsedGroups.has(groupKey)) {
        collapsedGroups.delete(groupKey);
    } else {
        collapsedGroups.add(groupKey);
    }
    
    renderTable();
}

// Render the table
function renderTable() {
    // Clear any existing cell selection
    clearSelection();
    
    // Clear the table body
    tableBody.innerHTML = '';
    
    // Ensure the table structure is intact
    const table = document.getElementById('orders-table');
    if (!table) {
        console.error('Table element not found!');
        return;
    }
    
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    
    if (!thead) {
        console.error('Table thead not found!');
        return;
    }
    
    if (!tbody) {
        console.error('Table tbody not found!');
        return;
    }
    
    if (groupBy) {
        renderGroupedTable();
    } else {
        renderFlatTable();
    }
    
    // Apply text wrap classes after rendering
    requestAnimationFrame(() => {
        applyTextWrapClasses();
        // Setup cell selection events after rendering
        setupTableSelectionEvents();
    });
}

// Render flat table (no grouping) - updated for pivot structure
function renderFlatTable() {
    const sortedData = getSortedData();
    
    sortedData.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.category}</td>
            <td>${item.publisher}</td>
            <td class="numeric">${formatNumber(item.q1_2024)}</td>
            <td class="numeric">${formatNumber(item.q2_2024)}</td>
            <td class="numeric">${formatNumber(item.q3_2024)}</td>
            <td class="numeric">${formatNumber(item.q4_2024)}</td>
        `;
        tableBody.appendChild(row);
    });
    
    // Add table aggregation row if any column has table aggregation enabled
    if (hasTableAggregation()) {
        const aggregationRow = document.createElement('tr');
        aggregationRow.className = 'table-aggregation-row';
        
        // Calculate aggregations for each column
        const categoryAgg = getTableAggregationValue('category', sortedData);
        const publisherAgg = getTableAggregationValue('publisher', sortedData);
        const q1Agg = getTableAggregationValue('q1_2024', sortedData);
        const q2Agg = getTableAggregationValue('q2_2024', sortedData);
        const q3Agg = getTableAggregationValue('q3_2024', sortedData);
        const q4Agg = getTableAggregationValue('q4_2024', sortedData);
        
        aggregationRow.innerHTML = `
            <td class="aggregation-cell">${categoryAgg !== null ? formatAggregationValue(categoryAgg, 'category') : ''}</td>
            <td class="aggregation-cell">${publisherAgg !== null ? formatAggregationValue(publisherAgg, 'publisher') : ''}</td>
            <td class="numeric aggregation-cell">${q1Agg !== null ? formatAggregationValue(q1Agg, 'q1_2024') : ''}</td>
            <td class="numeric aggregation-cell">${q2Agg !== null ? formatAggregationValue(q2Agg, 'q2_2024') : ''}</td>
            <td class="numeric aggregation-cell">${q3Agg !== null ? formatAggregationValue(q3Agg, 'q3_2024') : ''}</td>
            <td class="numeric aggregation-cell">${q4Agg !== null ? formatAggregationValue(q4Agg, 'q4_2024') : ''}</td>
        `;
        
        tableBody.appendChild(aggregationRow);
    }
}

// Render grouped table - updated for pivot structure
function renderGroupedTable() {
    const groups = getGroups();
    
    groups.forEach((group, groupIndex) => {
        const isCollapsed = collapsedGroups.has(group.key);
        
        if (isCollapsed) {
            // Collapsed: show traditional group header row with group aggregations if they exist
            const groupRow = document.createElement('tr');
            groupRow.className = 'group-row group-parent collapsed';
            groupRow.dataset.groupKey = group.key;
            groupRow.addEventListener('click', handleGroupToggle);
            groupRow.style.cursor = 'pointer';
            
            const chevron = '▸';
            
            // Build collapsed group row HTML based on which column we're grouping by
            if (groupBy === 'category') {
                const q1Agg = getGroupAggregationValue('q1_2024', group.items);
                const q2Agg = getGroupAggregationValue('q2_2024', group.items);
                const q3Agg = getGroupAggregationValue('q3_2024', group.items);
                const q4Agg = getGroupAggregationValue('q4_2024', group.items);
                
                groupRow.innerHTML = `
                    <td>
                        <span class="group-chevron">${chevron}</span>
                        <span class="group-name">${group.key}</span>
                    </td>
                    <td></td>
                    <td class="numeric">${q1Agg !== null ? `<span class="group-total">${formatAggregationValue(q1Agg, 'q1_2024')}</span>` : ''}</td>
                    <td class="numeric">${q2Agg !== null ? `<span class="group-total">${formatAggregationValue(q2Agg, 'q2_2024')}</span>` : ''}</td>
                    <td class="numeric">${q3Agg !== null ? `<span class="group-total">${formatAggregationValue(q3Agg, 'q3_2024')}</span>` : ''}</td>
                    <td class="numeric">${q4Agg !== null ? `<span class="group-total">${formatAggregationValue(q4Agg, 'q4_2024')}</span>` : ''}</td>
                `;
            } else if (groupBy === 'publisher') {
                const q1Agg = getGroupAggregationValue('q1_2024', group.items);
                const q2Agg = getGroupAggregationValue('q2_2024', group.items);
                const q3Agg = getGroupAggregationValue('q3_2024', group.items);
                const q4Agg = getGroupAggregationValue('q4_2024', group.items);
                
                groupRow.innerHTML = `
                    <td></td>
                    <td>
                        <span class="group-chevron">${chevron}</span>
                        <span class="group-name">${group.key}</span>
                    </td>
                    <td class="numeric">${q1Agg !== null ? `<span class="group-total">${formatAggregationValue(q1Agg, 'q1_2024')}</span>` : ''}</td>
                    <td class="numeric">${q2Agg !== null ? `<span class="group-total">${formatAggregationValue(q2Agg, 'q2_2024')}</span>` : ''}</td>
                    <td class="numeric">${q3Agg !== null ? `<span class="group-total">${formatAggregationValue(q3Agg, 'q3_2024')}</span>` : ''}</td>
                    <td class="numeric">${q4Agg !== null ? `<span class="group-total">${formatAggregationValue(q4Agg, 'q4_2024')}</span>` : ''}</td>
                `;
            } else if (QUARTER_COLUMNS.includes(groupBy)) {
                // Grouping by one of the quarter columns
                const quarterValue = formatNumber(group.key);
                groupRow.innerHTML = `
                    <td></td>
                    <td></td>
                    ${QUARTER_COLUMNS.map(col => {
                        if (col === groupBy) {
                            return `<td class="numeric">
                                <span class="group-chevron">${chevron}</span>
                                <span class="group-name">${quarterValue}</span>
                            </td>`;
                        } else {
                            const agg = getGroupAggregationValue(col, group.items);
                            return `<td class="numeric">${agg !== null ? `<span class="group-total">${formatAggregationValue(agg, col)}</span>` : ''}</td>`;
                        }
                    }).join('')}
                `;
            }
            
            tableBody.appendChild(groupRow);
            
        } else {
            // Expanded: use rowspan to merge grouped column with first child row
            const chevron = '▾';
            const groupSize = group.items.length;
            
            group.items.forEach((item, index) => {
                const childRow = document.createElement('tr');
                childRow.className = 'child-row group-child expanded';
                
                if (index === 0) {
                    // First row: include the grouped column with rowspan and chevron
                    if (groupBy === 'category') {
                        childRow.innerHTML = `
                            <td rowspan="${groupSize}" class="group-cell">
                                <div class="group-cell-content" data-group-key="${group.key}">
                                    <span class="group-chevron expanded">${chevron}</span>
                                    <span class="group-name">${group.key}</span>
                                </div>
                            </td>
                            <td>${item.publisher}</td>
                            <td class="numeric">${formatNumber(item.q1_2024)}</td>
                            <td class="numeric">${formatNumber(item.q2_2024)}</td>
                            <td class="numeric">${formatNumber(item.q3_2024)}</td>
                            <td class="numeric">${formatNumber(item.q4_2024)}</td>
                        `;
                    } else if (groupBy === 'publisher') {
                        childRow.innerHTML = `
                            <td>${item.category}</td>
                            <td rowspan="${groupSize}" class="group-cell">
                                <div class="group-cell-content" data-group-key="${group.key}">
                                    <span class="group-chevron expanded">${chevron}</span>
                                    <span class="group-name">${group.key}</span>
                                </div>
                            </td>
                            <td class="numeric">${formatNumber(item.q1_2024)}</td>
                            <td class="numeric">${formatNumber(item.q2_2024)}</td>
                            <td class="numeric">${formatNumber(item.q3_2024)}</td>
                            <td class="numeric">${formatNumber(item.q4_2024)}</td>
                        `;
                    } else if (QUARTER_COLUMNS.includes(groupBy)) {
                        // Grouping by one of the quarter columns
                        const quarterIndex = QUARTER_COLUMNS.indexOf(groupBy);
                        const quarterCells = QUARTER_COLUMNS.map((col, idx) => {
                            if (idx === quarterIndex) {
                                return `<td rowspan="${groupSize}" class="numeric group-cell">
                                    <div class="group-cell-content" data-group-key="${group.key}">
                                        <span class="group-chevron expanded">${chevron}</span>
                                        <span class="group-name">${formatNumber(group.key)}</span>
                                    </div>
                                </td>`;
                            } else {
                                return `<td class="numeric">${formatNumber(item[col])}</td>`;
                            }
                        }).join('');
                        
                        childRow.innerHTML = `
                            <td>${item.category}</td>
                            <td>${item.publisher}</td>
                            ${quarterCells}
                        `;
                    }
                    
                    // Add click handler to the group cell content for toggling
                    setTimeout(() => {
                        const groupCellContent = childRow.querySelector('.group-cell-content');
                        if (groupCellContent) {
                            groupCellContent.addEventListener('click', handleGroupToggle);
                            groupCellContent.style.cursor = 'pointer';
                        }
                    }, 0);
                    
                } else {
                    // Subsequent rows: exclude the grouped column (covered by rowspan from first row)
                    if (groupBy === 'category') {
                        childRow.innerHTML = `
                            <td>${item.publisher}</td>
                            <td class="numeric">${formatNumber(item.q1_2024)}</td>
                            <td class="numeric">${formatNumber(item.q2_2024)}</td>
                            <td class="numeric">${formatNumber(item.q3_2024)}</td>
                            <td class="numeric">${formatNumber(item.q4_2024)}</td>
                        `;
                    } else if (groupBy === 'publisher') {
                        childRow.innerHTML = `
                            <td>${item.category}</td>
                            <td class="numeric">${formatNumber(item.q1_2024)}</td>
                            <td class="numeric">${formatNumber(item.q2_2024)}</td>
                            <td class="numeric">${formatNumber(item.q3_2024)}</td>
                            <td class="numeric">${formatNumber(item.q4_2024)}</td>
                        `;
                    } else if (QUARTER_COLUMNS.includes(groupBy)) {
                        // Exclude the grouped quarter column
                        const quarterIndex = QUARTER_COLUMNS.indexOf(groupBy);
                        const quarterCells = QUARTER_COLUMNS.map((col, idx) => {
                            if (idx !== quarterIndex) {
                                return `<td class="numeric">${formatNumber(item[col])}</td>`;
                            }
                            return '';
                        }).join('');
                        
                        childRow.innerHTML = `
                            <td>${item.category}</td>
                            <td>${item.publisher}</td>
                            ${quarterCells}
                        `;
                    }
                }
                
                tableBody.appendChild(childRow);
            });
            
            // Add group aggregation row at the end of expanded group if group aggregation is enabled
            if (hasGroupAggregation()) {
                const groupAggRow = document.createElement('tr');
                groupAggRow.className = 'group-aggregation-row';
                
                // Calculate aggregations for this group
                const q1Agg = getGroupAggregationValue('q1_2024', group.items);
                const q2Agg = getGroupAggregationValue('q2_2024', group.items);
                const q3Agg = getGroupAggregationValue('q3_2024', group.items);
                const q4Agg = getGroupAggregationValue('q4_2024', group.items);
                
                // Build aggregation row based on which column we're grouping by
                if (groupBy === 'category') {
                    groupAggRow.innerHTML = `
                        <td class="aggregation-cell"></td>
                        <td class="aggregation-cell"></td>
                        <td class="numeric aggregation-cell">${q1Agg !== null ? formatAggregationValue(q1Agg, 'q1_2024') : ''}</td>
                        <td class="numeric aggregation-cell">${q2Agg !== null ? formatAggregationValue(q2Agg, 'q2_2024') : ''}</td>
                        <td class="numeric aggregation-cell">${q3Agg !== null ? formatAggregationValue(q3Agg, 'q3_2024') : ''}</td>
                        <td class="numeric aggregation-cell">${q4Agg !== null ? formatAggregationValue(q4Agg, 'q4_2024') : ''}</td>
                    `;
                } else if (groupBy === 'publisher') {
                    groupAggRow.innerHTML = `
                        <td class="aggregation-cell"></td>
                        <td class="aggregation-cell"></td>
                        <td class="numeric aggregation-cell">${q1Agg !== null ? formatAggregationValue(q1Agg, 'q1_2024') : ''}</td>
                        <td class="numeric aggregation-cell">${q2Agg !== null ? formatAggregationValue(q2Agg, 'q2_2024') : ''}</td>
                        <td class="numeric aggregation-cell">${q3Agg !== null ? formatAggregationValue(q3Agg, 'q3_2024') : ''}</td>
                        <td class="numeric aggregation-cell">${q4Agg !== null ? formatAggregationValue(q4Agg, 'q4_2024') : ''}</td>
                    `;
                } else if (QUARTER_COLUMNS.includes(groupBy)) {
                    // Grouping by one of the quarter columns
                    groupAggRow.innerHTML = `
                        <td class="aggregation-cell"></td>
                        <td class="aggregation-cell"></td>
                        ${QUARTER_COLUMNS.map(col => {
                            const agg = getGroupAggregationValue(col, group.items);
                            return `<td class="numeric aggregation-cell">${agg !== null ? formatAggregationValue(agg, col) : ''}</td>`;
                        }).join('')}
                    `;
                }
                
                tableBody.appendChild(groupAggRow);
            }
        }
    });
    
    // Add table aggregation row if any column has table aggregation enabled
    if (hasTableAggregation()) {
        const allData = getSortedData();
        const aggregationRow = document.createElement('tr');
        aggregationRow.className = 'table-aggregation-row';
        
        // Calculate aggregations for each column
        const categoryAgg = getTableAggregationValue('category', allData);
        const publisherAgg = getTableAggregationValue('publisher', allData);
        const q1Agg = getTableAggregationValue('q1_2024', allData);
        const q2Agg = getTableAggregationValue('q2_2024', allData);
        const q3Agg = getTableAggregationValue('q3_2024', allData);
        const q4Agg = getTableAggregationValue('q4_2024', allData);
        
        aggregationRow.innerHTML = `
            <td class="aggregation-cell">${categoryAgg !== null ? formatAggregationValue(categoryAgg, 'category') : ''}</td>
            <td class="aggregation-cell">${publisherAgg !== null ? formatAggregationValue(publisherAgg, 'publisher') : ''}</td>
            <td class="numeric aggregation-cell">${q1Agg !== null ? formatAggregationValue(q1Agg, 'q1_2024') : ''}</td>
            <td class="numeric aggregation-cell">${q2Agg !== null ? formatAggregationValue(q2Agg, 'q2_2024') : ''}</td>
            <td class="numeric aggregation-cell">${q3Agg !== null ? formatAggregationValue(q3Agg, 'q3_2024') : ''}</td>
            <td class="numeric aggregation-cell">${q4Agg !== null ? formatAggregationValue(q4Agg, 'q4_2024') : ''}</td>
        `;
        
        tableBody.appendChild(aggregationRow);
    }
}

// Cell Selection Functions

// Set up cell selection event listeners
function setupCellSelectionListeners() {
    // Copy functionality
    document.addEventListener('keydown', handleCopyKeydown);
    
    // Global mouse up event (in case user releases mouse outside table)
    document.addEventListener('mouseup', handleGlobalMouseUp);
    
    // Global click handler to clear selection when clicking outside table
    document.addEventListener('click', handleGlobalClick);
    
    // Table mouse events for cell selection (will be added to table after render)
    setupTableSelectionEvents();
}

// Setup table-specific selection events (called after table render)
function setupTableSelectionEvents() {
    const table = document.getElementById('orders-table');
    if (!table) return;
    
    // Remove existing listeners to avoid duplicates
    table.removeEventListener('mousedown', handleTableMouseDown);
    table.removeEventListener('mousemove', handleTableMouseMove);
    table.removeEventListener('mouseup', handleTableMouseUp);
    table.removeEventListener('contextmenu', handleTableContextMenu);
    
    // Add fresh listeners
    table.addEventListener('mousedown', handleTableMouseDown);
    table.addEventListener('mousemove', handleTableMouseMove);
    table.addEventListener('mouseup', handleTableMouseUp);
    table.addEventListener('contextmenu', handleTableContextMenu);
    
    // Prevent text selection during cell selection
    table.addEventListener('selectstart', handleSelectStart);
}

// Handle copy keyboard shortcuts
function handleCopyKeydown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'c' && selectedCells.size > 0) {
        event.preventDefault();
        copySelectedCells();
    }
}

// Handle mouse down on table
function handleTableMouseDown(event) {
    // Only handle left clicks on table cells
    if (event.button !== 0) return;
    
    const cell = event.target.closest('td');
    if (!cell) return;
    
    // Don't start selection if clicking on group toggle controls
    if (event.target.closest('.group-cell-content')) return;
    
    // Clear any existing selection (but allow the click to proceed)
    clearSelection();
    
    // Start new selection
    const position = getCellPosition(cell);
    if (position) {
        isSelecting = true;
        selectionStart = { ...position, cell };
        selectionEnd = { ...position, cell };
        
        // Add selecting class to table wrapper
        const tableWrapper = document.querySelector('.table-wrapper');
        if (tableWrapper) {
            tableWrapper.classList.add('selecting');
        }
        
        // Add initial cell to selection
        addCellToSelection(cell);
        
        event.preventDefault();
    }
}

// Handle mouse move for drag selection
function handleTableMouseMove(event) {
    if (!isSelecting || !selectionStart) return;
    
    const cell = event.target.closest('td');
    if (!cell) return;
    
    const position = getCellPosition(cell);
    if (!position) return;
    
    // Update selection end position
    selectionEnd = { ...position, cell };
    
    // Update visual selection
    updateSelection();
    
    event.preventDefault();
}

// Handle mouse up to end selection
function handleTableMouseUp(event) {
    if (isSelecting) {
        isSelecting = false;
        
        // Remove selecting class from table wrapper
        const tableWrapper = document.querySelector('.table-wrapper');
        if (tableWrapper) {
            tableWrapper.classList.remove('selecting');
        }
        
        event.preventDefault();
    }
}

// Handle global mouse up (for when user releases outside table)
function handleGlobalMouseUp(event) {
    if (isSelecting) {
        isSelecting = false;
        
        // Remove selecting class from table wrapper
        const tableWrapper = document.querySelector('.table-wrapper');
        if (tableWrapper) {
            tableWrapper.classList.remove('selecting');
        }
    }
}

// Handle global click (clear selection when clicking outside table)
function handleGlobalClick(event) {
    // Don't clear selection if we're currently selecting (dragging)
    if (isSelecting) return;
    
    // Don't clear selection if clicking on table or its controls
    const table = document.getElementById('orders-table');
    const contextMenus = document.querySelectorAll('.context-menu, .selection-context-menu');
    const builderPanel = document.querySelector('.builder-panel');
    
    if (table && table.contains(event.target)) return;
    
    // Don't clear if clicking on context menus
    for (const menu of contextMenus) {
        if (menu.contains(event.target)) return;
    }
    
    // Don't clear if clicking on builder panel
    if (builderPanel && builderPanel.contains(event.target)) return;
    
    // Clear selection if clicking anywhere else
    if (selectedCells.size > 0) {
        clearSelection();
    }
}

// Handle context menu for selected cells
function handleTableContextMenu(event) {
    const cell = event.target.closest('td');
    if (!cell || selectedCells.size === 0) return;
    
    // Only show context menu if right-clicking on a selected cell
    if (!selectedCells.has(cell)) return;
    
    event.preventDefault();
    showSelectionContextMenu(event.clientX, event.clientY);
}

// Prevent text selection during cell selection
function handleSelectStart(event) {
    if (isSelecting) {
        event.preventDefault();
    }
}

// Get cell position (row, col) in the table - updated for pivot structure
function getCellPosition(cell) {
    const row = cell.parentElement;
    if (!row) return null;
    
    const tbody = row.parentElement;
    if (!tbody) return null;
    
    const rowIndex = Array.from(tbody.children).indexOf(row);
    
    // Handle different row types for column calculation
    let colIndex;
    
    if (!groupBy) {
        // Flat table - simple column index
        colIndex = Array.from(row.children).indexOf(cell);
    } else {
        // Grouped table - need to calculate logical column position
        colIndex = getLogicalColumnIndex(cell, row);
    }
    
    return { row: rowIndex, col: colIndex };
}

// Get logical column index for grouped table accounting for rowspan - updated for pivot structure
function getLogicalColumnIndex(cell, row) {
    const cellIndex = Array.from(row.children).indexOf(cell);
    
    // Check if this is a group row (collapsed)
    if (row.classList.contains('group-row')) {
        return cellIndex; // Group rows have normal 6-column structure for pivot
    }
    
    // Check if this is an expanded group row
    if (row.classList.contains('child-row') && row.classList.contains('expanded')) {
        const cells = Array.from(row.children);
        
        if (cells.length === 6) {
            // First row of expanded group with rowspan - normal indexing
            return cellIndex;
        } else if (cells.length === 5) {
            // Subsequent row of expanded group - missing grouped column
            if (groupBy === 'category') {
                // [publisher, q1, q2, q3, q4] - add 1 to account for missing category column
                return cellIndex + 1;
            } else if (groupBy === 'publisher') {
                // [category, q1, q2, q3, q4] - if cellIndex is 0, it's category (col 0)
                // if cellIndex is 1+, it's quarters (col 2+)
                return cellIndex === 0 ? 0 : cellIndex + 1;
            } else if (QUARTER_COLUMNS.includes(groupBy)) {
                // Missing one of the quarter columns
                const quarterIndex = QUARTER_COLUMNS.indexOf(groupBy);
                if (cellIndex < 2) {
                    // Category or publisher
                    return cellIndex;
                } else {
                    // Quarter columns - adjust based on which quarter is grouped
                    const adjustedIndex = cellIndex - 2; // Remove category/publisher offset
                    let logicalQuarterIndex = 0;
                    for (let i = 0; i < QUARTER_COLUMNS.length; i++) {
                        if (i === quarterIndex) continue; // Skip grouped quarter
                        if (logicalQuarterIndex === adjustedIndex) {
                            return 2 + i; // Return actual quarter column index
                        }
                        logicalQuarterIndex++;
                    }
                }
            }
        }
    }
    
    // Fallback to simple indexing
    return cellIndex;
}

// Add cell to selection
function addCellToSelection(cell) {
    cell.classList.add('selected-cell');
    selectedCells.add(cell);
}

// Remove cell from selection
function removeCellFromSelection(cell) {
    cell.classList.remove('selected-cell');
    selectedCells.delete(cell);
}

// Clear all selection
function clearSelection() {
    selectedCells.forEach(cell => {
        cell.classList.remove('selected-cell');
    });
    selectedCells.clear();
    selectionStart = null;
    selectionEnd = null;
    hideSelectionContextMenu();
}

// Update selection based on start and end positions
function updateSelection() {
    if (!selectionStart || !selectionEnd) return;
    
    // Clear current selection
    selectedCells.forEach(cell => {
        cell.classList.remove('selected-cell');
    });
    selectedCells.clear();
    
    // Calculate selection bounds
    const startRow = Math.min(selectionStart.row, selectionEnd.row);
    const endRow = Math.max(selectionStart.row, selectionEnd.row);
    const startCol = Math.min(selectionStart.col, selectionEnd.col);
    const endCol = Math.max(selectionStart.col, selectionEnd.col);
    
    // Select cells in rectangular range
    const tbody = document.querySelector('#orders-table tbody');
    if (!tbody) return;
    
    const rows = Array.from(tbody.children);
    for (let rowIdx = startRow; rowIdx <= endRow && rowIdx < rows.length; rowIdx++) {
        const row = rows[rowIdx];
        const cells = Array.from(row.children);
        
        // For each cell in the row, check if its logical column position falls within selection
        cells.forEach((cell, physicalIndex) => {
            if (cell && cell.tagName === 'TD') {
                const logicalCol = groupBy ? getLogicalColumnIndex(cell, row) : physicalIndex;
                
                // Add cell to selection if its logical column is within bounds
                if (logicalCol >= startCol && logicalCol <= endCol) {
                    addCellToSelection(cell);
                }
            }
        });
    }
}

// Copy selected cells to clipboard
function copySelectedCells() {
    if (selectedCells.size === 0) return;
    
    // Get selection bounds and organize cells by position
    const cellPositions = Array.from(selectedCells).map(cell => ({
        cell,
        position: getCellPosition(cell)
    })).filter(item => item.position);
    
    if (cellPositions.length === 0) return;
    
    // Sort by row then column
    cellPositions.sort((a, b) => {
        if (a.position.row !== b.position.row) {
            return a.position.row - b.position.row;
        }
        return a.position.col - b.position.col;
    });
    
    // Group by rows
    const rowGroups = {};
    cellPositions.forEach(({ cell, position }) => {
        if (!rowGroups[position.row]) {
            rowGroups[position.row] = [];
        }
        rowGroups[position.row].push({ cell, col: position.col });
    });
    
    // Build clipboard text
    const rows = Object.keys(rowGroups).sort((a, b) => parseInt(a) - parseInt(b));
    const clipboardRows = rows.map(rowKey => {
        const rowCells = rowGroups[rowKey].sort((a, b) => a.col - b.col);
        return rowCells.map(({ cell }) => {
            // Get clean text content, handling group cells and special content
            let text = cell.textContent || '';
            // Remove group chevrons and extra whitespace
            text = text.replace(/[▸▾]/g, '').trim();
            // Handle numeric formatting
            if (cell.classList.contains('numeric')) {
                text = text.replace(/,/g, ''); // Remove thousands separators
            }
            return text;
        }).join('\t');
    });
    
    const clipboardText = clipboardRows.join('\n');
    
    // Copy to clipboard
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(clipboardText).then(() => {
            showCopyFeedback();
        }).catch(err => {
            console.warn('Failed to copy to clipboard:', err);
            fallbackCopyToClipboard(clipboardText);
        });
    } else {
        fallbackCopyToClipboard(clipboardText);
    }
}

// Fallback copy method for browsers without clipboard API
function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showCopyFeedback();
    } catch (err) {
        console.warn('Failed to copy to clipboard:', err);
    }
    
    document.body.removeChild(textArea);
}

// Show visual feedback for copy operation
function showCopyFeedback(type = '') {
    // Create temporary feedback element
    const feedback = document.createElement('div');
    const message = type ? `Copied ${selectedCells.size} cells ${type}` : `Copied ${selectedCells.size} cells`;
    feedback.textContent = message;
    feedback.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #2563eb;
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 13px;
        z-index: 10000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        animation: fadeInOut 2s ease-in-out;
    `;
    
    // Add fade animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translateY(-10px); }
            20% { opacity: 1; transform: translateY(0); }
            80% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-10px); }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(feedback);
    
    // Remove after animation
    setTimeout(() => {
        if (feedback.parentNode) {
            feedback.parentNode.removeChild(feedback);
        }
        if (style.parentNode) {
            style.parentNode.removeChild(style);
        }
    }, 2000);
}

// Show selection context menu
function showSelectionContextMenu(x, y) {
    hideSelectionContextMenu();
    
    const menu = document.createElement('div');
    menu.className = 'selection-context-menu';
    menu.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        background: white;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        padding: 4px 0;
        min-width: 160px;
        z-index: 1000;
        font-size: 13px;
    `;
    
    // Copy option
    const copyOption = document.createElement('button');
    copyOption.className = 'menu-item';
    copyOption.innerHTML = `Copy (${selectedCells.size} cells)`;
    copyOption.addEventListener('click', () => {
        copySelectedCells();
        hideSelectionContextMenu();
    });
    
    // Copy with headers option (if applicable)
    const copyWithHeadersOption = document.createElement('button');
    copyWithHeadersOption.className = 'menu-item';
    copyWithHeadersOption.innerHTML = 'Copy with Headers';
    copyWithHeadersOption.addEventListener('click', () => {
        copySelectedCellsWithHeaders();
        hideSelectionContextMenu();
    });
    
    menu.appendChild(copyOption);
    menu.appendChild(copyWithHeadersOption);
    
    document.body.appendChild(menu);
    selectionContextMenu = menu;
    
    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', hideSelectionContextMenu, { once: true });
    }, 0);
}

// Hide selection context menu
function hideSelectionContextMenu() {
    if (selectionContextMenu) {
        selectionContextMenu.remove();
        selectionContextMenu = null;
    }
}

// Copy selected cells with column headers - updated for pivot structure
function copySelectedCellsWithHeaders() {
    if (selectedCells.size === 0) return;
    
    // Get column headers for pivot table
    const headers = ['Category', 'Publisher', 'Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024'];
    
    // Get selection bounds and organize cells by position
    const cellPositions = Array.from(selectedCells).map(cell => ({
        cell,
        position: getCellPosition(cell)
    })).filter(item => item.position);
    
    if (cellPositions.length === 0) return;
    
    // Sort by row then column
    cellPositions.sort((a, b) => {
        if (a.position.row !== b.position.row) {
            return a.position.row - b.position.row;
        }
        return a.position.col - b.position.col;
    });
    
    // Get column bounds
    const minCol = Math.min(...cellPositions.map(item => item.position.col));
    const maxCol = Math.max(...cellPositions.map(item => item.position.col));
    
    // Build header row
    const headerRow = [];
    for (let col = minCol; col <= maxCol && col < headers.length; col++) {
        headerRow.push(headers[col]);
    }
    
    // Group by rows for data
    const rowGroups = {};
    cellPositions.forEach(({ cell, position }) => {
        if (!rowGroups[position.row]) {
            rowGroups[position.row] = [];
        }
        rowGroups[position.row].push({ cell, col: position.col });
    });
    
    // Build data rows
    const rows = Object.keys(rowGroups).sort((a, b) => parseInt(a) - parseInt(b));
    const dataRows = rows.map(rowKey => {
        const rowCells = rowGroups[rowKey].sort((a, b) => a.col - b.col);
        const rowData = [];
        
        // Fill in data for each column in the selection
        for (let col = minCol; col <= maxCol; col++) {
            const cellData = rowCells.find(item => item.col === col);
            if (cellData) {
                let text = cellData.cell.textContent || '';
                // Remove group chevrons and extra whitespace
                text = text.replace(/[▸▾]/g, '').trim();
                // Handle numeric formatting
                if (cellData.cell.classList.contains('numeric')) {
                    text = text.replace(/,/g, ''); // Remove thousands separators
                }
                rowData.push(text);
            } else {
                rowData.push(''); // Empty cell
            }
        }
        
        return rowData.join('\t');
    });
    
    // Combine header and data
    const clipboardText = [headerRow.join('\t'), ...dataRows].join('\n');
    
    // Copy to clipboard
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(clipboardText).then(() => {
            showCopyFeedback('with headers');
        }).catch(err => {
            console.warn('Failed to copy to clipboard:', err);
            fallbackCopyToClipboard(clipboardText);
        });
    } else {
        fallbackCopyToClipboard(clipboardText);
    }
}

// Handle group aggregation submenu click
function handleGroupAggregationSubmenu(event) {
    event.preventDefault();
    event.stopPropagation();
    
    hideAllSubmenus();
    
    const submenu = document.getElementById('group-aggregation-submenu');
    const rect = event.currentTarget.getBoundingClientRect();
    
    submenu.style.left = `${rect.right + 5}px`;
    submenu.style.top = `${rect.top}px`;
    submenu.style.display = 'block';
    
    updateAggregationSubmenuState('group');
}

// Handle table aggregation submenu click
function handleTableAggregationSubmenu(event) {
    event.preventDefault();
    event.stopPropagation();
    
    hideAllSubmenus();
    
    const submenu = document.getElementById('table-aggregation-submenu');
    const rect = event.currentTarget.getBoundingClientRect();
    
    submenu.style.left = `${rect.right + 5}px`;
    submenu.style.top = `${rect.top}px`;
    submenu.style.display = 'block';
    
    updateAggregationSubmenuState('table');
}

// Handle aggregation option selection
function handleAggregationOption(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const type = event.currentTarget.dataset.type; // 'group' or 'table'
    const functionName = event.currentTarget.dataset.function;
    const column = currentMenuColumn;
    
    if (!column) return;
    
    // For metric columns, apply aggregation to all quarter columns
    const columnsToUpdate = isNumericColumn(column) ? QUARTER_COLUMNS : [column];
    
    columnsToUpdate.forEach(col => {
        // Initialize aggregation state for column if needed
        if (!aggregationStates[col]) {
            aggregationStates[col] = {};
        }
        
        // Update aggregation state
        if (functionName === 'none') {
            delete aggregationStates[col][type + 'Aggregation'];
        } else {
            aggregationStates[col][type + 'Aggregation'] = { function: functionName };
        }
        
        // Clean up empty column states
        if (Object.keys(aggregationStates[col]).length === 0) {
            delete aggregationStates[col];
        }
    });
    
    saveAggregationPreferences();
    hideContextMenu();
    renderTable();
}

// Update aggregation menu state to show current selections
function updateAggregationMenuState(column) {
    const columnState = aggregationStates[column] || {};
    
    // Update group aggregation indicator
    const groupItem = document.getElementById('group-aggregation-item');
    const groupFunction = columnState.groupAggregation?.function;
    if (groupFunction) {
        groupItem.innerHTML = `<span>Aggregate by Group (${groupFunction})</span><span class="submenu-arrow">▸</span>`;
    } else {
        groupItem.innerHTML = `<span>Aggregate by Group</span><span class="submenu-arrow">▸</span>`;
    }
    
    // Update table aggregation indicator
    const tableItem = document.getElementById('table-aggregation-item');
    const tableFunction = columnState.tableAggregation?.function;
    if (tableFunction) {
        tableItem.innerHTML = `<span>Aggregate Entire Table (${tableFunction})</span><span class="submenu-arrow">▸</span>`;
    } else {
        tableItem.innerHTML = `<span>Aggregate Entire Table</span><span class="submenu-arrow">▸</span>`;
    }
}

// Update aggregation submenu state to show checkmarks
function updateAggregationSubmenuState(type) {
    const column = currentMenuColumn;
    const columnState = aggregationStates[column] || {};
    const currentFunction = columnState[type + 'Aggregation']?.function || 'none';
    
    const submenuId = type === 'group' ? 'group-aggregation-submenu' : 'table-aggregation-submenu';
    const submenu = document.getElementById(submenuId);
    
    // Clear all checkmarks
    submenu.querySelectorAll('.checkmark').forEach(checkmark => {
        checkmark.style.display = 'none';
    });
    
    // Show checkmark for current selection
    const currentOption = submenu.querySelector(`[data-function="${currentFunction}"]`);
    if (currentOption) {
        const checkmark = currentOption.querySelector('.checkmark');
        if (checkmark) {
            checkmark.style.display = 'inline';
        }
    }
}

// Check if any table aggregation is enabled
function hasTableAggregation() {
    return Object.values(aggregationStates).some(columnState => 
        columnState.tableAggregation
    );
}

// Check if any group aggregation is enabled
function hasGroupAggregation() {
    return Object.values(aggregationStates).some(columnState => 
        columnState.groupAggregation
    );
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', init); 