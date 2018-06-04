/* global describe, it, beforeEach, afterEach */
'use strict'

import { default as getData, getMigratedDataModel } from './data'
import jetpack from 'fs-jetpack'
import { connect } from '../lib/connect'
import chai from 'chai'
import dirtyChai from 'dirty-chai'

chai.use(dirtyChai)
const expect = chai.expect

describe('Migration', () => {
  const tmpDir = jetpack.cwd('tmp')
  const path = tmpDir.path('nedb')
  const url = 'nedb://' + path

  beforeEach(() => {
    tmpDir.dir('.')
  })

  afterEach(() => {
    tmpDir.remove()
  })

  it('test', async () => {
    let {Document, client: database} = await connect(url)
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

    ({Document, client: database} = await connect(url, undefined, migrations))

    Data = getMigratedDataModel(Document)
    await Data._migrateCollection()
    let res = await Data.find({})
    expect(res.length).to.equal(1);

    ({Document, client: database} = await connect(url, undefined, migrations))

    Data = getMigratedDataModel(Document)
    await Data._migrateCollection()
    res = await Data.find({})
    expect(res.length).to.equal(1)
  })
})
