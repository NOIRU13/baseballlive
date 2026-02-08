/**
 * Admin Tab Management
 * Handles tab switching and window resizing.
 */
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    
    // Default to 'simple' tab
    openTab('simple');
});

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
             const target = tab.dataset.tab;
             openTab(target);
        });
    });
}

function openTab(tabName) {
    // 1. Activate Tab Button
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // 2. Show Content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabName}`);
    });

    // 3. Resize Window
    resizeWindowForTab(tabName);
}

function resizeWindowForTab(tabName) {
    let width, height;

    switch (tabName) {
        case 'simple':
            width = 800;
            height = 630; // Slightly taller for tabs
            break;
        case 'lineup':
            width = 1200;
            height = 800;
            break;
        case 'db':
            width = 1000;
            height = 800;
            break;
        case 'control':
            width = 1200;
            height = 850;
            break;
        default:
            width = 800;
            height = 600;
    }

    // Attempt to resize (may be blocked by browser constraints if not opened via window.open)
    try {
        window.resizeTo(width, height);
    } catch (e) {
        console.warn('Failed to resize window:', e);
    }
}
