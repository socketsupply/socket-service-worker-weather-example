globalThis.navigator.serviceWorker.startMessages()

/**
 * @typedef {{
 *   apiKey: string,
 *   client: import('socket:service-worker/clients').Client,
 *   env: import('socket:service-worker').Environment
 * }} WeatherWorkerOptions
 *
 * @typedef {EventInit & {
 *   position: GeolocationPosition,
 *   region: { region: string, regionName: string, county: string }
 * }} WeatherEventOptions
 *
 * @typedef {{
 *   coord: { lon: number, lat: number },
 *   weather: {},
 *   wind: { speed: number, deg: number, gust: number },
 *   clouds: { all: number }
 * }} WeatherData
 */

export class WeatherEvent extends Event {
  #position
  #region

  /**
   * @type {string} type
   * @param {WeatherEventOptions} options
   */
  constructor (type, options) {
    super(type, options)
    this.#position = options.position
    this.#region = options.region
  }

  /**
   * @type {GeolocationPosition}
   */
  get position () {
    return this.#position
  }

  /**
   * @type {{ region: string, regionName: string, county: string }}
   */
  get region () {
    return this.#region
  }
}

export class WeatherPositionEvent extends WeatherEvent {}

export class WeatherWorker extends EventTarget {
  #position
  #pending
  #weather
  #options = { timeout: 50000 }
  #region
  #client
  #apiKey = ''
  #loop
  #env

  /**
   * @param {WeatherWorkerOptions} options
   */
  constructor (options) {
    super()

    this.#apiKey = options.apiKey
    this.#client = options.client
    this.#env = options.env

    // load from environment, which is persisted storage
    // @ts-ignore
    this.#weather = this.#env.weather
    // @ts-ignore
    this.#position = this.#env.position
    // @ts-ignore
    this.#region = this.#env.region
    // @ts-ignore
    Object.assign(this.#options, this.#env.options || {})

    // fetch new weather data for each poll
    this.addEventListener('poll', async (e) => {
      if (e.position) {
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${e.position.coords.latitude}&lon=${e.position.coords.longitude}&appid=${this.apiKey}`
        )

        this.#weather = await response.json()
        // @ts-ignore
        this.#env.weather = this.#weather
      }
    })

    // update position in environment
    this.addEventListener('position', (e) => {
      // @ts-ignore
      this.#env.position = e.position
      if (e.region) {
        this.#env.region = e.region
      }
    })

    // update region in environment
    this.addEventListener('region', (e) => {
      // @ts-ignore
      this.#env.region = e.region
    })
  }

  /**
   * @type {import('socket:service-worker').Environment}
   */
  get env () {
    return this.#env
  }

  get options () {
    return this.#options
   }

  /**
   * @type {string}
   */
  get apiKey () {
    return this.#apiKey
  }

  /**
   * @type {GeolocationPosition?}
   */
  get position () {
    return this.#position ?? null
  }

  get region () {
    return this.#region ?? null
  }

  /**
   * @type {WeatherData}
   */
  get weather () {
    return this.#weather
  }

  /**
   * @type {Promise?}
   */
  get pending () {
    return this.#pending
  }

  get client () {
    return this.#client
  }

  /**
   * @param {string} type
   * @param {function(WeatherEvent):any} callback
   * @param {{ once?: boolean }=} [options]
   */
  addEventListener (type, callback, options = undefined) {
    return super.addEventListener(type, callback, options)
  }

  configure (options) {
    Object.assign(this.#options, options)
    this.#env.options = { ...this.#options }
  }

  async start () {
    if (this.#loop) {
      return
    }

    this.#loop = setInterval(() => this.poll(), 5000)
  }

  async stop () {
    clearInterval(this.#loop)
    this.#loop = null
  }

  async poll () {
    if (this.#pending) {
      return this.#pending
    }

    this.#pending = Promise.resolve().then(async () => {
      if (
        !this.#region ||
        !this.#position ||
        (this.#position?.timestamp && this.#position.timestamp < Date.now() - 1000 * 60 * 5)
      ) {
        this.#client.postMessage({
          geolocation: { getCurrentPosition: true }
        })

        this.#position = await new Promise((resolve) => {
          globalThis.navigator.serviceWorker.addEventListener('message', function onMessage (e) {
            if (e.data?.geolocation?.getCurrentPosition) {
              resolve(e.data.geolocation.getCurrentPosition)
              globalThis.navigator.serviceWorker.removeEventListener('message', onMessage)
            }
          })
        })

        this.dispatchEvent(new WeatherPositionEvent('position', {
          position: this.#position,
          region: this.#region
        }))

        this.#client.postMessage({
          geolocation: { getCurrentPosition: true }
        })

        this.#region = await new Promise((resolve) => {
          globalThis.navigator.serviceWorker.addEventListener('message', function onMessage (e) {
            if (e.data?.geolocation?.getCurrentRegion) {
              resolve(e.data.geolocation.getCurrentRegion)
              globalThis.navigator.serviceWorker.removeEventListener('message', onMessage)
            }
          })
        })

        this.dispatchEvent(new WeatherEvent('region', {
          position: this.#position,
          region: this.#region
        }))
      }

      this.#pending = null

      this.dispatchEvent(new WeatherEvent('poll', {
        position: this.#position,
        region: this.#region
      }))
    })

    return this.#pending
  }
}
