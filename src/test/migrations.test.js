/* eslint-env mocha */
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
      item: 32, // is unique and will be migrated to field `fluffykin`
      values: [1, 2, 3, 4]
    })

    const d2 = Data.create({
      number: 4,
      item: 34, // is unique and will be migrated to field `fluffykin`
      values: [1, 3, 4]
    })

    // Saving it
    await d.save()
    await d2.save()

    // Asserting that it is what we expect it to be
    const oldRes = await Data.find({})
    expect(oldRes.length).to.equal(2)

    const oldEl = oldRes.find(e => e.item === 32)
    expect(oldEl.number).to.equal(3)
    expect(oldEl.source).to.equal('reddit')
    expect(oldEl.item).to.equal(32)
    expect(oldEl.values).to.deep.equal([1, 2, 3, 4])
    expect(oldEl.fluffykin).to.equal(undefined)
    expect(oldEl._id).not.to.equal(undefined)

    const oldEl2 = oldRes.find(e => e.item === 34)
    expect(oldEl2.number).to.equal(4)
    expect(oldEl2.source).to.equal('reddit')
    expect(oldEl2.item).to.equal(34)
    expect(oldEl2.values).to.deep.equal([1, 3, 4])
    expect(oldEl2.fluffykin).to.equal(undefined)
    expect(oldEl2._id).not.to.equal(undefined)

    const rawOldEl = await database.findOne('Data', { _id: oldEl._id })
    expect(rawOldEl.number).to.equal(3)
    expect(rawOldEl.source).to.equal('reddit')
    expect(rawOldEl.item).to.equal(32)
    expect(rawOldEl.values).to.deep.equal([1, 2, 3, 4])
    expect(rawOldEl.fluffykin).to.equal(undefined)
    expect(rawOldEl._id).to.equal(oldEl._id)
    expect(rawOldEl._version).to.equal(0)

    const rawOldEl2 = await database.findOne('Data', { _id: oldEl2._id })
    expect(rawOldEl2.number).to.equal(4)
    expect(rawOldEl2.source).to.equal('reddit')
    expect(rawOldEl2.item).to.equal(34)
    expect(rawOldEl2.values).to.deep.equal([1, 3, 4])
    expect(rawOldEl2.fluffykin).to.equal(undefined)
    expect(rawOldEl2._id).to.equal(oldEl2._id)
    expect(rawOldEl2._version).to.equal(0)

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
    expect(newRes.length).to.equal(2)

    const newEl = newRes.find(e => e.fluffykin === 32)
    expect(newEl.number).to.equal(3)
    expect(newEl.source).to.equal('redit')
    expect(newEl.item).to.equal(undefined)
    expect(newEl.values).to.deep.equal([2, 3, 4, 5])
    expect(newEl.fluffykin).to.equal(32)
    expect(newEl._id).to.equal(oldEl._id)

    const newEl2 = newRes.find(e => e.fluffykin === 34)
    expect(newEl2.number).to.equal(4)
    expect(newEl2.source).to.equal('redit')
    expect(newEl2.item).to.equal(undefined)
    expect(newEl2.values).to.deep.equal([2, 4, 5])
    expect(newEl2.fluffykin).to.equal(34)
    expect(newEl2._id).to.equal(oldEl2._id)

    const rawNewEl = await database.findOne('Data', { _id: oldEl._id })
    expect(rawNewEl.number).to.equal(3)
    expect(rawNewEl.source).to.equal('redit')
    expect(rawNewEl.item).to.equal(undefined)
    expect(rawNewEl.values).to.deep.equal([2, 3, 4, 5])
    expect(rawNewEl.fluffykin).to.equal(32)
    expect(rawNewEl._id).to.equal(newEl._id)
    expect(rawNewEl._version).to.equal(1)

    const rawNewEl2 = await database.findOne('Data', { _id: oldEl2._id })
    expect(rawNewEl2.number).to.equal(4)
    expect(rawNewEl2.source).to.equal('redit')
    expect(rawNewEl2.item).to.equal(undefined)
    expect(rawNewEl2.values).to.deep.equal([2, 4, 5])
    expect(rawNewEl2.fluffykin).to.equal(34)
    expect(rawNewEl2._id).to.equal(newEl2._id)
    expect(rawNewEl2._version).to.equal(1)
    await database.close();

    // re-loading migrated db
    ({ Document, client: database } = await connect(url, undefined, migrations))

    Data = getMigratedDataModel(Document)
    // check that persisted data has already been migrated

    const rawNewElReloaded = await database.findOne('Data', { _id: oldEl._id })
    expect(rawNewElReloaded.number).to.equal(3)
    expect(rawNewElReloaded.source).to.equal('redit')
    expect(rawNewElReloaded.item).to.equal(undefined)
    expect(rawNewElReloaded.values).to.deep.equal([2, 3, 4, 5])
    expect(rawNewElReloaded.fluffykin).to.equal(32)
    expect(rawNewElReloaded._id).to.equal(newEl._id)
    expect(rawNewElReloaded._version).to.equal(1)

    const rawNewEl2Reloaded = await database.findOne('Data', { _id: oldEl2._id })
    expect(rawNewEl2Reloaded.number).to.equal(4)
    expect(rawNewEl2Reloaded.source).to.equal('redit')
    expect(rawNewEl2Reloaded.item).to.equal(undefined)
    expect(rawNewEl2Reloaded.values).to.deep.equal([2, 4, 5])
    expect(rawNewEl2Reloaded.fluffykin).to.equal(34)
    expect(rawNewEl2Reloaded._id).to.equal(newEl2._id)
    expect(rawNewEl2Reloaded._version).to.equal(1)

    // instantiating model without migrating
    // it shouldn't break anything here because it has already been migrated
    // BUT the _migrateCollection should always be called before doing any operation anyway

    const newResReloaded = await Data.find({})
    expect(newResReloaded.length).to.equal(2)
    // asserting everything is fine

    const newElReloaded = newRes.find(e => e.fluffykin === 32)
    expect(newElReloaded.number).to.equal(3)
    expect(newElReloaded.source).to.equal('redit')
    expect(newElReloaded.item).to.equal(undefined)
    expect(newElReloaded.values).to.deep.equal([2, 3, 4, 5])
    expect(newElReloaded.fluffykin).to.equal(32)
    expect(newElReloaded._id).to.equal(oldEl._id)

    const newEl2Reloaded = newRes.find(e => e.fluffykin === 34)
    expect(newEl2Reloaded.number).to.equal(4)
    expect(newEl2Reloaded.source).to.equal('redit')
    expect(newEl2Reloaded.item).to.equal(undefined)
    expect(newEl2Reloaded.values).to.deep.equal([2, 4, 5])
    expect(newEl2Reloaded.fluffykin).to.equal(34)
    expect(newEl2Reloaded._id).to.equal(oldEl2._id)
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
