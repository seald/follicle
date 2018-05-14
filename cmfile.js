'use strict'

const cm = require('@seald/centimaitre')
const jetpack = require('fs-jetpack')
const babel = require('@babel/core')
const {promisify} = require('util')
const path = require('path')

const babelTransform = promisify(babel.transformFile)

const srcDir = jetpack.cwd('./src')

const libDir = srcDir.cwd('./lib')
const testDir = srcDir.cwd('./test')

const buildDir = jetpack.cwd('./build')

const libBuildDir = buildDir.cwd('./lib')
const testBuildDir = buildDir.cwd('./test')

cm.setDefaultOptions({
  sourceMaps: true
})

cm.task('clean-build', () => {
  buildDir.dir('.', {empty: true})
  libBuildDir.dir('.', {empty: true})
  testBuildDir.dir('.', {empty: true})
})

cm.task('pretest', ['build'], async (options) => {
  for (const file of testDir.find({matching: '**/*.js'})) {
    const res = await babelTransform(testDir.path(file), {
      sourceMaps: options.sourceMaps,
      sourceFileName: path.relative(jetpack.path(), testDir.path(file)),
      sourceRoot: path.relative(testBuildDir.path(path.dirname(file)), jetpack.path()),
      presets: [
        ['@babel/preset-env', {
          targets: {
            'node': '9'
          },
          useBuiltIns: false
        }]
      ]
    })
    if (options.sourceMaps) {
      res.map.file = `${path.basename(file)}`
      res.code = res.code + `\n//# sourceMappingURL=${path.basename(file)}.map`
      await testBuildDir.writeAsync(file + '.map', JSON.stringify(res.map))
    }
    await testBuildDir.writeAsync(file, res.code)
  }
})

cm.task('build-lib', ['clean-build'], async (options) => {
  for (const file of libDir.find({matching: '**/*.js'})) {
    const res = await babelTransform(libDir.path(file), {
      sourceMaps: options.sourceMaps,
      sourceFileName: path.relative(jetpack.path(), libDir.path(file)),
      sourceRoot: path.relative(libBuildDir.path(path.dirname(file)), jetpack.path()),
      presets: [
        ['@babel/preset-env', {
          targets: {
            'node': '9'
          },
          useBuiltIns: false
        }]
      ]
    })
    if (options.sourceMaps) {
      res.map.file = `${path.basename(file)}`
      res.code = res.code + `\n//# sourceMappingURL=${path.basename(file)}.map`
      await libBuildDir.writeAsync(file + '.map', JSON.stringify(res.map))
    }
    await libBuildDir.writeAsync(file, res.code)
  }
})

cm.task('build-index', ['clean-build'], async (options) => {
  for (const file of srcDir.find({matching: './*.js'})) {
    const res = await babelTransform(srcDir.path(file), {
      sourceMaps: options.sourceMaps,
      sourceFileName: path.relative(jetpack.path(), srcDir.path(file)),
      sourceRoot: path.relative(buildDir.path(path.dirname(file)), jetpack.path()),
      presets: [
        ['@babel/preset-env', {
          targets: {
            'node': '9'
          },
          useBuiltIns: false
        }]
      ]
    })
    if (options.sourceMaps) {
      res.map.file = `${path.basename(file)}`
      res.code = res.code + `\n//# sourceMappingURL=${path.basename(file)}.map`
      await buildDir.writeAsync(file + '.map', JSON.stringify(res.map))
    }
    await buildDir.writeAsync(file, res.code)
  }
})

cm.task('build', ['build-index', 'build-lib'])
