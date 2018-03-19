/* global describe, it, beforeEach, before, afterEach, after */

'use strict'
import chai from 'chai'
import dirtyChai from 'dirty-chai'
import { connect } from '../index'
import { validateId } from './util'
import getFooBar from './cyclic'

chai.use(dirtyChai)
const expect = chai.expect

describe('Cyclic', function () {
  // TODO: Should probably use mock database client...
  const url = 'nedb://memory'
  // const url = 'mongodb://localhost/camo_test';
  let database = null
  let Document, EmbeddedDocument, validators
  let Foo, Bar
  before(async () => {
    ({Document, EmbeddedDocument, validators, client: database} = await connect(url));
    await database.dropDatabase()
    ({Foo, Bar} = getFooBar(Document))
  })

  beforeEach(function (done) {
    done()
  })

  afterEach(function (done) {
    database.dropDatabase().then(function () {}).then(done, done)
  })

  after(function (done) {
    database.dropDatabase().then(function () {}).then(done, done)
  })

  describe('schema', function () {
    it('should allow cyclic dependencies', function (done) {
      let f = Foo.create()
      f.num = 26
      let b = Bar.create()
      b.num = 99

      f.save().then(function (foo) {
        b.foo = foo
        return b.save()
      }).then(function (bar) {
        f.bar = b
        return f.save()
      }).then(function (foo) {
        return Foo.findOne({ num: 26 })
      }).then(function (foo) {
        validateId(foo)
        validateId(foo.bar)
        expect(foo.num).to.be.equal(26)
        expect(foo.bar.num).to.be.equal(99)
        return Bar.findOne({ num: 99 })
      }).then(function (bar) {
        validateId(bar)
        validateId(bar.foo)
        expect(bar.num).to.be.equal(99)
        expect(bar.foo.num).to.be.equal(26)
      }).then(done, done)
    })
  })
})
