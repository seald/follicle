import chai from 'chai'
import dirtyChai from 'dirty-chai'
import { inherits } from 'util'
import getData from './data'

chai.use(dirtyChai)
const expect = chai.expect
const assert = chai.assert

export const validateId = obj => {
  expect(obj).to.not.be.null()
  expect(obj).to.be.a('object')
  expect(obj._id.toString()).to.be.a('string')
  expect(obj._id.toString()).to.have.length.of.at.least(1)
}

export const data = Document => {
  const Data = getData(Document)

  return {
    data1 () {
      const data = Data.create()
      data.number = 1
      data.source = 'arstechnica'
      data.item = 99
      data.values = [33, 101, -1]
      data.date = 1434304033241
      return data
    },
    data2 () {
      const data = Data.create()
      data.number = 2
      data.source = 'reddit'
      data.item = 26
      data.values = [1, 2, 3, 4]
      data.date = 1434304039234
      return data
    }
  }
}

export const validateData1 = function (d) {
  assert.deepInclude(d, {
    number: 1,
    source: 'arstechnica',
    item: 99,
    values: [33, 101, -1],
    date: new Date(1434304033241)
  })
}

export const validateData2 = function (d) {
  assert.deepInclude(d, {
    number: 2,
    source: 'reddit',
    item: 26,
    values: [1, 2, 3, 4],
    date: new Date(1434304039234)
  })
}

// If we expect an error (and check for it in 'catch'), then
// we end up catching the error thrown when calling expect.fail.
// This means we'll actually catch the wrong error and give
// a false positive.
//
// This is my dumb way of getting around that.
const FailError = function (expected, actual, message) {
  Error.call(this)
  Error.captureStackTrace(this, FailError)
  this.name = 'FailError'
  this.expected = expected
  this.actual = actual
  this.message = message
}
inherits(FailError, Error)

export const fail = function (expected, actual, message) {
  throw new FailError(expected, actual, message)
}

export const expectError = function (error) {
  if (error instanceof FailError) {
    expect.fail(error.expected, error.actual, error.message)
    return
  }
  expect(error instanceof Error).to.be.true()
}
