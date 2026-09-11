// boundary is a zero-based gap in the original row (0..length).
export function insertAtBoundary(items, source, boundary) {
    if (!Number.isInteger(source) || !Number.isInteger(boundary) ||
        source < 0 || source >= items.length || boundary < 0 || boundary > items.length) {
        return items;
    }
    const destination = boundary - (source < boundary ? 1 : 0);
    if (destination === source) return items;
    const result = items.slice();
    const [item] = result.splice(source, 1);
    result.splice(destination, 0, item);
    return result;
}

const suppressedClicks = new WeakSet();

export function bindLayoutDrag(container, grid, commit) {
    let drag = null;
    let target = null;
    let pointerX = 0;
    const marker = document.createElement('div');
    marker.className = 'chrom-insertion-marker';
    marker.hidden = true;
    marker.setAttribute('aria-hidden', 'true');
    container.appendChild(marker);
    const cellFor = event => event.target.closest('[draggable="true"]');
    const clear = () => {
        grid.querySelectorAll('.dragging, .drag-col').forEach(cell => cell.classList.remove('dragging', 'drag-col'));
        marker.hidden = true;
        target = null;
        drag = null;
    };
    const valid = cell => drag && cell && grid.contains(cell) &&
        (drag.genome === undefined ? cell.dataset.genome === undefined : cell.dataset.genome === drag.genome);
    const boundary = cell => {
        const rect = cell.getBoundingClientRect();
        return Number(cell.dataset.position) - (pointerX < rect.left + rect.width / 2 ? 1 : 0);
    };
    const paint = () => {
        if (!valid(target)) { marker.hidden = true; return; }
        const rect = target.getBoundingClientRect();
        const bounds = container.getBoundingClientRect();
        const after = pointerX >= rect.left + rect.width / 2;
        const bottom = drag.genome === undefined ? grid.getBoundingClientRect().bottom - 15 : rect.bottom;
        marker.style.left = `${(after ? rect.right + 4 : rect.left - 4) - bounds.left + container.scrollLeft - container.clientLeft}px`;
        marker.style.top = `${rect.top - bounds.top + container.scrollTop - container.clientTop}px`;
        marker.style.height = `${bottom - rect.top}px`;
        marker.hidden = false;
    };
    grid.addEventListener('dragstart', event => {
        const cell = cellFor(event);
        if (!cell) return;
        drag = { genome: cell.dataset.genome, source: Number(cell.dataset.position) - 1 };
        suppressedClicks.add(container);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', cell.textContent);
        cell.classList.add('dragging');
        if (drag.genome === undefined) {
            grid.querySelectorAll(`[data-position="${drag.source + 1}"]`).forEach(node => node.classList.add('drag-col'));
        }
    });
    grid.addEventListener('dragover', event => {
        target = cellFor(event);
        pointerX = event.clientX;
        if (valid(target)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
        } else if (drag) event.dataTransfer.dropEffect = 'none';
        paint();
    });
    grid.addEventListener('dragleave', event => {
        if (!target?.contains(event.relatedTarget)) { target = null; marker.hidden = true; }
    });
    grid.addEventListener('drop', event => {
        const cell = cellFor(event);
        pointerX = event.clientX;
        const action = valid(cell) ? { ...drag, boundary: boundary(cell) } : null;
        event.preventDefault();
        clear();
        if (action) commit(action);
    });
    grid.addEventListener('dragend', clear);
    container.onpointerdown = () => { suppressedClicks.delete(container); };
    grid.addEventListener('click', event => {
        if (suppressedClicks.has(container)) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);
    container.onscroll = paint;
}
