import sqliteInit from '@sqlite.org/sqlite-wasm';
import wasmUrl from '@sqlite.org/sqlite-wasm/sqlite3.wasm?url';

// The published initializer accepts Emscripten options but declares no arguments.
type Initializer = (options: { locateFile: () => string }) => ReturnType<typeof sqliteInit>;
export const initSqlite = () => (sqliteInit as Initializer)({ locateFile: () => wasmUrl });
