
/* =========================================
      IMPORTS
-------------------------------------- */

const httpProxy = require('http-proxy')
const request = require('request-promise-native')
const chalk = require('chalk')
const hash = require('md5')

const cache = require('./cache')


/* =========================================
      CONSTANTS
-------------------------------------- */

const DEFAULT_VERBOSE = false
const DEFAULT_LOG = undefined
const DEFAULT_CACHE_PATH = process.env.TMP || '/tmp'


/* =========================================
      FUNCTIONS
-------------------------------------- */

const middleware = (options = {}) => {
    options = {
        ...(options || {}),
        verbose: (typeof options.verbose === 'boolean' ? options.verbose : DEFAULT_VERBOSE),
        log: options.log || DEFAULT_LOG,
        cachePath: options.cachePath || options.tmp || DEFAULT_CACHE_PATH,
    }

    const log = options.log || console.log

    const onError = (req, res, next) => {
        return async (error) => {
            return next(error)
        }
    }

    const onRequest = (key, req, res, next) => {
        return async ({meta}) => {
            let data

            try {
                data = await cache.read({meta}, options) || {}

                if (options.verbose) {
                    log(key, chalk.green('onRequest'), {meta})
                }

            } catch (error) {
                if (options.verbose) {
                    log(key, chalk.red('onRequest'), error)
                }

                data = {
                    meta,
                    body: undefined,
                }
            }

            const result = !!data.body

            if (result) {
                const { meta, body } = data

                res
                    .set({
                        ...(meta.headers || {}),
                        'Content-Length': body.length,
                        'X-Proxy-Cache-Hit': true,
                        'X-Proxy-Cache-Hash': meta.key,
                    })
                    .status(meta.status || 200)
                    .end(body)
            }

            return result
        }
    }

    const onResponse = (key, req, res, next) => {
        return async ({meta, body}) => {
            let result

            try {
                result = await cache.write({meta, body}, options) || false

                if (options.verbose) {
                    log(key, chalk.green('onResponse'), {meta, body})
                }

            } catch (error) {
                if (options.verbose) {
                    log(key, chalk.red('onResponse'), error)
                }

                result = false
            }

            res
                .set({
                    ...(meta.headers || {}),
                    'Content-Length': body.length,
                    'X-Proxy-Cache-Hit': false,
                    'X-Proxy-Cache-Hash': meta.key,
                    'X-Proxy-Cache-Written': result,
                })
                .status(meta.status || 200)
                .end(body)

            return result
        }
    }

    const urlProxy = (req, res, next) => {
        return async (url) => {
            const key = hash(url)

            if (options.verbose) {
                log(chalk.gray('PROXY (1)'), req.method, req.url, chalk.gray(JSON.stringify(req.query)), `=>`, url)
            }

            const meta = {
                key,
                url,
            }

            const cacheHit = await onRequest('urlProxy', req, res, next)({meta}, options)

            if (!cacheHit) {
                const { method, query } = req
                const qs = query
                const encoding = null

                try {
                    const proxyRes = await request({
                        method,
                        url,
                        qs,
                        encoding,
                        resolveWithFullResponse: true,
                    })

                    const status = proxyRes.statusCode
                    const { headers } = proxyRes

                    const meta = {
                        key,
                        url,
                        status,
                        headers,
                    }

                    const body = proxyRes.body || undefined

                    return onResponse('rawProxy', req, res, next)({meta, body}, options)

                } catch (error) {
                    onError(req, res, next)(error)
                }
            }

            return true
        }
    }

    const rawProxy = (req, res, next) => {
        return async (url) => {
            const key = hash(url)

            const meta = {
                key,
                url,
            }

            const cacheHit = await onRequest('rawProxy', req, res, next)(meta, options)

            if (!cacheHit) {
                global.proxy = global.proxy || httpProxy.createProxyServer()

                const { proxy } = global

                proxy.on('error', onError(req, res, next))

                proxy.on('proxyReq', async (proxyReq, req, res, options) => {
                    if (options.verbose) {
                        log(chalk.gray('PROXY (2)'), req.method, req.url, chalk.gray(JSON.stringify(req.query)), `=>`, url)
                    }
                })

                proxy.on('proxyRes', async (proxyRes, req, res) => {
                    const status = proxyRes.statusCode
                    const { headers } = proxyRes

                    const meta = {
                        key,
                        url,
                        status,
                        headers,
                    }

                    const body = Buffer.from()

                    proxyRes.on('data', (chunk) => {
                        body.write(chunk)
                    })

                    proxyRes.on('end', async () => {
                        await onResponse('rawProxy', req, res, next)({meta, body}, options)
                    })
                })

                proxy.web(req, res, {target: url})
            }

            return true
        }
    }

    return (req, res, next) => {
        (async () => {
            let url

            // 1. try HTTP query param first a.k.a. proxy-prefix (`?url=`)
            if (req.query) {
                url = req.query.url || Object.keys(req.query)[0]

                if (/^https?:/gi.test(url)) {
                    await urlProxy(req, res, next)(url)

                    return
                }
            }

            // 2. fallback on classic HTTP proxying
            url = req.originalUrl || req.url

            await rawProxy(req, res, next)(url)
        })()
    }
}


/* =========================================
      EXPORTS
-------------------------------------- */

module.exports = middleware
