export class ProjectBrowser {
  /**
   * @param {HTMLElement} container 
   * @param {import('../../engine/AssetManager.js').AssetManager} assetManager 
   */
  constructor(container, assetManager) {
    this.container = container;
    this.assetManager = assetManager;
    
    this._render();
    this._bindEvents();
    this.refresh();
  }

  _render() {
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.height = '100%';
    this.container.innerHTML = `
      <div class="project-toolbar" style="padding: 5px 10px; background: #2a2a35; border-bottom: 1px solid #1a1a25; display: flex; gap: 10px;">
        <button id="btn-import-asset" class="btn btn-small">Import Asset</button>
        <span style="color: #888; font-size: 12px; align-self: center;">Drag & Drop files here (PNG, GLB, MP3)</span>
        <input type="file" id="file-import" style="display:none;" multiple />
      </div>
      <div id="asset-grid" style="flex: 1; padding: 10px; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 10px; align-content: start;">
      </div>
    `;
    this.gridEl = this.container.querySelector('#asset-grid');
    this.fileInput = this.container.querySelector('#file-import');
  }

  _bindEvents() {
    this.container.querySelector('#btn-import-asset').addEventListener('click', () => {
      this.fileInput.click();
    });

    this.fileInput.addEventListener('change', async (e) => {
      if (e.target.files.length > 0) {
        for (const file of e.target.files) {
          await this.assetManager.importAsset(file);
        }
        this.refresh();
      }
      this.fileInput.value = '';
    });

    // Drag & Drop to container
    this.container.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.container.style.backgroundColor = '#3a3a4a';
    });
    this.container.addEventListener('dragleave', () => {
      this.container.style.backgroundColor = '';
    });
    this.container.addEventListener('drop', async (e) => {
      e.preventDefault();
      this.container.style.backgroundColor = '';
      if (e.dataTransfer.files.length > 0) {
        for (const file of e.dataTransfer.files) {
          await this.assetManager.importAsset(file);
        }
        this.refresh();
      }
    });
  }

  refresh() {
    this.gridEl.innerHTML = '';
    const assets = this.assetManager.assets;
    
    if (assets.length === 0) {
      this.gridEl.innerHTML = `<div style="grid-column: 1 / -1; color: #666; text-align: center; margin-top: 20px;">No assets imported</div>`;
      return;
    }

    assets.forEach(meta => {
      const item = document.createElement('div');
      item.style.cssText = `
        background: #2a2a35;
        border: 1px solid #3a3a45;
        border-radius: 4px;
        padding: 5px;
        display: flex;
        flex-direction: column;
        align-items: center;
        cursor: pointer;
        user-select: none;
        transition: border-color 0.2s;
      `;
      item.onmouseenter = () => item.style.borderColor = '#4a4a65';
      item.onmouseleave = () => item.style.borderColor = '#3a3a45';

      // Start drag to place in scene or apply to material
      item.draggable = true;
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'asset', id: meta.id, assetType: meta.type }));
      });

      let icon = '📄';
      if (meta.type === 'image') icon = '🖼️';
      if (meta.type === 'model') icon = '📦';
      if (meta.type === 'audio') icon = '🎵';

      item.innerHTML = `
        <div style="font-size: 32px; margin-bottom: 5px;">${icon}</div>
        <div style="font-size: 11px; text-align: center; word-break: break-all; color: #ccc;">${meta.name}</div>
        <button class="delete-btn" style="background: none; border: none; color: #e74c3c; cursor: pointer; margin-top: 5px; font-size: 10px; padding: 2px;">Delete</button>
      `;

      item.querySelector('.delete-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Delete asset ${meta.name}?`)) {
          await this.assetManager.deleteAsset(meta.id);
          this.refresh();
        }
      });

      this.gridEl.appendChild(item);
    });
  }
}
