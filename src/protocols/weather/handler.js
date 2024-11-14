import process from 'socket:process'
import { Hono } from 'npm:hono'

import { WeatherWorker } from './worker.js'

/**
 * This is given when building the application with:
 * ```sh
 * ssc build --env OPENWEATHER_API_KEY="openweather api key"
 * ```
 *
 * Or in a local `.sscrc`:
 * ```ini
 * [settings.env]
 * OPENWEATHER_API_KEY = "openweather api key"
 * ```
 */
const { OPENWEATHER_API_KEY = '' } = process.env

/**
 * The hono oapplication
 * @type {Hono}
 */
const app = new Hono({ getPath: (request) => new URL(request.url).pathname })

let worker = null

app.post('/worker/start', async (c) => {
  if (!worker) {
    const client = (
      // @ts-ignore
      await /** @type {import('socket:service-worker').Context}*/ (c.executionCtx).client()
    )

    worker = new WeatherWorker({
      client,
      apiKey: OPENWEATHER_API_KEY,
      env: /** @type {import('socket:service-worker').Environment} */ (c.env)
    })

    await worker.start()
  }

  return new Response('', { status: 200 })
})

app.post('/worker/configure', async (c) => {
  if (!worker) {
    return c.json({ error: 'Worker is not started' }, { status: 400 })
  }

  const options = await c.req.json()
  worker.configure(options)
  return c.json(worker.options)
})

app.get('/location/current', async (c) => {
  if (!worker) {
    return c.json({ error: 'Worker is not started' }, { status: 400 })
  }

  return c.json({ position: worker.position, region: worker.region })
})

app.get('/current', async (c) => {
  if (!worker) {
    return c.json({ error: 'Worker is not started' }, { status: 400 })
  }

  return c.json(worker.weather ?? null)
})

app.get('/openweather/config', async (c) => {
  return c.json({
    apiKey: OPENWEATHER_API_KEY
  })
})

/**
 * The request handler entry.
 * @param {Request} request
 * @param {import('socket:service-worker').Environment} env
 * @param {import('socket:service-worker/context').Context} ctx
 * @return {Promise<Response|void>}
 */
export default async function (request, env, ctx) {
  if (request.method === 'OPTIONS') {
    return new Response('OK', { status: 204 })
  }

  const response = await app.fetch(request, env, ctx)

  if (response) {
    response.headers.set('cache-control', 'no-cache')
  }

  return response
}
