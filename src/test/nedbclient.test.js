/* eslint-env mocha */

import dirtyChai from 'dirty-chai'
import chai from 'chai'
import { connect } from '../lib/connect'
import { validateId } from './util'
import jetpack from 'fs-jetpack'

chai.use(dirtyChai)
const expect = chai.expect
const assert = chai.assert

const wd = jetpack.cwd('test_dir')

describe('NeDbClient', () => {
  const url = 'nedb://memory'
  let database = null
  let Document

  // TODO: This is acting weird. Randomly passes/fails. Seems to
  // be caused by document.test.js. When that one doesn't run,
  // this one always passes. Maybe some leftover files are still
  // floating around due to document.test.js?
  before(async () => {
    ({ Document, client: database } = await connect(url))
    await database.dropDatabase()
  })

  afterEach(() => database.dropDatabase())

  describe('id', () => {
    it('should allow custom _id values', async () => {
      class School extends Document {
        constructor () {
          super()

          this.name = String
        }
      }

      const school = School.create()
      school._id = '1234567890abcdef'
      school.name = 'South Park Elementary'

      await school.save()
      validateId(school)
      expect(school._id).to.be.equal('1234567890abcdef')
      const s = await School.findOne()
      validateId(s)
      expect(s._id).to.be.equal('1234567890abcdef')
    })
  })

  describe('indexes', () => {
    it('should reject documents with duplicate values in unique-indexed fields', async () => {
      class User extends Document {
        constructor () {
          super()

          this.schema({
            name: String,
            email: {
              type: String,
              unique: true
            }
          })
        }
      }

      const user1 = User.create()
      user1.name = 'Bill'
      user1.email = 'billy@example.com'

      const user2 = User.create()
      user2.name = 'Billy'
      user2.email = 'billy@example.com'

      await Promise.all([user1.save(), user2.save()])
        .then(() => expect.fail(null, Error, 'Expected error, but got none.'))
        .catch(error => expect(error.errorType).to.be.equal('uniqueViolated'))
    })

    it('should accept documents with duplicate values in non-unique-indexed fields', async () => {
      class User extends Document {
        constructor () {
          super()

          this.schema({
            name: String,
            email: {
              type: String,
              unique: false
            }
          })
        }
      }

      const user1 = User.create()
      user1.name = 'Bill'
      user1.email = 'billy@example.com'

      const user2 = User.create()
      user2.name = 'Billy'
      user2.email = 'billy@example.com'

      await Promise.all([user1.save(), user2.save()])
      validateId(user1)
      validateId(user2)
      expect(user1.email).to.be.equal('billy@example.com')
      expect(user2.email).to.be.equal('billy@example.com')
    })
    it('should accept documents with duplicate values in unique-indexed field, but with the indexed forcibly removed', async function () {
      class User extends Document {
        constructor () {
          super()

          this.schema({
            name: String,
            email: {
              type: String,
              unique: true
            }
          })
        }
      }

      const user1 = User.create()
      user1.name = 'Bill'
      user1.email = 'billy@example.com'

      await user1.save()

      const user2 = User.create()
      user1.name = 'Billy'
      user2.email = 'billy@example.com'
      assert.sameMembers(await database.listIndexes('User'), ['_id', 'email'])
      await database.removeIndex('User', 'email')

      await user2.save()

      validateId(user1)
      validateId(user2)
      expect(user1.email).to.be.equal('billy@example.com')
      expect(user2.email).to.be.equal('billy@example.com')
    })
  })
})

describe('NeDbClient on disk', () => {
  const url = 'nedb://' + wd.path('.')
  /** @type {NeDbClient} */
  let database
  let Document

  before(async () => {
    await wd.dirAsync('.', { empty: true });
    ({ Document, client: database } = await connect(url))
  })

  after(async () => {
    await wd.removeAsync('.', { recursive: true })
  })

  afterEach(() => database.dropDatabase())

  it('drop database should work', async () => {
    class School extends Document {
      constructor () {
        super()

        this.name = String
      }
    }

    const school = School.create()
    school.name = 'South Park Elementary'

    await school.save()
    expect(database._collections).to.have.own.property('School')
    let stat = await wd.inspectAsync('School.fdb')
    expect(stat).to.have.property('size')
    expect(stat.size).to.be.above(1)
    await database.dropDatabase()
    expect(database._collections).to.deep.equal({})
    stat = await wd.inspectAsync('School.fdb')
    expect(stat).to.equal(undefined)
  })

  it('drop corrupted database should work', async () => {
    class School extends Document {
      constructor () {
        super()

        this.name = String
      }
    }

    const school = School.create()
    school.name = 'South Park Elementary'

    await school.save()
    expect(database._collections).to.have.own.property('School')
    let stat = await wd.inspectAsync('School.fdb')
    expect(stat).to.have.property('size')
    expect(stat.size).to.be.above(1)

    await database.close()
    jetpack.append(wd.path('School.fdb'), 'Oh no!\nThat will clearly screw up the DB file !\nWhat a mess!');
    ({ Document, client: database } = await connect(url))

    database._getCollection('School') // No need to await the loading (which will fail anyway)

    await database.dropDatabase()
    expect(database._collections).to.deep.equal({})
    stat = await wd.inspectAsync('School.fdb')
    expect(stat).to.equal(undefined)
  })

  it('should execute all operations before closing', async () => {
    class School extends Document {
      constructor () {
        super()
        this.name = String
      }
    }
    for (let i = 0; i < 1000; i++) {
      const school = School.create()
      school.name = 'South Park Elementary'
      school.save() // not awaiting
    }
    await database.close()
    expect(database._collections).to.be.deep.equal({}) // proves that database is closed
    expect(await School.count({})).to.be.equal(1000)
    expect(Object.keys(database._collections)).to.have.members(['School'])
  })

  it('should not fail at closing if a task failed', async () => {
    class School extends Document {
      constructor () {
        super()

        this.email = {
          type: String,
          unique: true
        }
      }
    }
    let unhandled = 0

    process.on('unhandledRejection', (reason, promise) => {
      unhandled += 1
    })

    for (let i = 0; i < 10; i++) {
      const school = School.create()
      school.email = 'test@test.com'
      school.save() // not handled — 9 out of 10 of those will be rejected because of the `unique` constraint
    }
    await database.close() // should not throw

    expect(unhandled).to.be.equal(18) // somehow the unhandledRejection are emitted twice each, couldn't find why, not a major issue
    unhandled = 0
    const school = School.create()
    school.email = 'test@test.com'
    let error = false
    try {
      await school.save() // should reject but is correctly handled
    } catch (err) {
      error = true
    }
    await database.close()
    expect(unhandled).to.be.equal(0)
    expect(error).to.be.equal(true)
  })
})
