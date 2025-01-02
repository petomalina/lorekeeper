import Database from 'better-sqlite3';

// Initialize the database
const db = new Database('lorekeeper.db', { verbose: console.log });

// Make sure to close the database when the process exits
process.on('exit', () => db.close());
process.on('SIGHUP', () => process.exit(128 + 1));
process.on('SIGINT', () => process.exit(128 + 2));
process.on('SIGTERM', () => process.exit(128 + 15));

export default db; 