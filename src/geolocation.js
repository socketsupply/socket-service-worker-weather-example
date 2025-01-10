import process from 'socket:process'

const { IPGEOLOCATION_API_KEY } = process.env

export const cache = new Set()

export async function queryPermission () {
  return await globalThis.navigator.permissions.query({ name: 'geolocation' })
}

export async function requestPermission () {
  // @ts-ignore
  return await globalThis.navigator.permissions.request({ name: 'geolocation' })
}

export async function getCurrentPosition () {
  try {
    return await new Promise((resolve, reject) => {
      globalThis.navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 1000
      })
    })
  } catch (err) {
    if (/timeout|timed?\s+out/i.test(err.message)) {
      const ip = await getCurrentIPAddress()
      if (ip) {
        const response = await fetch(`https://api.ipgeolocation.io/ipgeo?apiKey=${IPGEOLOCATION_API_KEY}`)
        const json = await response.json()
        const now = Date.now()
        return Object.create(GeolocationPosition.prototype, {
          timestamp: { writable: false, value: now },
          coords: {
            writable: false,
            value: Object.create(GeolocationCoordinates.prototype, {
              latitude: { writable: false, value: parseFloat(json.latitude) },
              longitude: { writable: false, value: parseFloat(json.longitude) },
              heading: { writable: false, value: null },
              floorLevel: { writable: false, value: null },
              speed: { writable: false, value: null },
              altitude: { writable: false, value: null },
              accuracy: { writable: false, value: 5 },
              altitudeAccuracy: { writable: false, value: null },
              toJSON: {
                writable: false,
                enumerable: false,
                value: () => ({
                  latitude: parseFloat(json.latitude),
                  longitude: parseFloat(json.longitude),
                  floorLevel: null,
                  heading: null,
                  speed: null,
                  altitude: null,
                  accuracy: 5,
                  altitudeAccuracy: null
                })
              }
            })
          },

          toJSON: {
            writable: false,
            enumerable: false,
            value: () => ({
              timestamp: now,
              coords: {
                latitude: parseFloat(json.latitude),
                longitude: parseFloat(json.longitude),
                floorLevel: null,
                heading: null,
                speed: null,
                altitude: null,
                accuracy: 5,
                altitudeAccuracy: null
              }
            })
          }
        })
      }
    }
  }
}

export async function getCurrentRegion () {
  try {
    const response = await fetch(`https://api.ipgeolocation.io/ipgeo?apiKey=${IPGEOLOCATION_API_KEY}`)
    const json = await response.json()
    return {
      country: json.country_name,
      countryCode: json.country_code2,
      region: json.district,
      regionName: json.city,
      city: json.city,
      timezone: json.time_zone.name
    }
  } catch (err) {
    // offline
    if (/fetch failed/i.test(err.message)) {
      return null
    }

    throw err
  }
}

export default {
  queryPermission,
  requestPermission,
  getCurrentPosition,
  getCurrentRegion
}

async function getCurrentIPAddress () {
  try {
    const response = await fetch('https://api.ipify.org?format=json')
    const json = await response.json()
    return json.ip
  } catch (err) {
    // offline
    if (/fetch failed/i.test(err.message)) {
      return null
    }

    throw err
  }
}
