import * as monaco from 'monaco-editor';
import { DEFAULT_SCRIPT } from '../../engine/components/Script.js';

// Configure Monaco workers for Vite
self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'javascript' || label === 'typescript') {
      return new Worker(
        new URL('monaco-editor/esm/vs/language/typescript/ts.worker.js', import.meta.url),
        { type: 'module' }
      );
    }
    return new Worker(
      new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url),
      { type: 'module' }
    );
  },
};

// Ludus API type definitions for IntelliSense
const LUDUS_API_TYPES = `
declare interface Vec3 {
  x: number;
  y: number;
  z: number;
}

declare interface EntityRef {
  name: string;
  id: number;
  object3D: any;
}

declare interface TransformAPI {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  setPosition(x: number, y: number, z: number): void;
  setScale(x: number, y: number, z: number): void;
}

declare interface SceneAPI {
  name: string;
  find(name: string): EntityRef | null;
}

declare interface InputAPI {
  isKeyDown(key: string): boolean;
  isKeyPressed(key: string): boolean;
  isKeyReleased(key: string): boolean;
  mouse: { x: number; y: number };
  mouseLeft: boolean;
  mouseRight: boolean;
}

declare interface TimeAPI {
  dt: number;
  elapsed: number;
  frame: number;
}

declare interface RigidbodyAPI {
  addForce(x: number, y: number, z: number): void;
  addImpulse(x: number, y: number, z: number): void;
  setVelocity(x: number, y: number, z: number): void;
  setAngularVelocity(x: number, y: number, z: number): void;
  velocity: Vec3;
}

declare interface AudioAPI {
  play(): void;
  stop(): void;
  setVolume(v: number): void;
}

declare interface CollisionInfo {
  entity: EntityRef;
}

declare interface UIAPI {
  createText(text: string, options?: { x?: number; y?: number; fontSize?: number; color?: string; fontWeight?: string; id?: string }): string;
  createButton(label: string, onClick: () => void, options?: { x?: number; y?: number; width?: number; height?: number; bgColor?: string; color?: string; id?: string }): string;
  createProgressBar(value: number, options?: { x?: number; y?: number; width?: number; height?: number; fillColor?: string; id?: string }): string;
  createImage(src: string, options?: { x?: number; y?: number; width?: number; height?: number; id?: string }): string;
  updateText(id: string, newText: string): void;
  updateProgressBar(id: string, value: number): void;
  setPosition(id: string, x: number, y: number): void;
  setVisible(id: string, visible: boolean): void;
  removeElement(id: string): void;
  clearAll(): void;
}

declare const entity: EntityRef;
declare const transform: TransformAPI;
declare const scene: SceneAPI;
declare const input: InputAPI;
declare const time: TimeAPI;
declare const rigidbody: RigidbodyAPI | null;
declare const audio: AudioAPI | null;
declare const ui: UIAPI | null;

declare function start(): void;
declare function update(dt: number): void;
declare function onCollision(other: CollisionInfo): void;
`;

/**
 * ScriptEditor — Monaco Editor panel for editing entity scripts
 */
export class ScriptEditor {
  /** @type {HTMLElement} */
  container;

  /** @type {monaco.editor.IStandaloneCodeEditor|null} */
  editor = null;

  /** @type {import('../../engine/components/Script.js').ScriptComponent|null} */
  currentScript = null;

  /** @type {import('../../engine/Entity.js').Entity|null} */
  currentEntity = null;

  /** @type {Function|null} */
  onScriptChange = null;

  /** @type {HTMLElement|null} */
  headerEl = null;

  /** @type {boolean} */
  _initialized = false;

  constructor(container) {
    this.container = container;
    this._build();
  }

  _build() {
    this.container.innerHTML = '';

    // Script editor header
    this.headerEl = document.createElement('div');
    this.headerEl.className = 'script-editor-header';
    this.headerEl.innerHTML = `
      <span class="script-editor-icon">📝</span>
      <span class="script-editor-filename" id="script-filename">No script selected</span>
      <div class="script-editor-actions">
        <button class="script-editor-btn" id="btn-script-save" title="Save Script">💾</button>
        <button class="script-editor-btn" id="btn-script-reset" title="Reset to Template">🔄</button>
      </div>
    `;
    this.container.appendChild(this.headerEl);

    // Editor container
    const editorWrapper = document.createElement('div');
    editorWrapper.className = 'script-editor-wrapper';
    editorWrapper.id = 'monaco-editor-container';
    this.container.appendChild(editorWrapper);

    // Empty state
    this.emptyState = document.createElement('div');
    this.emptyState.className = 'script-editor-empty';
    this.emptyState.innerHTML = `
      <div class="script-editor-empty-icon">📝</div>
      <div class="script-editor-empty-title">Script Editor</div>
      <div class="script-editor-empty-text">Select an entity with a Script component to edit its code</div>
    `;
    editorWrapper.appendChild(this.emptyState);

    // Bind buttons
    document.getElementById('btn-script-reset')?.addEventListener('click', () => {
      if (this.currentScript) {
        this.currentScript.code = DEFAULT_SCRIPT;
        if (this.editor) {
          this.editor.setValue(DEFAULT_SCRIPT);
        }
      }
    });
  }

  /**
   * Initialize Monaco (deferred to avoid startup cost if user doesn't use scripts)
   */
  _ensureEditor() {
    if (this._initialized) return;
    this._initialized = true;

    const container = document.getElementById('monaco-editor-container');
    if (!container) return;

    // Remove empty state
    if (this.emptyState) {
      this.emptyState.style.display = 'none';
    }

    // Define Ludus dark theme
    monaco.editor.defineTheme('ludus-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A737D', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'C792EA' },
        { token: 'string', foreground: 'C3E88D' },
        { token: 'number', foreground: 'F78C6C' },
        { token: 'type', foreground: 'FFCB6B' },
        { token: 'identifier', foreground: '82AAFF' },
        { token: 'delimiter', foreground: '89DDFF' },
      ],
      colors: {
        'editor.background': '#151530',
        'editor.foreground': '#CCCCDD',
        'editorLineNumber.foreground': '#44446a',
        'editorLineNumber.activeForeground': '#8888aa',
        'editor.selectionBackground': '#3d3d6680',
        'editor.lineHighlightBackground': '#1a1a3a',
        'editorCursor.foreground': '#6c63ff',
        'editorWidget.background': '#1a1a3a',
        'editorSuggestWidget.background': '#1e1e3a',
        'editorSuggestWidget.border': '#2a2a50',
        'editorSuggestWidget.selectedBackground': '#2d2d5a',
        'scrollbarSlider.background': '#2a2a5040',
        'scrollbarSlider.hoverBackground': '#3a3a6060',
      },
    });

    // Add Ludus API types for IntelliSense
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });
    monaco.languages.typescript.javascriptDefaults.addExtraLib(LUDUS_API_TYPES, 'ludus-api.d.ts');

    // Create editor
    this.editor = monaco.editor.create(container, {
      value: '// Select an entity with a Script component',
      language: 'javascript',
      theme: 'ludus-dark',
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
      fontLigatures: true,
      lineNumbers: 'on',
      minimap: { enabled: false },
      automaticLayout: true,
      tabSize: 2,
      scrollBeyondLastLine: false,
      renderLineHighlight: 'all',
      padding: { top: 8 },
      wordWrap: 'on',
      suggest: {
        showKeywords: true,
        showSnippets: true,
      },
      quickSuggestions: {
        other: true,
        comments: false,
        strings: false,
      },
    });

    // Save on change (debounced)
    let saveTimeout = null;
    this.editor.onDidChangeModelContent(() => {
      if (!this.currentScript) return;
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        this.currentScript.code = this.editor.getValue();
        if (this.onScriptChange) this.onScriptChange(this.currentScript);
      }, 300);
    });

    // Ctrl+S to save
    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (this.currentScript) {
        this.currentScript.code = this.editor.getValue();
        if (this.onScriptChange) this.onScriptChange(this.currentScript);
      }
    });
  }

  /**
   * Set the entity & script to edit
   * @param {import('../../engine/Entity.js').Entity|null} entity
   */
  setEntity(entity) {
    this.currentEntity = entity;

    if (entity && entity.hasComponent('Script')) {
      this.currentScript = entity.getComponent('Script');
      this._ensureEditor();

      // Update header
      const filenameEl = document.getElementById('script-filename');
      if (filenameEl) {
        filenameEl.textContent = `${entity.name} / ${this.currentScript.fileName}`;
      }

      // Set code
      if (this.editor) {
        const currentValue = this.editor.getValue();
        if (currentValue !== this.currentScript.code) {
          this.editor.setValue(this.currentScript.code);
        }
      }

      if (this.emptyState) this.emptyState.style.display = 'none';
    } else {
      this.currentScript = null;

      const filenameEl = document.getElementById('script-filename');
      if (filenameEl) {
        filenameEl.textContent = 'No script selected';
      }

      if (!this._initialized) {
        if (this.emptyState) this.emptyState.style.display = 'flex';
      } else if (this.editor) {
        this.editor.setValue('// Select an entity with a Script component');
      }
    }
  }

  /**
   * Refresh editor layout (call after resize)
   */
  layout() {
    if (this.editor) {
      this.editor.layout();
    }
  }
}
