/* global describe, it, beforeEach, before, afterEach, after */
'use strict'

import { default as getData, getMigratedDataModel } from './data'
import { validateId } from './util'
import jetpack from 'fs-jetpack'
import { connect } from '../index'
import chai from 'chai'
import dirtyChai from 'dirty-chai'

chai.use(dirtyChai)
const expect = chai.expect


jetpack.dir('tmp')
const tmpDir = jetpack.cwd('tmp')

describe('Migration', () => {
  // TODO: Should probably use mock database client...
  const path = tmpDir.path('nedb')
  const url = 'nedb://' + path
  // const url = 'mongodb://localhost/camo_test';

  it('test', async () => {
    let {Document, EmbeddedDocument, validators, client: database} = await connect(url)
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
        entry.values = entry.values.map(x => x+1)
        return entry
      }]
    }
    await database.close();

    ({Document, EmbeddedDocument, validators, client: database} = await connect(url, undefined, migrations))

    Data = getMigratedDataModel(Document)
    await Data._migrateCollection()
    let res = await Data.find({})
    expect(res.length).to.equal(1);

    ({Document, EmbeddedDocument, validators, client: database} = await connect(url, undefined, migrations))

    Data = getMigratedDataModel(Document)
    await Data._migrateCollection()
    res = await Data.find({})
    expect(res.length).to.equal(1)
  })
})