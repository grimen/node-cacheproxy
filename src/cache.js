
/* =========================================
      IMPORTS
-------------------------------------- */

const path = require('path')
const util = require('util')
const chalk = require('chalk')
const fs = require('fs-extra')


/* =========================================
      PROMISIFY
-------------------------------------- */

const exists = util.promisify(fs.stat)
const readFile = util.promisify(fs.readFile)
const writeFile = util.promisify(fs.writeFile)
const ensureDir = util.promisify(fs.ensureDir)
const ensureFile = util.promisify(fs.ensureFile)
const appendFile = util.promisify(fs.appendFile)


/* =========================================
      CONSTANTS
-------------------------------------- */

const DEFAULT_VERBOSE = false
const DEFAULT_LOG = undefined
const DEFAULT_CACHE_PATH = process.env.TMP || '/tmp'


/* =========================================
      FUNCTIONS
-------------------------------------- */

const read = async (data, options = {}) => {
    options = {
        ...(options || {}),
        verbose: (typeof options.verbose === 'boolean' ? options.verbose : DEFAULT_VERBOSE),
        log: options.log || DEFAULT_LOG,
        cachePath: options.cachePath || options.tmp || DEFAULT_CACHE_PATH,
    }

    const log = options.log || console.log

    // log('READ', {data})

    let { meta } = data
    const { key, url } = meta

    const responseFilePath = path.join(options.cachePath, key)
    const responseMetaFilePath = path.join(responseFilePath, 'meta')
    const responseBodyFilePath = path.join(responseFilePath, 'body')

    let body

    try {
        if (await exists(responseMetaFilePath)) {
            meta = await readFile(responseMetaFilePath, 'utf8')
            meta = JSON.parse(meta || '{}')
        }

    } catch (error) {
        if (options.verbose) {
            log(chalk.red(error))
        }

        meta = undefined
    }

    try {
        if (await exists(responseBodyFilePath)) {
            body = await readFile(responseBodyFilePath)
        }

    } catch (error) {
        body = undefined
    }

    if (options.verbose) {
        if (body) {
            log(chalk.green('READ'), key, url, body)

        } else {
            log(chalk.red('READ'), key, url, body)
        }
    }

    return {
        meta,
        body,
    }
}

const write = async (data, options = {}) => {
    options = {
        ...(options || {}),
        log: options.log || undefined,
        verbose: (typeof options.verbose === 'boolean' ? options.verbose : false),
        cachePath: options.tmp || process.env.TMP || '/tmp',
    }

    const log = options.log || console.log

    // log('WRITE', {data})

    const { meta } = data
    const { key, url } = meta

    const responseIndexFilePath = path.join(options.cachePath, `index`)
    const responseFilePath = path.join(options.cachePath, key)
    const responseMetaFilePath = path.join(responseFilePath, `meta`)
    const responseBodyFilePath = path.join(responseFilePath, `body`)

    const ok = (meta.status === 200)

    if (ok) {
        try {
            await ensureFile(responseIndexFilePath)

        } catch (error) {
            if (options.verbose) {
                log(chalk.red(error))
            }

            throw error
        }

        try {
            await ensureDir(responseFilePath)

        } catch (error) {
            if (options.verbose) {
                log(chalk.red(error))
            }

            throw error
        }

        try {
            await writeFile(responseMetaFilePath, JSON.stringify(meta, null, 4), 'utf8')

        } catch (error) {
            if (options.verbose) {
                log(chalk.red(error))
            }

            throw error
        }

        let { body } = data

        const contentType = meta.headers['Content-Type'] || meta.headers['content-type'] || ''
        const contentLength = (body && body.length) || 0

        if (body) {
            // NOTE: include meta as header comment only for HTML - not JSON
            if (contentType.includes('html')) {
                body = [`<!--`, `${JSON.stringify(meta, null, 4)}`, `-->`, `${body}`].join(`\n`)

            } else if (contentType.includes('text')) {
                body = `${body}`
            }

            try {
                await writeFile(responseBodyFilePath, body)

            } catch (error) {
                if (options.verbose) {
                    log(chalk.red(error))
                }

                throw error
            }

            try {
                await ensureFile(responseIndexFilePath)
                await appendFile(responseIndexFilePath, `${key} ${url}\n`)

            } catch (error) {
                if (options.verbose) {
                    log(chalk.red(error))
                }

                throw error
            }
        }

        if (options.verbose) {
            log(chalk.green('WRITE'), key, url, contentLength)
        }

        return true

    } else {
        return false
    }
}


/* =========================================
      EXPORTS
-------------------------------------- */

module.exports = {
    read,
    write,
}
