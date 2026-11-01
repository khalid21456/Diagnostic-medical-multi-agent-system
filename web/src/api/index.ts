import { USE_MOCK_API } from './config'
import type { DiagnosisApi } from './diagnosisApi'
import { httpApi } from './httpApi'
import { mockApi } from './mockApi'

/** The API instance the app uses. Toggle with `VITE_USE_MOCK_API` in `.env`. */
export const diagnosisApi: DiagnosisApi = USE_MOCK_API ? mockApi : httpApi

export { USE_MOCK_API } from './config'
export { ApiError, type DiagnosisApi } from './diagnosisApi'
