'use strict'

const gulp = require('gulp')
const buffer = require('vinyl-buffer')
const sourcemaps = require('gulp-sourcemaps')
const jetpack = require('fs-jetpack')
const babel = require('gulp-babel')

const srcDir = jetpack.cwd('./src')

const libDir = srcDir.cwd('./lib')
const testDir = srcDir.cwd('./test')

const buildDir = jetpack.cwd('./build')

const libBuildDir = buildDir.cwd('./lib')
const testBuildDir = buildDir.cwd('./test')

gulp.task('clean-build', () => {
  buildDir.dir('.', {empty: true})
  libBuildDir.dir('.', {empty: true})
  testBuildDir.dir('.', {empty: true})
})

gulp.task('pretest', ['build-lib', 'build-index'], () => {
  return gulp.src(testDir.path('**/*.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init({loadMaps: true}))
    .pipe(babel({
      presets: [
        ['@babel/preset-env', {
          targets: {
            node: '8'
          },
          useBuiltIns: 'usage'
        }]
      ]
    }))
    .pipe(sourcemaps.mapSources(sourcePath => '../../src/test/' + sourcePath))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(testBuildDir.path()))
})

gulp.task('build-lib', ['clean-build'], () => {
  return gulp.src(libDir.path('**/*.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init({loadMaps: true}))
    .pipe(babel({
      presets: [
        ['@babel/preset-env', {
          targets: {
            node: '8'
          },
          useBuiltIns: 'usage'
        }]
      ]
    }))
    .pipe(sourcemaps.mapSources(sourcePath => '../../src/lib/' + sourcePath))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(libBuildDir.path('.')))
})

gulp.task('build-index', ['clean-build'], () => {
  return gulp.src(srcDir.path('*.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init({loadMaps: true}))
    .pipe(babel({
      presets: [
        ['@babel/preset-env', {
          targets: {
            node: '8'
          },
          useBuiltIns: 'usage'
        }]
      ]
    }))
    .pipe(sourcemaps.mapSources(sourcePath => '../src/' + sourcePath))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(buildDir.path('.')))
})
