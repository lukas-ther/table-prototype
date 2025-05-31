// Hard-coded data
const data = [
    { category: "Books", publisher: "Simon & Schuster", orders: 8234 },
    { category: "Books", publisher: "Penguin Random House", orders: 6789 },
    { category: "Books", publisher: "HarperCollins", orders: 4853 },
    { category: "Games", publisher: "Humble Games", orders: 5567 },
    { category: "Games", publisher: "Epic Odyssey Interactive Entertainment Studios", orders: 2890 },
    { category: "Games", publisher: "Annapurna Interactive", orders: 2777 }
];

// Application state
let sortStates = []; // Array of sort states: [{ column: 'category', direction: 'asc', priority: 1 }, ...]
let groupBy = null; // null or column name
let collapsedGroups = new Set(); // Track which groups are collapsed
let textWrapStates = {}; // Track which columns have text wrapping enabled
let currentMenuColumn = null; // Track which column's menu is currently open

// New aggregation state
let aggregationStates = {}; // Track aggregation settings per column: { column: { groupAggregation: { function: 'sum' }, tableAggregation: { function: 'sum' } } }

// DOM elements
const tableBody = document.getElementById('table-body');
const contextMenu = document.getElementById('context-menu');
const groupAction = document.getElementById('group-action');
const wrapToggle = document.getElementById('wrap-toggle');

// Column indices for applying classes
const COLUMN_INDICES = {
    category: 0,
    publisher: 1,
    orders: 2
};

// Aggregation functions
const AGGREGATION_FUNCTIONS = {
    sum: (values) => values.reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0),
    average: (values) => {
        const nums = values.filter(val => typeof val === 'number');
        return nums.length > 0 ? nums.reduce((sum, val) => sum + val, 0) / nums.length : 0;
    },
    count: (values) => values.length
};

// Check if a column contains numeric data
function isNumericColumn(column) {
    return column === 'orders'; // Only orders column is numeric in our data
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
        const indicator = button.querySelector('.sort-indicator');
        
        const arrow = sortState.direction === 'asc' ? '▲' : '▼';
        const priority = sortState.priority;
        
        // Use superscript numbers for cleaner look
        const superscriptNumbers = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
        const prioritySymbol = priority <= 9 ? superscriptNumbers[priority] : priority.toString();
        
        indicator.textContent = arrow + prioritySymbol;
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
    
    // Update group action button
    if (isCurrentlyGrouped) {
        groupAction.textContent = 'Ungroup';
        groupAction.dataset.action = 'ungroup';
    } else {
        groupAction.textContent = `Group by ${column}`;
        groupAction.dataset.action = 'group';
    }
    
    groupAction.dataset.column = column;
    
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

// Apply text wrap classes to all cells in the table
function applyTextWrapClasses() {
    console.log('Applying text wrap classes:', textWrapStates); // Debug log
    
    const table = document.getElementById('orders-table');
    const rows = table.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        cells.forEach((cell, index) => {
            // Map cell index to column name
            let column;
            switch(index) {
                case 0:
                    column = 'category';
                    break;
                case 1:
                    column = 'publisher';
                    break;
                case 2:
                    column = 'orders';
                    break;
                default:
                    return; // Skip if unknown column
            }
            
            // Remove both classes first
            cell.classList.remove('cell-clip', 'cell-wrap');
            
            // Apply appropriate class based on current state
            if (textWrapStates[column]) {
                cell.classList.add('cell-wrap');
                console.log(`Applied cell-wrap to ${column} cell`); // Debug log
            } else {
                cell.classList.add('cell-clip');
                console.log(`Applied cell-clip to ${column} cell`); // Debug log
            }
        });
    });
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

// Get multi-column sorted data
function getSortedData() {
    if (sortStates.length === 0) {
        return [...data];
    }
    
    return [...data].sort((a, b) => {
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
            groups.set(key, { key, items: [], total: 0 });
        }
        groups.get(key).items.push(item);
        groups.get(key).total += item.orders;
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
    
    // For orders column, format as integer with thousands separator
    if (column === 'orders') {
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

// Check if any table aggregation is enabled
function hasTableAggregation() {
    return Object.values(aggregationStates).some(columnState => 
        columnState.tableAggregation
    );
}

// Handle group row click (toggle collapse)
function handleGroupToggle(event) {
    const groupKey = event.currentTarget.dataset.groupKey;
    
    if (collapsedGroups.has(groupKey)) {
        collapsedGroups.delete(groupKey);
    } else {
        collapsedGroups.add(groupKey);
    }
    
    renderTable();
}

// Render the table
function renderTable() {
    tableBody.innerHTML = '';
    
    if (groupBy) {
        renderGroupedTable();
    } else {
        renderFlatTable();
    }
    
    // Apply text wrap classes after rendering
    requestAnimationFrame(() => {
        applyTextWrapClasses();
    });
}

// Render flat table (no grouping)
function renderFlatTable() {
    const sortedData = getSortedData();
    
    sortedData.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.category}</td>
            <td>${item.publisher}</td>
            <td class="numeric">${formatNumber(item.orders)}</td>
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
        const ordersAgg = getTableAggregationValue('orders', sortedData);
        
        aggregationRow.innerHTML = `
            <td class="aggregation-cell">${categoryAgg !== null ? formatAggregationValue(categoryAgg, 'category') : ''}</td>
            <td class="aggregation-cell">${publisherAgg !== null ? formatAggregationValue(publisherAgg, 'publisher') : ''}</td>
            <td class="numeric aggregation-cell">${ordersAgg !== null ? formatAggregationValue(ordersAgg, 'orders') : ''}</td>
        `;
        
        tableBody.appendChild(aggregationRow);
    }
}

// Render grouped table with improved hierarchy
function renderGroupedTable() {
    const groups = getGroups();
    
    groups.forEach(group => {
        // Create group header row - shows the group value and total
        const groupRow = document.createElement('tr');
        groupRow.className = 'group-row group-parent';
        groupRow.dataset.groupKey = group.key;
        groupRow.addEventListener('click', handleGroupToggle);
        
        const isCollapsed = collapsedGroups.has(group.key);
        const chevron = isCollapsed ? '▸' : '▾';
        
        // Build group row HTML based on which column we're grouping by
        if (groupBy === 'category') {
            // When grouping by category, show category name in first column
            const ordersAggregation = getGroupAggregationValue('orders', group.items);
            groupRow.innerHTML = `
                <td>
                    <span class="group-chevron ${isCollapsed ? '' : 'expanded'}">${chevron}</span>
                    <span class="group-name">${group.key}</span>
                </td>
                <td></td>
                <td class="numeric">
                    <span class="group-total">${ordersAggregation !== null ? formatAggregationValue(ordersAggregation, 'orders') : ''}</span>
                </td>
            `;
        } else if (groupBy === 'publisher') {
            // When grouping by publisher, show publisher name in second column
            const ordersAggregation = getGroupAggregationValue('orders', group.items);
            groupRow.innerHTML = `
                <td></td>
                <td>
                    <span class="group-chevron ${isCollapsed ? '' : 'expanded'}">${chevron}</span>
                    <span class="group-name">${group.key}</span>
                </td>
                <td class="numeric">
                    <span class="group-total">${ordersAggregation !== null ? formatAggregationValue(ordersAggregation, 'orders') : ''}</span>
                </td>
            `;
        } else if (groupBy === 'orders') {
            // When grouping by orders, show orders value in third column
            groupRow.innerHTML = `
                <td></td>
                <td></td>
                <td class="numeric">
                    <span class="group-chevron ${isCollapsed ? '' : 'expanded'}">${chevron}</span>
                    <span class="group-name">${formatNumber(group.key)}</span>
                    <span class="group-total"> (${group.items.length} items)</span>
                </td>
            `;
        }
        
        tableBody.appendChild(groupRow);
        
        // Add child rows if not collapsed - with empty cell in the grouped column
        if (!isCollapsed) {
            group.items.forEach(item => {
                const childRow = document.createElement('tr');
                childRow.className = 'child-row group-child';
                
                // Build child row HTML with empty cell in the grouped column
                if (groupBy === 'category') {
                    // When grouped by category, leave category column empty
                    childRow.innerHTML = `
                        <td></td>
                        <td>${item.publisher}</td>
                        <td class="numeric">${formatNumber(item.orders)}</td>
                    `;
                } else if (groupBy === 'publisher') {
                    // When grouped by publisher, leave publisher column empty
                    childRow.innerHTML = `
                        <td>${item.category}</td>
                        <td></td>
                        <td class="numeric">${formatNumber(item.orders)}</td>
                    `;
                } else if (groupBy === 'orders') {
                    // When grouped by orders, leave orders column empty (rare case)
                    childRow.innerHTML = `
                        <td>${item.category}</td>
                        <td>${item.publisher}</td>
                        <td class="numeric"></td>
                    `;
                }
                
                tableBody.appendChild(childRow);
            });
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
        const ordersAgg = getTableAggregationValue('orders', allData);
        
        aggregationRow.innerHTML = `
            <td class="aggregation-cell">${categoryAgg !== null ? formatAggregationValue(categoryAgg, 'category') : ''}</td>
            <td class="aggregation-cell">${publisherAgg !== null ? formatAggregationValue(publisherAgg, 'publisher') : ''}</td>
            <td class="numeric aggregation-cell">${ordersAgg !== null ? formatAggregationValue(ordersAgg, 'orders') : ''}</td>
        `;
        
        tableBody.appendChild(aggregationRow);
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
    
    // Initialize aggregation state for column if needed
    if (!aggregationStates[column]) {
        aggregationStates[column] = {};
    }
    
    // Update aggregation state
    if (functionName === 'none') {
        delete aggregationStates[column][type + 'Aggregation'];
    } else {
        aggregationStates[column][type + 'Aggregation'] = { function: functionName };
    }
    
    // Clean up empty column states
    if (Object.keys(aggregationStates[column]).length === 0) {
        delete aggregationStates[column];
    }
    
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

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', init); 