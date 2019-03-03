/* global jest describe test expect */

// =========================================
//       IMPORTS
// --------------------------------------

const cache = require('../src/cache')


// =========================================
//       TESTS
// --------------------------------------

describe('cache', () => {

    test('import', () => {
        expect(cache).toBeInstanceOf(Object)
    })

    test('read', async () => {
        expect(cache.read).toBeInstanceOf(Function)

        // todo
    })

    test('write', async () => {
        expect(cache.write).toBeInstanceOf(Function)

        // todo
    })

})
