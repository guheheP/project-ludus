/**
 * PanelManager — Handles resizable split panes
 */
export class PanelManager {
  constructor() {
    this._initResizeHandles();
  }

  _initResizeHandles() {
    // Left resize handle (hierarchy width)
    this._setupVerticalResize(
      'resize-left',
      'panel-hierarchy',
      { min: 160, max: 500, side: 'left' }
    );

    // Right resize handle (inspector width)
    this._setupVerticalResize(
      'resize-right',
      'panel-inspector',
      { min: 200, max: 500, side: 'right' }
    );

    // Bottom resize handle (bottom panel height)
    this._setupHorizontalResize(
      'resize-bottom',
      'panel-bottom',
      { min: 80, max: 500 }
    );
  }

  _setupVerticalResize(handleId, panelId, options) {
    const handle = document.getElementById(handleId);
    const panel = document.getElementById(panelId);
    if (!handle || !panel) return;

    let startX = 0;
    let startWidth = 0;

    const onMouseDown = (e) => {
      e.preventDefault();
      startX = e.clientX;
      startWidth = panel.getBoundingClientRect().width;

      const overlay = document.createElement('div');
      overlay.className = 'drag-overlay drag-overlay-v';
      overlay.id = 'resize-overlay';
      document.body.appendChild(overlay);

      handle.classList.add('active');

      const onMouseMove = (e) => {
        const diff = options.side === 'left'
          ? e.clientX - startX
          : startX - e.clientX;
        const newWidth = Math.max(options.min, Math.min(options.max, startWidth + diff));
        panel.style.width = `${newWidth}px`;
        // Dispatch resize event for scene view
        window.dispatchEvent(new Event('resize'));
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        handle.classList.remove('active');
        const overlay = document.getElementById('resize-overlay');
        if (overlay) overlay.remove();
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    handle.addEventListener('mousedown', onMouseDown);
  }

  _setupHorizontalResize(handleId, panelId, options) {
    const handle = document.getElementById(handleId);
    const panel = document.getElementById(panelId);
    if (!handle || !panel) return;

    let startY = 0;
    let startHeight = 0;

    const onMouseDown = (e) => {
      e.preventDefault();
      startY = e.clientY;
      startHeight = panel.getBoundingClientRect().height;

      const overlay = document.createElement('div');
      overlay.className = 'drag-overlay drag-overlay-h';
      overlay.id = 'resize-overlay';
      document.body.appendChild(overlay);

      handle.classList.add('active');

      const onMouseMove = (e) => {
        const diff = startY - e.clientY;
        const newHeight = Math.max(options.min, Math.min(options.max, startHeight + diff));
        panel.style.height = `${newHeight}px`;
        window.dispatchEvent(new Event('resize'));
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        handle.classList.remove('active');
        const overlay = document.getElementById('resize-overlay');
        if (overlay) overlay.remove();
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    handle.addEventListener('mousedown', onMouseDown);
  }
}
