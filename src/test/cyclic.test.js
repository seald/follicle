/* global describe, it, before, afterEach, after */

'use strict'
import chai from 'chai'
import dirtyChai from 'dirty-chai'
import { connect } from '../lib/connect'
import { validateId } from './util'
import getFooBar from './cyclic'

chai.use(dirtyChai)
const expect = chai.expect

describe('Cyclic', () => {
  // TODO: Should probably use mock database client...
  const url = 'nedb://memory'
  // const url = 'mongodb://localhost/camo_test';
  let database = null
  let Document
  let Foo, Bar

  before(async () => {
    ({ Document, client: database } = await connect(url))
    await database.dropDatabase();
    ({ Foo, Bar } = getFooBar(Document))
  })

  afterEach(() => database.dropDatabase())

  after(() => database.dropDatabase())

  describe('schema', () => {
    it('should allow cyclic dependencies', async () => {
      let f = Foo.create()
      f.num = 26
      let b = Bar.create()
      b.num = 99
      let foo = await f.save()
      b.foo = foo
      let bar = await b.save()
      f.bar = bar
      await f.save()
      foo = await Foo.findOne({ num: 26 })
      validateId(foo)
      validateId(foo.bar)
      expect(foo.num).to.be.equal(26)
      expect(foo.bar.num).to.be.equal(99)
      bar = await Bar.findOne({ num: 99 })
      validateId(bar)
      validateId(bar.foo)
      expect(bar.num).to.be.equal(99)
      expect(bar.foo.num).to.be.equal(26)
    })
  })
})
