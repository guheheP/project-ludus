import { get, set, del } from 'idb-keyval';

/**
 * AssetManager - Manages external assets (images, models, audio) via IndexedDB.
 */
export class AssetManager {
  constructor() {
    /** @type {Array<Object>} */
    this.assets = []; 
    
    /** @type {Object<string, string>} */
    this.urls = {}; // id -> blob url cache
  }

  /**
   * Initialize and load metadata from IndexedDB
   */
  async init() {
    this.assets = (await get('ludus_assets_meta')) || [];
  }

  /**
   * Import a file as an asset
   * @param {File} file 
   * @returns {Promise<Object>} The asset metadata
   */
  async importAsset(file) {
    const id = crypto.randomUUID();
    const type = this._getType(file.name);
    
    // Store blob
    const blob = new Blob([file], { type: file.type || 'application/octet-stream' });
    await set(`asset_${id}`, blob);

    // Update metadata
    const meta = { 
      id, 
      name: file.name, 
      type, 
      size: file.size, 
      timestamp: Date.now() 
    };
    this.assets.push(meta);
    await set('ludus_assets_meta', this.assets);
    
    // Cache URL
    this.urls[id] = URL.createObjectURL(blob);
    return meta;
  }

  /**
   * Delete an asset
   * @param {string} id 
   */
  async deleteAsset(id) {
    this.assets = this.assets.filter(a => a.id !== id);
    await set('ludus_assets_meta', this.assets);
    await del(`asset_${id}`);
    
    if (this.urls[id]) {
      URL.revokeObjectURL(this.urls[id]);
      delete this.urls[id];
    }
  }

  /**
   * Get the Object URL for an asset (creates it if needed)
   * @param {string} id 
   * @returns {Promise<string|null>}
   */
  async getAssetUrl(id) {
    if (this.urls[id]) return this.urls[id];
    
    const blob = await get(`asset_${id}`);
    if (!blob) return null;
    
    this.urls[id] = URL.createObjectURL(blob);
    return this.urls[id];
  }

  /**
   * Get the raw Blob for an asset
   * @param {string} id 
   * @returns {Promise<Blob|null>}
   */
  async getAssetBlob(id) {
    return await get(`asset_${id}`);
  }

  /**
   * Get metadata for an asset
   * @param {string} id 
   * @returns {Object|undefined}
   */
  getAssetMeta(id) {
    return this.assets.find(a => a.id === id);
  }

  /**
   * Determine asset type based on extension
   * @param {string} filename 
   * @returns {string} 'image' | 'model' | 'audio' | 'unknown'
   */
  _getType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'image';
    if (['gltf', 'glb'].includes(ext)) return 'model';
    if (['mp3', 'wav', 'ogg'].includes(ext)) return 'audio';
    return 'unknown';
  }
}
