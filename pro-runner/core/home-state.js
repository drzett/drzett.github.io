export const GRID_COLUMNS = 4;
export const itemCells = (position, size) => Array.from({ length: size.h }, (_, y) => Array.from({ length: size.w }, (_, x) => `${position.col + x}:${position.row + y}`)).flat();
export const validPosition = (position, size, rows) => Number.isInteger(position?.col) && Number.isInteger(position?.row) && position.col >= 1 && position.row >= 1 && position.col + size.w - 1 <= GRID_COLUMNS && position.row + size.h - 1 <= rows;
export function firstFree(occupied, size, rows) { for (let row = 1; row <= rows - size.h + 1; row += 1) for (let col = 1; col <= GRID_COLUMNS - size.w + 1; col += 1) { const position = { col, row }; if (itemCells(position, size).every((cell) => !occupied.has(cell))) return position; } return null; }
export function moveDockItem(dock, key, index = dock.length) { const next = dock.filter((item) => item !== key); next.splice(Math.max(0, Math.min(index, next.length)), 0, key); return next.slice(0, 4); }
