import { sdk } from '../sdk'
import { config } from './config'
import { apiKeyInfo } from './apiKeyInfo'

export const actions = sdk.Actions.of().addAction(config).addAction(apiKeyInfo)
