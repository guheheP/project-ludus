/**
 * ContextMenu — Right-click context menu
 */
export class ContextMenu {
  /** @type {HTMLElement|null} */
  element = null;

  constructor() {
    // Close on any click
    document.addEventListener('click', () => this.hide());
    document.addEventListener('contextmenu', () => this.hide());
  }

  /**
   * Show context menu at position
   * @param {number} x
   * @param {number} y
   * @param {Array<{label: string, icon?: string, action?: Function, separator?: boolean, shortcut?: string}>} items
   */
  show(x, y, items) {
    this.hide();

    this.element = document.createElement('div');
    this.element.className = 'context-menu';

    items.forEach(item => {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.className = 'context-menu-separator';
        this.element.appendChild(sep);
        return;
      }

      const menuItem = document.createElement('div');
      menuItem.className = 'context-menu-item';

      if (item.icon) {
        const icon = document.createElement('span');
        icon.className = 'context-menu-item-icon';
        if (typeof item.icon === 'string') {
          icon.textContent = item.icon;
        } else {
          icon.appendChild(item.icon);
          icon.style.display = 'flex';
          icon.style.alignItems = 'center';
        }
        menuItem.appendChild(icon);
      }

      const label = document.createElement('span');
      label.textContent = item.label;
      menuItem.appendChild(label);

      if (item.shortcut) {
        const shortcut = document.createElement('span');
        shortcut.className = 'context-menu-item-shortcut';
        shortcut.textContent = item.shortcut;
        menuItem.appendChild(shortcut);
      }

      menuItem.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hide();
        if (item.action) item.action();
      });

      this.element.appendChild(menuItem);
    });

    // Position
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;

    document.body.appendChild(this.element);

    // Adjust if off screen
    requestAnimationFrame(() => {
      if (!this.element) return;
      const rect = this.element.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        this.element.style.left = `${window.innerWidth - rect.width - 4}px`;
      }
      if (rect.bottom > window.innerHeight) {
        this.element.style.top = `${window.innerHeight - rect.height - 4}px`;
      }
    });
  }

  hide() {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
  }
}
