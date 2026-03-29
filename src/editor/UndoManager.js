/**
 * UndoManager — Manages undo/redo command history
 *
 * Uses the Command Pattern: each user action is wrapped in a command
 * object with execute() and undo() methods.
 */
export class UndoManager {
  /** @type {import('./commands/Command.js').Command[]} */
  _undoStack = [];

  /** @type {import('./commands/Command.js').Command[]} */
  _redoStack = [];

  /** @type {number} Max undo stack depth */
  _maxStack = 50;

  /** @type {Function|null} Called when stack state changes */
  onStateChange = null;

  /**
   * Execute a command and push it onto the undo stack
   * @param {import('./commands/Command.js').Command} command
   */
  execute(command) {
    command.execute();
    this._undoStack.push(command);

    // Clear redo stack (new action invalidates redo history)
    this._redoStack.length = 0;

    // Trim if over limit
    if (this._undoStack.length > this._maxStack) {
      this._undoStack.shift();
    }

    this._emitStateChange();
  }

  /**
   * Undo the last command
   * @returns {boolean} true if an action was undone
   */
  undo() {
    if (this._undoStack.length === 0) return false;

    const command = this._undoStack.pop();
    command.undo();
    this._redoStack.push(command);
    this._emitStateChange();
    return true;
  }

  /**
   * Redo the last undone command
   * @returns {boolean} true if an action was redone
   */
  redo() {
    if (this._redoStack.length === 0) return false;

    const command = this._redoStack.pop();
    command.execute();
    this._undoStack.push(command);
    this._emitStateChange();
    return true;
  }

  /** @returns {boolean} */
  get canUndo() {
    return this._undoStack.length > 0;
  }

  /** @returns {boolean} */
  get canRedo() {
    return this._redoStack.length > 0;
  }

  /** @returns {string} Description of what would be undone */
  get undoDescription() {
    if (this._undoStack.length === 0) return '';
    return this._undoStack[this._undoStack.length - 1].description;
  }

  /** @returns {string} Description of what would be redone */
  get redoDescription() {
    if (this._redoStack.length === 0) return '';
    return this._redoStack[this._redoStack.length - 1].description;
  }

  /**
   * Clear all history
   */
  clear() {
    this._undoStack.length = 0;
    this._redoStack.length = 0;
    this._emitStateChange();
  }

  _emitStateChange() {
    if (this.onStateChange) {
      this.onStateChange(this.canUndo, this.canRedo);
    }
  }
}
