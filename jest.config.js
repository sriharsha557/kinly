// Render tests for components. Separate from `npm test`, which runs pure
// logic tests through node:test - see the testMatch note below.
//
// Why this exists: the logic suite covers src/lib well, so business rules are
// known-good, but nothing exercised whether a component can RENDER. Every
// crash the app has produced lived in that untested layer. The bar here is
// deliberately low and deliberately broad - "can this render with realistic
// data" - because that is what catches regressions like the persisted-cache
// crash, which typechecked cleanly and passed all 204 logic tests.
module.exports = {
  preset: 'jest-expo',

  // ONLY .tsx. The existing logic tests are .ts files written against
  // node:test (`import { test } from 'node:test'`), which Jest cannot run -
  // its own globals collide with them. Keeping the extensions apart means
  // `npm test` and `npm run test:render` never fight over the same files, and
  // neither needs to know the other exists.
  testMatch: ['<rootDir>/src/**/*.test.tsx'],

  setupFilesAfterEnv: ['<rootDir>/jest-setup.js'],

  moduleNameMapper: {
    // metro.config.js routes .svg imports through react-native-svg-transformer
    // so components can `import Icon from './icon.svg'`. Jest does not use
    // Metro, so without this every component importing an icon fails to
    // resolve before its test body runs. A stub is enough: these tests assert
    // that a component renders, not what an icon looks like.
    '\\.svg$': '<rootDir>/src/test/svgMock.tsx',
  },
};
