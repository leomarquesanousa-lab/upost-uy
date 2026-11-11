// Alias for the existing retention engine; never synchronize, expire or delete.
process.argv.push('--retention-only','--dry-run');
await import('./sync-sources.mjs');
