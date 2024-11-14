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
    if (/timeout/i.test(err.message)) {
      const ip = await getCurrentIPAddress()
      if (ip) {
        const response = await fetch(`http://ip-api.com/json/${ip}`)
        const json = await response.json()
        const now = Date.now()
        return Object.create(GeolocationPosition.prototype, {
          timestamp: { writable: false, value: now },
          coords: {
            writable: false,
            value: Object.create(GeolocationCoordinates.prototype, {
              latitude: { writable: false, value: json.lat },
              longitude: { writable: false, value: json.lon },
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
                  latitude: json.lat,
                  longitude: json.lon,
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
                latitude: json.lat,
                longitude: json.lon,
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
    const ip = await getCurrentIPAddress()
    const response = await fetch(`http://ip-api.com/json/${ip}`)
    const json = await response.json()
    return {
      country: json.country,
      countryCode: json.countryCode,
      region: json.region,
      regionName: json.regionName,
      city: json.city,
      timezone: json.timezone
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
