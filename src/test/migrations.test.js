/* eslint-env mocha */
import jetpack from 'fs-jetpack'
import { connect } from '../lib/connect'
import chai from 'chai'
import dirtyChai from 'dirty-chai'
import chaiAsPromised from 'chai-as-promised'

chai.use(dirtyChai)
chai.use(chaiAsPromised)
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

  it('Opening database with migrations, but not executing migrations', async () => {
    // Defining model
    const makeModel = Document => class Data extends Document {
      constructor () {
        super()
        this.schema({ number: { type: Number } })
      }
    }

    // Defining migrations
    const migrations = {
      Data: [entry => {
        entry.number += 1
        return entry
      }]
    }

    // Defining pre-migration data
    const data = [{ number: 1 }]

    // Connecting database without migrations, and instantiating the Data model
    let { Document, client: database } = await connect(url)
    let Data = await makeModel(Document)

    // Creating & saving pre-migration document
    const initialDocument0 = Data.create(data[0])
    await initialDocument0.save()

    // Checking it is ok at the follicle level
    const oldDocuments = await Data.find({}, { sort: ['number'] })
    assert.strictEqual(oldDocuments.length, 1)

    assert.isNotNull(oldDocuments[0]._id)
    assert.include(oldDocuments[0], data[0])

    // Checking it is ok at the nedb level
    const rawOldDocument0 = await database.findOne('Data', { _id: oldDocuments[0]._id })
    assert.strictEqual(rawOldDocument0._id, oldDocuments[0]._id)
    assert.include(rawOldDocument0, data[0])
    assert.strictEqual(rawOldDocument0._version, 0)

    // Closing database, re-opening it with migrations and instantiating the Data model
    await database.close();
    ({ Document, client: database } = await connect(url, undefined, migrations))
    Data = await makeModel(Document)

    // We use the database before actually migrating
    await assert.isRejected(Data.find({}, { sort: ['number'] }), 'There are documents that don\'t match the migration version, some migrations are not applied, or the database is too recent.')
  })

  it('Simple migration without changes in the model, but re-opening without migrations', async () => {
    // Defining model
    const makeModel = Document => class Data extends Document {
      constructor () {
        super()
        this.schema({ number: { type: Number } })
      }
    }

    // Defining migrations
    const migrations = {
      Data: [entry => {
        entry.number += 1
        return entry
      }]
    }

    // Defining pre-migration data
    const data = [{ number: 1 }]

    // Defining post-migration data
    const migratedData = [{ number: 2 }]

    // Connecting database without migrations, and instantiating the Data model
    let { Document, client: database } = await connect(url)
    let Data = await makeModel(Document)

    // Creating & saving pre-migration document
    const initialDocument0 = Data.create(data[0])
    await initialDocument0.save()

    // Checking it is ok at the follicle level
    const oldDocuments = await Data.find({}, { sort: ['number'] })
    assert.strictEqual(oldDocuments.length, 1)

    assert.isNotNull(oldDocuments[0]._id)
    assert.include(oldDocuments[0], data[0])

    // Checking it is ok at the nedb level
    const rawOldDocument0 = await database.findOne('Data', { _id: oldDocuments[0]._id })
    assert.strictEqual(rawOldDocument0._id, oldDocuments[0]._id)
    assert.include(rawOldDocument0, data[0])
    assert.strictEqual(rawOldDocument0._version, 0)

    // Closing database, re-opening it with migrations and instantiating the Data model
    await database.close();
    ({ Document, client: database } = await connect(url, undefined, migrations))
    Data = await makeModel(Document)

    // Migrating
    await Data._migrateCollection()

    // Checking it is ok at the follicle level
    const newDocuments = await Data.find({}, { sort: ['number'] })
    assert.strictEqual(newDocuments.length, 1)

    assert.strictEqual(newDocuments[0]._id, oldDocuments[0]._id)
    assert.include(newDocuments[0], migratedData[0])

    // Checking it is ok at the nedb level
    const rawNewDocument0 = await database.findOne('Data', { _id: oldDocuments[0]._id })
    assert.strictEqual(rawNewDocument0._id, oldDocuments[0]._id)
    assert.include(rawNewDocument0, migratedData[0])
    assert.strictEqual(rawNewDocument0._version, 1)

    await database.close();
    // re-loading migrated db
    ({ Document, client: database } = await connect(url))
    Data = await makeModel(Document)

    // The documents in database are in _version: 1, but the migrations array is empty, follicle expects a _version: 0
    await assert.isRejected(Data.find({}, { sort: ['number'] }), 'There are documents that don\'t match the migration version, some migrations are not applied, or the database is too recent.')
  })

  it('Simple migration without changes in the model', async () => {
    // Defining model
    const makeModel = Document => class Data extends Document {
      constructor () {
        super()
        this.schema({ number: { type: Number } })
      }
    }

    // Defining migrations
    const migrations = {
      Data: [entry => {
        entry.number += 1
        return entry
      }]
    }

    // Defining pre-migration data
    const data = [{ number: 1 }]

    // Defining post-migration data
    const migratedData = [{ number: 2 }]

    // Connecting database without migrations, and instantiating the Data model
    let { Document, client: database } = await connect(url)
    let Data = await makeModel(Document)

    // Creating & saving pre-migration document
    const initialDocument0 = Data.create(data[0])
    await initialDocument0.save()

    // Checking it is ok at the follicle level
    const oldDocuments = await Data.find({}, { sort: ['number'] })
    assert.strictEqual(oldDocuments.length, 1)

    assert.isNotNull(oldDocuments[0]._id)
    assert.include(oldDocuments[0], data[0])

    // Checking it is ok at the nedb level
    const rawOldDocument0 = await database.findOne('Data', { _id: oldDocuments[0]._id })
    assert.strictEqual(rawOldDocument0._id, oldDocuments[0]._id)
    assert.include(rawOldDocument0, data[0])
    assert.strictEqual(rawOldDocument0._version, 0)

    // Closing database, re-opening it with migrations and instantiating the Data model
    await database.close();
    ({ Document, client: database } = await connect(url, undefined, migrations))
    Data = await makeModel(Document)

    // Migrating
    await Data._migrateCollection()

    // Checking it is ok at the follicle level
    const newDocuments = await Data.find({}, { sort: ['number'] })
    assert.strictEqual(newDocuments.length, 1)

    assert.strictEqual(newDocuments[0]._id, oldDocuments[0]._id)
    assert.include(newDocuments[0], migratedData[0])

    // Checking it is ok at the nedb level
    const rawNewDocument0 = await database.findOne('Data', { _id: oldDocuments[0]._id })
    assert.strictEqual(rawNewDocument0._id, oldDocuments[0]._id)
    assert.include(rawNewDocument0, migratedData[0])
    assert.strictEqual(rawNewDocument0._version, 1)

    await database.close();
    // re-loading migrated db
    ({ Document, client: database } = await connect(url, undefined, migrations))
    Data = await makeModel(Document)

    // Checking it is ok at the follicle level
    const reloadedDocuments = await Data.find({}, { sort: ['number'] })
    assert.strictEqual(reloadedDocuments.length, 1)

    assert.strictEqual(reloadedDocuments[0]._id, oldDocuments[0]._id)
    assert.include(reloadedDocuments[0], migratedData[0])

    // Checking it is ok at the nedb level
    const rawReloadedDocument0 = await database.findOne('Data', { _id: oldDocuments[0]._id })
    assert.strictEqual(rawReloadedDocument0._id, oldDocuments[0]._id)
    assert.include(rawReloadedDocument0, migratedData[0])
    assert.strictEqual(rawReloadedDocument0._version, 1)

    await database.close()
  })

  it('Migration that adds a constraint on an existing field, with no trouble', async () => {
    // Defining model
    const makeModel = Document => class Data extends Document {
      constructor () {
        super()
        this.schema({ number: { type: Number } })
      }
    }

    // Defining model
    const makeMigratedModel = Document => class Data extends Document {
      constructor () {
        super()
        this.schema({ number: { type: Number, unique: true } })
      }
    }

    // Defining migrations
    const migrations = {
      Data: [entry => {
        entry.number += 1
        return entry
      }]
    }

    // Defining pre-migration data
    const data = [{ number: 1 }, { number: 2 }]

    // Defining post-migration data
    const migratedData = [{ number: 2 }, { number: 3 }]

    // Connecting database without migrations, and instantiating the Data model
    let { Document, client: database } = await connect(url)
    let Data = await makeModel(Document)

    // Creating & saving pre-migration document
    const initialDocument0 = Data.create(data[0])
    await initialDocument0.save()

    const initialDocument1 = Data.create(data[1])
    await initialDocument1.save()

    // Checking it is ok at the follicle level
    const oldDocuments = await Data.find({}, { sort: ['number'] })
    assert.strictEqual(oldDocuments.length, 2)

    assert.isNotNull(oldDocuments[0]._id)
    assert.include(oldDocuments[0], data[0])

    assert.isNotNull(oldDocuments[1]._id)
    assert.include(oldDocuments[1], data[1])

    // Checking it is ok at the nedb level
    const rawOldDocument0 = await database.findOne('Data', { _id: oldDocuments[0]._id })
    assert.strictEqual(rawOldDocument0._id, oldDocuments[0]._id)
    assert.include(rawOldDocument0, data[0])
    assert.strictEqual(rawOldDocument0._version, 0)

    const rawOldDocument1 = await database.findOne('Data', { _id: oldDocuments[1]._id })
    assert.strictEqual(rawOldDocument1._id, oldDocuments[1]._id)
    assert.include(rawOldDocument1, data[1])
    assert.strictEqual(rawOldDocument1._version, 0)

    // Closing database, re-opening it with migrations and instantiating the migrated Data model
    await database.close();
    ({ Document, client: database } = await connect(url, undefined, migrations))
    Data = await makeMigratedModel(Document)

    // Migrating
    await Data._migrateCollection()

    // Checking it is ok at the follicle level
    const newDocuments = await Data.find({}, { sort: ['number'] })
    assert.strictEqual(newDocuments.length, 2)

    assert.strictEqual(newDocuments[0]._id, oldDocuments[0]._id)
    assert.include(newDocuments[0], migratedData[0])

    assert.strictEqual(newDocuments[1]._id, oldDocuments[1]._id)
    assert.include(newDocuments[1], migratedData[1])

    // Checking it is ok at the nedb level
    const rawNewDocument0 = await database.findOne('Data', { _id: oldDocuments[0]._id })
    assert.strictEqual(rawNewDocument0._id, oldDocuments[0]._id)
    assert.include(rawNewDocument0, migratedData[0])
    assert.strictEqual(rawNewDocument0._version, 1)
    const rawNewDocument1 = await database.findOne('Data', { _id: oldDocuments[1]._id })
    assert.strictEqual(rawNewDocument1._id, oldDocuments[1]._id)
    assert.include(rawNewDocument1, migratedData[1])
    assert.strictEqual(rawNewDocument1._version, 1)

    await database.close();
    // re-loading migrated db
    ({ Document, client: database } = await connect(url, undefined, migrations))
    Data = await makeMigratedModel(Document)

    // Checking it is ok at the follicle level
    const reloadedDocuments = await Data.find({}, { sort: ['number'] })
    assert.strictEqual(reloadedDocuments.length, 2)
    assert.strictEqual(reloadedDocuments[0]._id, oldDocuments[0]._id)
    assert.include(reloadedDocuments[0], migratedData[0])
    assert.strictEqual(reloadedDocuments[1]._id, oldDocuments[1]._id)
    assert.include(reloadedDocuments[1], migratedData[1])

    // Checking it is ok at the nedb level
    const rawReloadedDocument0 = await database.findOne('Data', { _id: oldDocuments[0]._id })
    assert.strictEqual(rawReloadedDocument0._id, oldDocuments[0]._id)
    assert.include(rawReloadedDocument0, migratedData[0])
    assert.strictEqual(rawReloadedDocument0._version, 1)

    const rawReloadedDocument1 = await database.findOne('Data', { _id: oldDocuments[1]._id })
    assert.strictEqual(rawReloadedDocument1._id, oldDocuments[1]._id)
    assert.include(rawReloadedDocument1, migratedData[1])
    assert.strictEqual(rawReloadedDocument1._version, 1)
    await database.close()
  })

  it('Migration that adds a constraint on a new field', async () => {
    // Defining model
    const makeModel = Document => class Data extends Document {
      constructor () {
        super()
        this.schema({ number: { type: Number } })
      }
    }

    // Defining model
    const makeMigratedModel = Document => class Data extends Document {
      constructor () {
        super()
        this.schema({
          number: { type: Number },
          newField: { type: String, unique: true }
        })
      }
    }

    // Defining migrations
    const migrations = {
      Data: [entry => {
        if (entry.number === 1) entry.newField = 'one'
        if (entry.number === 2) entry.newField = 'two'
        return entry
      }]
    }

    // Defining pre-migration data
    const data = [{ number: 1 }, { number: 2 }]

    // Defining post-migration data
    const migratedData = [{ number: 1, newField: 'one' }, { number: 2, newField: 'two' }]

    // Connecting database without migrations, and instantiating the Data model
    let { Document, client: database } = await connect(url)
    let Data = await makeModel(Document)

    // Creating & saving pre-migration document
    const initialDocument0 = Data.create(data[0])
    await initialDocument0.save()

    const initialDocument1 = Data.create(data[1])
    await initialDocument1.save()

    // Checking it is ok at the follicle level
    const oldDocuments = await Data.find({}, { sort: ['number'] })
    assert.strictEqual(oldDocuments.length, 2)

    assert.isNotNull(oldDocuments[0]._id)
    assert.include(oldDocuments[0], data[0])

    assert.isNotNull(oldDocuments[1]._id)
    assert.include(oldDocuments[1], data[1])

    // Checking it is ok at the nedb level
    const rawOldDocument0 = await database.findOne('Data', { _id: oldDocuments[0]._id })
    assert.strictEqual(rawOldDocument0._id, oldDocuments[0]._id)
    assert.include(rawOldDocument0, data[0])
    assert.strictEqual(rawOldDocument0._version, 0)

    const rawOldDocument1 = await database.findOne('Data', { _id: oldDocuments[1]._id })
    assert.strictEqual(rawOldDocument1._id, oldDocuments[1]._id)
    assert.include(rawOldDocument1, data[1])
    assert.strictEqual(rawOldDocument1._version, 0)

    // Closing database, re-opening it with migrations and instantiating the migrated Data model
    await database.close();
    ({ Document, client: database } = await connect(url, undefined, migrations))
    Data = await makeMigratedModel(Document)

    // Migrating
    await Data._migrateCollection()

    // Checking it is ok at the follicle level
    const newDocuments = await Data.find({}, { sort: ['number'] })
    assert.strictEqual(newDocuments.length, 2)

    assert.strictEqual(newDocuments[0]._id, oldDocuments[0]._id)
    assert.include(newDocuments[0], migratedData[0])

    assert.strictEqual(newDocuments[1]._id, oldDocuments[1]._id)
    assert.include(newDocuments[1], migratedData[1])

    // Checking it is ok at the nedb level
    const rawNewDocument0 = await database.findOne('Data', { _id: oldDocuments[0]._id })
    assert.strictEqual(rawNewDocument0._id, oldDocuments[0]._id)
    assert.include(rawNewDocument0, migratedData[0])
    assert.strictEqual(rawNewDocument0._version, 1)
    const rawNewDocument1 = await database.findOne('Data', { _id: oldDocuments[1]._id })
    assert.strictEqual(rawNewDocument1._id, oldDocuments[1]._id)
    assert.include(rawNewDocument1, migratedData[1])
    assert.strictEqual(rawNewDocument1._version, 1)

    await database.close();
    // re-loading migrated db
    ({ Document, client: database } = await connect(url, undefined, migrations))
    Data = await makeMigratedModel(Document)

    // Checking it is ok at the follicle level
    const reloadedDocuments = await Data.find({}, { sort: ['number'] })
    assert.strictEqual(reloadedDocuments.length, 2)
    assert.strictEqual(reloadedDocuments[0]._id, oldDocuments[0]._id)
    assert.include(reloadedDocuments[0], migratedData[0])
    assert.strictEqual(reloadedDocuments[1]._id, oldDocuments[1]._id)
    assert.include(reloadedDocuments[1], migratedData[1])

    // Checking it is ok at the nedb level
    const rawReloadedDocument0 = await database.findOne('Data', { _id: oldDocuments[0]._id })
    assert.strictEqual(rawReloadedDocument0._id, oldDocuments[0]._id)
    assert.include(rawReloadedDocument0, migratedData[0])
    assert.strictEqual(rawReloadedDocument0._version, 1)

    const rawReloadedDocument1 = await database.findOne('Data', { _id: oldDocuments[1]._id })
    assert.strictEqual(rawReloadedDocument1._id, oldDocuments[1]._id)
    assert.include(rawReloadedDocument1, migratedData[1])
    assert.strictEqual(rawReloadedDocument1._version, 1)
    await database.close()
  })

  it('Migration that adds a constraint on an existing field, with duplicates (should throw)', async () => {
    // Defining model
    const makeModel = Document => class Data extends Document {
      constructor () {
        super()
        this.schema({
          number: { type: Number },
          constrained: { type: String }
        })
      }
    }

    // Defining model
    const makeMigratedModel = Document => class Data extends Document {
      constructor () {
        super()
        this.schema({
          number: { type: Number },
          constrained: { type: String, unique: true }
        })
      }
    }

    // Defining migrations
    const migrations = {
      Data: [entry => entry]
    }

    // Defining pre-migration data
    const data = [{ number: 1, constrained: 'duplicate' }, { number: 2, constrained: 'duplicate' }]

    // Defining post-migration data
    const migratedData = [{ number: 1, constrained: 'duplicate' }, { number: 2, constrained: 'duplicate' }]

    // Connecting database without migrations, and instantiating the Data model
    let { Document, client: database } = await connect(url)
    let Data = await makeModel(Document)

    // Creating & saving pre-migration document
    const initialDocument0 = Data.create(data[0])
    await initialDocument0.save()

    const initialDocument1 = Data.create(data[1])
    await initialDocument1.save()

    // Checking it is ok at the follicle level
    const oldDocuments = await Data.find({}, { sort: ['number'] })
    assert.strictEqual(oldDocuments.length, 2)

    assert.isNotNull(oldDocuments[0]._id)
    assert.include(oldDocuments[0], data[0])

    assert.isNotNull(oldDocuments[1]._id)
    assert.include(oldDocuments[1], data[1])

    // Checking it is ok at the nedb level
    const rawOldDocument0 = await database.findOne('Data', { _id: oldDocuments[0]._id })
    assert.strictEqual(rawOldDocument0._id, oldDocuments[0]._id)
    assert.include(rawOldDocument0, data[0])
    assert.strictEqual(rawOldDocument0._version, 0)

    const rawOldDocument1 = await database.findOne('Data', { _id: oldDocuments[1]._id })
    assert.strictEqual(rawOldDocument1._id, oldDocuments[1]._id)
    assert.include(rawOldDocument1, data[1])
    assert.strictEqual(rawOldDocument1._version, 0)

    // Closing database, re-opening it with migrations and instantiating the migrated Data model
    await database.close();
    ({ Document, client: database } = await connect(url, undefined, migrations))
    Data = await makeMigratedModel(Document)

    // Migration will fail as the new constraint does not allow duplicate values of number, in this case the duplicate value is 1
    await assert.isRejected(Data._migrateCollection(), `Can't insert key ${migratedData[1].constrained}, it violates the unique constraint`)
  })

  it('Migration that removes a constraint on an existing field', async () => {
    // Defining model
    const makeModel = Document => class Data extends Document {
      constructor () {
        super()
        this.schema({
          number: { type: Number },
          constrained: { type: String, unique: true }
        })
      }
    }

    // Defining model
    const makeMigratedModel = Document => class Data extends Document {
      constructor () {
        super()
        this.schema({
          number: { type: Number },
          constrained: { type: String }
        })
      }
    }

    // Defining migrations
    const migrations = {
      Data: [entry => {
        entry.constrained = 'duplicate'
        return entry
      }]
    }

    // Defining pre-migration data
    const data = [{ number: 1, constrained: '1' }, { number: 2, constrained: '2' }]

    // Defining post-migration data
    const migratedData = [{ number: 1, constrained: 'duplicate' }, { number: 2, constrained: 'duplicate' }]

    // Connecting database without migrations, and instantiating the Data model
    let { Document, client: database } = await connect(url)
    let Data = await makeModel(Document)

    // Creating & saving pre-migration document
    const initialDocument0 = Data.create(data[0])
    await initialDocument0.save()

    const initialDocument1 = Data.create(data[1])
    await initialDocument1.save()

    // Checking it is ok at the follicle level
    const oldDocuments = await Data.find({}, { sort: ['number'] })
    assert.strictEqual(oldDocuments.length, 2)

    assert.isNotNull(oldDocuments[0]._id)
    assert.include(oldDocuments[0], data[0])

    assert.isNotNull(oldDocuments[1]._id)
    assert.include(oldDocuments[1], data[1])

    // Checking it is ok at the nedb level
    const rawOldDocument0 = await database.findOne('Data', { _id: oldDocuments[0]._id })
    assert.strictEqual(rawOldDocument0._id, oldDocuments[0]._id)
    assert.include(rawOldDocument0, data[0])
    assert.strictEqual(rawOldDocument0._version, 0)

    const rawOldDocument1 = await database.findOne('Data', { _id: oldDocuments[1]._id })
    assert.strictEqual(rawOldDocument1._id, oldDocuments[1]._id)
    assert.include(rawOldDocument1, data[1])
    assert.strictEqual(rawOldDocument1._version, 0)

    // Closing database, re-opening it with migrations and instantiating the migrated Data model
    await database.close();
    ({ Document, client: database } = await connect(url, undefined, migrations))
    Data = await makeMigratedModel(Document)

    // Migrating
    await Data._migrateCollection()

    // Checking it is ok at the follicle level
    const newDocuments = await Data.find({}, { sort: ['number'] })
    assert.strictEqual(newDocuments.length, 2)

    assert.strictEqual(newDocuments[0]._id, oldDocuments[0]._id)
    assert.include(newDocuments[0], migratedData[0])

    assert.strictEqual(newDocuments[1]._id, oldDocuments[1]._id)
    assert.include(newDocuments[1], migratedData[1])

    // Checking it is ok at the nedb level
    const rawNewDocument0 = await database.findOne('Data', { _id: oldDocuments[0]._id })
    assert.strictEqual(rawNewDocument0._id, oldDocuments[0]._id)
    assert.include(rawNewDocument0, migratedData[0])
    assert.strictEqual(rawNewDocument0._version, 1)

    const rawNewDocument1 = await database.findOne('Data', { _id: oldDocuments[1]._id })
    assert.strictEqual(rawNewDocument1._id, oldDocuments[1]._id)
    assert.include(rawNewDocument1, migratedData[1])
    assert.strictEqual(rawNewDocument1._version, 1)

    await database.close();
    // re-loading migrated db
    ({ Document, client: database } = await connect(url, undefined, migrations))
    Data = await makeMigratedModel(Document)

    // Checking it is ok at the follicle level
    const reloadedDocuments = await Data.find({}, { sort: ['number'] })
    assert.strictEqual(reloadedDocuments.length, 2)
    assert.strictEqual(reloadedDocuments[0]._id, oldDocuments[0]._id)
    assert.include(reloadedDocuments[0], migratedData[0])
    assert.strictEqual(reloadedDocuments[1]._id, oldDocuments[1]._id)
    assert.include(reloadedDocuments[1], migratedData[1])

    // Checking it is ok at the nedb level
    const rawReloadedDocument0 = await database.findOne('Data', { _id: oldDocuments[0]._id })
    assert.strictEqual(rawReloadedDocument0._id, oldDocuments[0]._id)
    assert.include(rawReloadedDocument0, migratedData[0])
    assert.strictEqual(rawReloadedDocument0._version, 1)

    const rawReloadedDocument1 = await database.findOne('Data', { _id: oldDocuments[1]._id })
    assert.strictEqual(rawReloadedDocument1._id, oldDocuments[1]._id)
    assert.include(rawReloadedDocument1, migratedData[1])
    assert.strictEqual(rawReloadedDocument1._version, 1)
    await database.close()
  })

  it('Migration that renames a constrained field', async () => {
    // Defining model
    const makeModel = Document => class Data extends Document {
      constructor () {
        super()
        this.schema({ number: { type: Number, unique: true } })
      }
    }

    // Defining model
    const makeMigratedModel = Document => class Data extends Document {
      constructor () {
        super()
        this.schema({ numberRenamed: { type: Number, unique: true } })
      }
    }

    // Defining migrations
    const migrations = {
      Data: [entry => {
        entry.numberRenamed = entry.number
        delete entry.number
        return entry
      }]
    }

    // Defining pre-migration data
    const data = [{ number: 1 }, { number: 2 }]

    // Defining post-migration data
    const migratedData = [{ numberRenamed: 1 }, { numberRenamed: 2 }]

    // Connecting database without migrations, and instantiating the Data model
    let { Document, client: database } = await connect(url)
    let Data = await makeModel(Document)

    // Creating & saving pre-migration document
    const initialDocument0 = Data.create(data[0])
    await initialDocument0.save()

    const initialDocument1 = Data.create(data[1])
    await initialDocument1.save()

    // Checking it is ok at the follicle level
    const oldDocuments = await Data.find({}, { sort: ['number'] })
    assert.strictEqual(oldDocuments.length, 2)

    assert.isNotNull(oldDocuments[0]._id)
    assert.include(oldDocuments[0], data[0])

    assert.isNotNull(oldDocuments[1]._id)
    assert.include(oldDocuments[1], data[1])

    // Checking it is ok at the nedb level
    const rawOldDocument0 = await database.findOne('Data', { _id: oldDocuments[0]._id })
    assert.strictEqual(rawOldDocument0._id, oldDocuments[0]._id)
    assert.include(rawOldDocument0, data[0])
    assert.strictEqual(rawOldDocument0._version, 0)

    const rawOldDocument1 = await database.findOne('Data', { _id: oldDocuments[1]._id })
    assert.strictEqual(rawOldDocument1._id, oldDocuments[1]._id)
    assert.include(rawOldDocument1, data[1])
    assert.strictEqual(rawOldDocument1._version, 0)

    // Closing database, re-opening it with migrations and instantiating the migrated Data model
    await database.close();
    ({ Document, client: database } = await connect(url, undefined, migrations))
    Data = await makeMigratedModel(Document)

    // Migrating
    await Data._migrateCollection()

    // Checking it is ok at the follicle level
    const newDocuments = await Data.find({}, { sort: ['numberRenamed'] })
    assert.strictEqual(newDocuments.length, 2)

    assert.strictEqual(newDocuments[0]._id, oldDocuments[0]._id)
    assert.include(newDocuments[0], migratedData[0])

    assert.strictEqual(newDocuments[1]._id, oldDocuments[1]._id)
    assert.include(newDocuments[1], migratedData[1])

    // Checking it is ok at the nedb level
    const rawNewDocument0 = await database.findOne('Data', { _id: oldDocuments[0]._id })
    assert.strictEqual(rawNewDocument0._id, oldDocuments[0]._id)
    assert.include(rawNewDocument0, migratedData[0])
    assert.strictEqual(rawNewDocument0._version, 1)
    const rawNewDocument1 = await database.findOne('Data', { _id: oldDocuments[1]._id })
    assert.strictEqual(rawNewDocument1._id, oldDocuments[1]._id)
    assert.include(rawNewDocument1, migratedData[1])
    assert.strictEqual(rawNewDocument1._version, 1)

    await database.close();
    // re-loading migrated db
    ({ Document, client: database } = await connect(url, undefined, migrations))
    Data = await makeMigratedModel(Document)

    // Checking it is ok at the follicle level
    const reloadedDocuments = await Data.find({}, { sort: ['numberRenamed'] })
    assert.strictEqual(reloadedDocuments.length, 2)
    assert.strictEqual(reloadedDocuments[0]._id, oldDocuments[0]._id)
    assert.include(reloadedDocuments[0], migratedData[0])
    assert.strictEqual(reloadedDocuments[1]._id, oldDocuments[1]._id)
    assert.include(reloadedDocuments[1], migratedData[1])

    // Checking it is ok at the nedb level
    const rawReloadedDocument0 = await database.findOne('Data', { _id: oldDocuments[0]._id })
    assert.strictEqual(rawReloadedDocument0._id, oldDocuments[0]._id)
    assert.include(rawReloadedDocument0, migratedData[0])
    assert.strictEqual(rawReloadedDocument0._version, 1)

    const rawReloadedDocument1 = await database.findOne('Data', { _id: oldDocuments[1]._id })
    assert.strictEqual(rawReloadedDocument1._id, oldDocuments[1]._id)
    assert.include(rawReloadedDocument1, migratedData[1])
    assert.strictEqual(rawReloadedDocument1._version, 1)
    await database.close()
  })

  it('nedb crash', async () => {
    // Defining model
    const makeModel = Document => class Data extends Document {
      constructor () {
        super()
        this.schema({ number: { type: Number, unique: true } })
      }
    }
    const { Document } = await connect(url2)
    const Data = makeModel(Document)
    await assert.isRejected(Data._migrateCollection(), 'More than 10% of the data file is corrupt')
  })
})
