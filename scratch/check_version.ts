import { query } from './lib/db';
query('SELECT @@VERSION as v').then(r => console.log(r[0].v)).catch(console.error).finally(() => process.exit(0));
