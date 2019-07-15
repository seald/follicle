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

describe('Migration', async () => {
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
    let Data = await getData(Document)
    await Data.clearCollection()
    let d = Data.create({
      number: 3,
      item: 32,
      values: [1, 2, 3, 4]
    })
    await d.save()

    const _res = await Data.find({})
    expect(_res.length).to.equal(1)

    const migrations = {
      Data: [entry => {
        entry.source = entry.source === 'reddit' ? 'redit' : entry.source
        entry.values = entry.values.map(x => x + 1)
        return entry
      }]
    }
    await database.close();

    ({ Document, client: database } = await connect(url, undefined, migrations))

    Data = getMigratedDataModel(Document)
    await Data._migrateCollection()
    let res = await Data.find({})
    expect(res.length).to.equal(1);

    ({ Document, client: database } = await connect(url, undefined, migrations))

    Data = getMigratedDataModel(Document)
    await Data._migrateCollection()
    res = await Data.find({})
    expect(res.length).to.equal(1)
  })

  it('nedb crash', async () => {
    let { Document, client: database } = await connect(url2)
    let Data = await getData(Document)
    await Data._migrateCollection().then(() => {
      throw new Error('Should have failed')
    }, (error) => {
      assert(error instanceof Error)
    })
    await database.close()
  })
})
