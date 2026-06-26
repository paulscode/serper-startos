import { sdk } from './sdk'

// Back up the entire main volume — it holds the rendered config the user expects
// to survive a restore.
export const { createBackup, restoreInit } = sdk.setupBackups(
  async ({ effects }) => sdk.Backups.ofVolumes('main'),
)
