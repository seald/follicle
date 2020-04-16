/* eslint-env mocha */

import chai from 'chai'
import dirtyChai from 'dirty-chai'
import { deepTraverse } from '../lib/util'

chai.use(dirtyChai)
const expect = chai.expect

describe('Util', () => {
  describe('deepTraverse()', () => {
    it('should iterate over all keys nested in an object', () => {
      const object = { a: [{ b: { c: 3 } }] }

      const keysSeen = []
      const valsSeen = []
      const parentsSeen = []

      deepTraverse(object, function (key, value, parent) {
        keysSeen.push(key)
        valsSeen.push(value)
        parentsSeen.push(parent)
      })

      expect(keysSeen).to.have.length(4)
      expect(keysSeen).to.include('a')
      expect(keysSeen).to.include('0')
      expect(keysSeen).to.include('b')
      expect(keysSeen).to.include('c')
      expect(valsSeen).to.have.length(4)
      expect(parentsSeen).to.have.length(4)
      expect(keysSeen[0]).to.be.equal('a')
      expect(parentsSeen[1]).to.be.equal(object.a)
    })
  })
})
