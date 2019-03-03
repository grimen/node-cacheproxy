
/* =========================================
      IMPORTS
-------------------------------------- */

const { exec } = require('child_process')

const chalk = require('chalk')

const express = require('express')
const expressLogger = require('morgan')
const expressResponseTime = require('response-time')
const expressTimeout = require('connect-timeout')

const cacheProxyMiddleware = require('./middleware')


/* =========================================
      CONSTANTS
-------------------------------------- */

const DEFAULT_LOG = undefined
const DEFAULT_ENABLED = true
const DEFAULT_VERBOSE = true
const DEFAULT_TIMEOUT = 10
const DEFAULT_HOSTNAME = undefined
const DEFAULT_PORT = 7777


/* =========================================
      FUNCTIONS
-------------------------------------- */

const server = (options = {}) => {
    options = {
        ...(options || {}),
        enabled: (typeof options.enabled === 'boolean' ? options.enabled : DEFAULT_ENABLED),
        verbose: (typeof options.verbose === 'boolean' ? options.verbose : DEFAULT_VERBOSE),
        hostname: options.hostname || DEFAULT_HOSTNAME,
        port: options.port || DEFAULT_PORT,
        log: options.log || DEFAULT_LOG,
        timeout: options.timeout || DEFAULT_TIMEOUT,
        errorHandler: options.errorHandler || undefined,
    }

    const log = options.log || console.log

    if (options.enabled === false) {
        if (options.verbose) {
            log(chalk.red('DISABLED'))
        }

        return false
    }

    const cacheproxyServer = express()

    cacheproxyServer.use(expressLogger('dev'))
    cacheproxyServer.use(expressResponseTime())
    cacheproxyServer.use(expressTimeout(`${options.timeout || 10}s`))

    cacheproxyServer.use(cacheProxyMiddleware(options))

    cacheproxyServer.use(options.errorHandler || ((error, req, res, next) => {
        res
            .status(500)
            .end(JSON.stringify({
                error,
            }))
    }))

    const killProcessByPort = (port, callback) => {
        return exec(`kill $(lsof -t -i :${port})`, callback)
    }

    killProcessByPort(options.port, (error, stdout, stderr) => {
        cacheproxyServer.listen(options.port, () => {
            console.log(`Listening on port ${options.port}`)
        })
    })

    return cacheproxyServer
}


/* =========================================
      EXPORTS
-------------------------------------- */

module.exports = server


/* =========================================
      MAIN
-------------------------------------- */

if (require.main === module) {
    const port = process.env.PROXY_PORT || DEFAULT_PORT

    server({port})
}
