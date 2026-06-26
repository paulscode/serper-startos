import { sdk } from './sdk'

// Serper Clone is fully self-contained — no other packages are required.
export const setDependencies = sdk.setupDependencies(async ({ effects }) => ({}))
