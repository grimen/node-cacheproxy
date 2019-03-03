/* global jest describe test expect */

// =========================================
//       IMPORTS
// --------------------------------------

const middleware = require('../src/middleware')


// =========================================
//       TESTS
// --------------------------------------

describe('middleware', () => {

    test('import', () => {
        expect(middleware).toBeInstanceOf(Function)
    })

    test('<mount>', async () => {
        // todo
    })

})
