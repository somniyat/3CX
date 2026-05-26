const resolve = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const terser = require("@rollup/plugin-terser");
const json = require("@rollup/plugin-json");

module.exports = {
    input: "src/index.js",
    output: [
        {
            file: "dist/index.cjs",
            format: "cjs",
            exports: "default"
        },
        {
            file: "dist/index.mjs",
            format: "esm"
        }
    ],
    plugins: [
        resolve(),
        commonjs(),
        json(),
        terser()
    ]
};
