/* global jest describe test expect */

// =========================================
//       IMPORTS
// --------------------------------------

const server = require('../src/server')


// =========================================
//       TESTS
// --------------------------------------

describe('server', () => {

    test('import', () => {
        expect(server).toBeInstanceOf(Function)
    })

    test('listen', async () => {

        // todo
    })

})
