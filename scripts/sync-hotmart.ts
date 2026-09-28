import { syncHotmartSales } from '../src/lib/hotmart-sync';

syncHotmartSales({ dryRun: process.argv.includes('--dry-run') })
  .then((summary) => {
    console.log(JSON.stringify(summary));
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Falha na conciliação Hotmart.');
    process.exitCode = 1;
  });
