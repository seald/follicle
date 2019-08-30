'use strict'

/*
 * Base Camo error.
 *
 * Adapted from es6-error package.
 */
export class CamoError extends Error {
  constructor (message) {
    super(message)

    // Extending Error is weird and does not propagate `message`
    Object.defineProperty(this, 'message', {
      enumerable: false,
      value: message
    })

    Object.defineProperty(this, 'name', {
      enumerable: false,
      value: this.constructor.name
    })

    if (Object.prototype.hasOwnProperty.call(Error, 'captureStackTrace')) {
      Error.captureStackTrace(this, this.constructor)
      return
    }

    Object.defineProperty(this, 'stack', {
      enumerable: false,
      value: (new Error(message)).stack
    })
  }
}

/*
 * Error indicating document didn't pass validation.
 */
export class ValidationError extends CamoError {}
