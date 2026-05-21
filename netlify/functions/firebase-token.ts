import type { Handler } from '@netlify/functions'
import { buildFirebaseTokenResponse } from '../../server/firebase-token'

export const handler: Handler = async (event) => {
  const response = await buildFirebaseTokenResponse({
    authorization: event.headers.authorization ?? event.headers.Authorization,
    origin: event.headers.origin ?? event.headers.Origin
  })

  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body: response.body
  }
}