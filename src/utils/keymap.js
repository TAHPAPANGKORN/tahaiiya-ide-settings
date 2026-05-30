/**
 * Vim-style navigation patch for @clack/prompts.
 *
 * Intercepts stdin data events and remaps:
 *   Ctrl+N  (0x0e)  →  ESC [ B  (Arrow Down)
 *   Ctrl+P  (0x10)  →  ESC [ A  (Arrow Up)
 *
 * Call once before any prompt is rendered.
 */

export function enableVimNavigation() {
    if (!process.stdin.isTTY) return;

    const _emit = process.stdin.emit.bind(process.stdin);

    process.stdin.emit = function (event, ...args) {
        if (event === 'data') {
            const chunk = args[0];
            const str   = Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk);

            if (str === '\x0e') return _emit('data', Buffer.from('\x1b[B')); // Ctrl+N → ↓
            if (str === '\x10') return _emit('data', Buffer.from('\x1b[A')); // Ctrl+P → ↑
        }
        return _emit(event, ...args);
    };
}
