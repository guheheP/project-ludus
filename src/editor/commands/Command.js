/**
 * Command — Base class for undoable commands
 */
export class Command {
  /** @type {string} Human-readable description */
  get description() {
    return 'Unknown action';
  }

  /** Execute the command */
  execute() {
    throw new Error('Command.execute() not implemented');
  }

  /** Undo the command */
  undo() {
    throw new Error('Command.undo() not implemented');
  }
}
