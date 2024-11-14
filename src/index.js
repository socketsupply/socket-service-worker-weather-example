import { getServiceWorker } from 'socket:protocol-handlers'
import XWeather from 'x-weather'

import geolocation from './geolocation.js'

// register `x-weather` web components
XWeather.defineCustomElements()

// get a reference to the service worker for the `weather:` scheme
const serviceWorker = await getServiceWorker({ scheme: 'weather' })

// create the refresh loop that will get current weather,
// openweather config, and current location data
const loop = setInterval(refresh, 5000)

const state = {
  openweather: null,
  location: null,
  weather: null
}

// kick of message handling so when the worker posts messages to this client
// we can listen for them
await globalThis.navigator.serviceWorker.startMessages()

// request geolocation permissions
// @ts-ignore
await globalThis.navigator.permissions.request({ name: 'geolocation' })

// start the worker
await fetch('weather:worker/start', { method: 'POST' })

// set app title
globalThis.document.title = 'Current Weather'

// initial refresh
refresh()

// listen for incoming messages from the service to this client window
globalThis.navigator.serviceWorker.addEventListener('message', async (e) => {
  if (e.data?.geolocation?.getCurrentPosition === true) {
    try {
      const position = await geolocation.getCurrentPosition()

      serviceWorker.postMessage({
        geolocation: {
          // @ts-ignore
          getCurrentPosition: position.toJSON()
        }
      })
    } catch (err) {
      globalThis.reportError(err)
    }
  }

  if (e.data?.geolocation?.getCurrentRegion === true) {
    try {
      const region = await geolocation.getCurrentRegion()

      serviceWorker.postMessage({
        geolocation: {
          // @ts-ignore
          getCurrentRegion: region
        }
      })
    } catch (err) {
      globalThis.reportError(err)
    }
  }
})

async function refresh () {
  const main = globalThis.document.querySelector('main')

  try {
    const response = await fetch('weather:location/current')
    state.location = await response.json()
  } catch (err) {
    return globalThis.reportError(err)
  }

  try {
    const response = await fetch('weather:current')
    state.weather = await response.json()
  } catch (err) {
    return globalThis.reportError(err)
  }

  try {
    const response = await fetch('weather:openweather/config')
    state.openweather = await response.json()
  } catch (err) {
    return globalThis.reportError(err)
  }

  if (!state.location?.position || !state.location?.region || !state.weather || !state.openweather) {
    return
  }

  main.innerHTML = `
    <x-weather
      appid="${state.openweather.apiKey}"
      latitude="${state.location.position.coords.latitude}"
      longitude="${state.location.position.coords.longitude}"
      placename="${`${state.location.region.regionName}, ${state.location.region.country}`}"
    >
      <x-current primaryscale="c"></x-current>
      <x-forecast days="5" primaryscale="c"></x-forecast>
    </x-weather>
  `
}
