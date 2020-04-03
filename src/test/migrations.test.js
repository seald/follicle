/* global describe, it, beforeEach, afterEach */
'use strict'

import getData, { getMigratedDataModel } from './data'
import jetpack from 'fs-jetpack'
import { connect } from '../lib/connect'
import chai from 'chai'
import dirtyChai from 'dirty-chai'

chai.use(dirtyChai)
const expect = chai.expect
const assert = chai.assert

describe('Migration', () => {
  const tmpDir = jetpack.cwd('tmp')
  const path = tmpDir.path('nedb')
  const crashedDataDirPath = jetpack.cwd('src/test/nedbdata').path()
  const url = 'nedb://' + path
  const url2 = 'nedb://' + crashedDataDirPath
  beforeEach(() => {
    tmpDir.dir('.')
  })

  afterEach(() => {
    tmpDir.remove()
  })

  it('test', async () => {
    let { Document, client: database } = await connect(url)
    // Get the old model
    let Data = await getData(Document)
    await Data.clearCollection()

    // Creating a Data with the old model
    const d = Data.create({
      number: 3,
      item: 32,
      values: [1, 2, 3, 4]
    })
    // Saving it
    await d.save()

    // Asserting that it is what we expect it to be
    const oldRes = await Data.find({})
    expect(oldRes.length).to.equal(1)

    const oldEl = oldRes[0]
    expect(oldEl.number).to.equal(3)
    expect(oldEl.source).to.equal('reddit')
    expect(oldEl.item).to.equal(32)
    expect(oldEl.values).to.deep.equal([1, 2, 3, 4])
    expect(oldEl.fluffykin).to.equal(undefined)
    expect(oldEl._id).not.to.equal(undefined)

    const rawOldEl = await database.findOne('Data', { _id: oldEl._id })
    expect(rawOldEl.number).to.equal(3)
    expect(rawOldEl.source).to.equal('reddit')
    expect(rawOldEl.item).to.equal(32)
    expect(rawOldEl.values).to.deep.equal([1, 2, 3, 4])
    expect(rawOldEl.fluffykin).to.equal(undefined)
    expect(rawOldEl._id).to.equal(oldEl._id)
    expect(rawOldEl._version).to.equal(0)

    // Defining migrations
    const migrations = {
      Data: [entry => {
        entry.source = entry.source === 'reddit' ? 'redit' : entry.source
        entry.values = entry.values.map(x => x + 1)
        entry.fluffykin = entry.item
        delete entry.item
        return entry
      }]
    }
    await database.close();

    ({ Document, client: database } = await connect(url, undefined, migrations))

    // Get the new model
    Data = getMigratedDataModel(Document)
    // Migrate
    await Data._migrateCollection()
    // Check it has been migrated
    const newRes = await Data.find({})
    expect(newRes.length).to.equal(1)

    const newEl = newRes[0]
    expect(newEl.number).to.equal(3)
    expect(newEl.source).to.equal('redit')
    expect(newEl.item).to.equal(undefined)
    expect(newEl.values).to.deep.equal([2, 3, 4, 5])
    expect(newEl.fluffykin).to.equal(32)
    expect(newEl._id).to.equal(oldEl._id)

    const rawNewEl = await database.findOne('Data', { _id: oldEl._id })
    expect(rawNewEl.number).to.equal(3)
    expect(rawNewEl.source).to.equal('redit')
    expect(rawNewEl.item).to.equal(undefined)
    expect(rawNewEl.values).to.deep.equal([2, 3, 4, 5])
    expect(rawNewEl.fluffykin).to.equal(32)
    expect(rawNewEl._id).to.equal(newEl._id)
    expect(rawNewEl._version).to.equal(1)
    await database.close();

    // re-loading migrated db
    ({ Document, client: database } = await connect(url, undefined, migrations))

    Data = getMigratedDataModel(Document)
    // check that persisted data has already been migrated

    const rawNewEl2 = await database.findOne('Data', { _id: oldEl._id })
    expect(rawNewEl2.number).to.equal(3)
    expect(rawNewEl2.source).to.equal('redit')
    expect(rawNewEl2.item).to.equal(undefined)
    expect(rawNewEl2.values).to.deep.equal([2, 3, 4, 5])
    expect(rawNewEl2.fluffykin).to.equal(32)
    expect(rawNewEl2._id).to.equal(newEl._id)
    expect(rawNewEl2._version).to.equal(1)

    // instantiating model without migrating
    // it shouldn't break anything here because it has already been migrated
    // BUT the _migrateCollection should always be called before doing any operation anyway

    const newRes2 = await Data.find({})
    expect(newRes2.length).to.equal(1)
    // asserting everything is fine

    const newEl2 = newRes[0]
    expect(newEl2.number).to.equal(3)
    expect(newEl2.source).to.equal('redit')
    expect(newEl2.item).to.equal(undefined)
    expect(newEl2.values).to.deep.equal([2, 3, 4, 5])
    expect(newEl2.fluffykin).to.equal(32)
    expect(newEl2._id).to.equal(oldEl._id)
  })
  it('nedb crash', async () => {
    let Document, database
    try {
      ({ Document, client: database } = await connect(url2))
      const Data = await getData(Document)
      await Data._migrateCollection()
      return Promise.reject(new Error('Should have failed'))
    } catch (error) {
      assert.instanceOf(error, Error)
      await database.close()
    }
  })
})
