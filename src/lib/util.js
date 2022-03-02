import { FollicleError } from './errors'

export const deepTraverse = function (obj, func) {
  for (const i in obj) {
    func.apply(this, [i, obj[i], obj])
    if (obj[i] !== null && typeof (obj[i]) === 'object') {
      deepTraverse(obj[i], func)
    }
  }
}

export const migrateDocument = migrations => serializedDocument => {
  const finalVersion = migrations.length
  if (serializedDocument._version > finalVersion) throw new FollicleError('Version of the database is too recent')
  while (serializedDocument._version < finalVersion) {
    serializedDocument = migrations[serializedDocument._version](serializedDocument)
    serializedDocument._version++
  }
  return serializedDocument
}

// Extracted from https://github.com/browserify/path-browserify/blob/master/index.js to avoid a dependency in Node.js
// path module

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

const assertPath = path => {
  if (typeof path !== 'string') throw new TypeError('Path must be a string. Received ' + JSON.stringify(path))
}

// Resolves . and .. elements in a path with directory names
const normalizeStringPosix = (path, allowAboveRoot) => {
  let res = ''
  let lastSegmentLength = 0
  let lastSlash = -1
  let dots = 0
  let code
  for (let i = 0; i <= path.length; ++i) {
    if (i < path.length) code = path.charCodeAt(i)
    else if (code === 47 /* / */) break
    else code = 47 /* / */
    if (code === 47 /* / */) {
      if (lastSlash === i - 1 || dots === 1) {
        // NOOP
      } else if (lastSlash !== i - 1 && dots === 2) {
        if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== 46 /* . */ || res.charCodeAt(res.length - 2) !== 46 /* . */) {
          if (res.length > 2) {
            const lastSlashIndex = res.lastIndexOf('/')
            if (lastSlashIndex !== res.length - 1) {
              if (lastSlashIndex === -1) {
                res = ''
                lastSegmentLength = 0
              } else {
                res = res.slice(0, lastSlashIndex)
                lastSegmentLength = res.length - 1 - res.lastIndexOf('/')
              }
              lastSlash = i
              dots = 0
              continue
            }
          } else if (res.length === 2 || res.length === 1) {
            res = ''
            lastSegmentLength = 0
            lastSlash = i
            dots = 0
            continue
          }
        }
        if (allowAboveRoot) {
          if (res.length > 0) res += '/..'
          else res = '..'
          lastSegmentLength = 2
        }
      } else {
        if (res.length > 0) res += '/' + path.slice(lastSlash + 1, i)
        else res = path.slice(lastSlash + 1, i)
        lastSegmentLength = i - lastSlash - 1
      }
      lastSlash = i
      dots = 0
    } else if (code === 46 /* . */ && dots !== -1) {
      ++dots
    } else {
      dots = -1
    }
  }
  return res
}

const normalize = (path) => {
  assertPath(path)

  if (path.length === 0) return '.'

  const isAbsolute = path.charCodeAt(0) === 47 /* / */
  const trailingSeparator = path.charCodeAt(path.length - 1) === 47 /* / */

  // Normalize the path
  path = normalizeStringPosix(path, !isAbsolute)

  if (path.length === 0 && !isAbsolute) path = '.'
  if (path.length > 0 && trailingSeparator) path += '/'

  if (isAbsolute) return '/' + path
  return path
}

export const joinPath = (...args) => {
  if (args.length === 0) return '.'
  let joined
  for (let i = 0; i < args.length; ++i) {
    assertPath(args[i])
    if (args[i].length > 0) {
      if (joined === undefined) joined = args[i]
      else joined += '/' + args[i]
    }
  }
  if (joined === undefined) return '.'
  return normalize(joined)
}
