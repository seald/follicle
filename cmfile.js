'use strict'

const cm = require('centimaitre')
const jetpack = require('fs-jetpack')
const babel = require('@babel/core')
const { promisify } = require('util')
const path = require('path')

const babelTransform = promisify(babel.transformFile)

cm.setDefaultOptions({
  sourceMaps: true
})

cm.task('clean-build', () => {
  jetpack.dir('./build/', { empty: true })
  jetpack.dir('./build/lib')
  jetpack.dir('./build/test')
})

const buildJS = async (options, { srcDirPath, destDirPath, rootDirPath = jetpack.path(), matching }) => {
  const srcDir = jetpack.cwd(srcDirPath)
  const destDir = jetpack.cwd(destDirPath)

  for (const file of srcDir.find({ matching })) {
    const res = await babelTransform(srcDir.path(file), {
      sourceMaps: options.sourceMaps,
      sourceFileName: path.relative(rootDirPath, srcDir.path(file)),
      sourceRoot: path.relative(destDir.path(path.dirname(file)), rootDirPath),
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
      await destDir.writeAsync(file + '.map', JSON.stringify(res.map))
    }
    await destDir.writeAsync(file, res.code)
  }
}

cm.task('build-test', ['clean-build'], async (options) =>
  buildJS(options, {
    srcDirPath: jetpack.path('./src/test'),
    destDirPath: jetpack.path('./build/test'),
    matching: '**/*.js'
  })
)

cm.task('build-lib', ['clean-build'], async (options) =>
  buildJS(options, {
    srcDirPath: jetpack.path('./src/lib'),
    destDirPath: jetpack.path('./build/lib'),
    matching: '**/*.js'
  })
)

cm.task('build-index', ['clean-build'], async (options) =>
  buildJS(options, {
    srcDirPath: jetpack.path('./src'),
    destDirPath: jetpack.path('./build'),
    matching: 'index.js'
  })
)

cm.task('build', ['build-index', 'build-lib'])

cm.task('pretest', ['build', 'build-test'])
