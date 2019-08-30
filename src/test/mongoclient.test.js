/* global describe, it, before, after, afterEach */

'use strict'
import dirtyChai from 'dirty-chai'
import chai from 'chai'
import { ObjectId } from 'mongodb'
import { connect } from '../lib/connect'
import { validateId } from './util'

chai.use(dirtyChai)
const expect = chai.expect

describe('MongoClient', function () {
  const url = `mongodb://${process.env.MONGO_HOSTNAME}/camo_test`
  let Document
  let database = null
  let User

  before(async function () {
    if (!process.env.MONGO_HOSTNAME) this.skip()
    else {
      ({ Document, client: database } = await connect(url))
      await database.dropDatabase()
      User = class extends Document {
        constructor () {
          super()
          this.firstName = String
          this.lastName = String
        }
      }
    }
  })

  afterEach(function () {
    return database && database.dropDatabase()
  })

  after(async function () {
    if (database) await database.close()
  })

  describe('id', function () {
    before(function () {
      if (!process.env.MONGO_HOSTNAME) this.skip()
    })
    it('should allow custom _id values', async function () {
      class School extends Document {
        constructor () {
          super()

          this.name = String
        }
      }

      const school = School.create()
      school._id = new ObjectId('1234567890abcdef12345678')
      school.name = 'Springfield Elementary'

      await school.save()
      validateId(school)
      expect(school._id.toString()).to.be.equal('1234567890abcdef12345678')
      const s = await School.findOne()
      validateId(s)
      expect(s._id.toString()).to.be.equal('1234567890abcdef12345678')
    })
  })

  describe('query', function () {
    before(function () {
      if (!process.env.MONGO_HOSTNAME) this.skip()
    })
    /*
         * The MongoClient should cast all IDs to ObjectIDs. If the objects
         * requested aren't properly returned, then the IDs were not
         * successfully cast.
         */
    it('should automatically cast string ID in query to ObjectID', async function () {
      const user = User.create()
      user.firstName = 'Billy'
      user.lastName = 'Bob'

      await user.save()
      validateId(user)

      const id = String(user._id)
      const u = await User.findOne({ _id: id })
      validateId(u)
    })

    /*
         * Sanity check to make sure we didn't screw up the case
         * where user actually passes an ObjectId
         */
    it('should automatically cast string ID in query to ObjectID', async function () {
      const user = User.create()
      user.firstName = 'Billy'
      user.lastName = 'Bob'

      await user.save()
      validateId(user)

      const u = await User.findOne({ _id: user._id })
      validateId(u)
    })

    /*
         * Same as above, but we're testing out more complicated
         * queries. In this case we try it with '$in'.
         */
    it('should automatically cast string IDs in \'$in\' operator to ObjectIDs', async function () {
      const user1 = User.create()
      user1.firstName = 'Billy'
      user1.lastName = 'Bob'

      const user2 = User.create()
      user2.firstName = 'Jenny'
      user2.lastName = 'Jane'

      const user3 = User.create()
      user3.firstName = 'Danny'
      user3.lastName = 'David'

      await Promise.all([user1.save(), user2.save(), user3.save()])
      validateId(user1)
      validateId(user2)

      const id1 = String(user1._id)
      const id3 = String(user3._id)
      const users = await User.find({ _id: { $in: [id1, id3] } })
      expect(users).to.have.length(2)

      const u1 = String(users[0]._id) === String(user1._id) ? users[0] : users[1]
      const u3 = String(users[1]._id) === String(user3._id) ? users[1] : users[0]

      expect(String(u1._id)).to.be.equal(String(user1._id))
      expect(String(u3._id)).to.be.equal(String(user3._id))
    })

    it('should automatically cast string IDs in deep query objects', async function () {
      const user1 = User.create()
      user1.firstName = 'Billy'
      user1.lastName = 'Bob'

      const user2 = User.create()
      user2.firstName = 'Jenny'
      user2.lastName = 'Jane'

      const user3 = User.create()
      user3.firstName = 'Danny'
      user3.lastName = 'David'

      await Promise.all([user1.save(), user2.save(), user3.save()])
      validateId(user1)
      validateId(user2)

      const id1 = String(user1._id)
      const id3 = String(user3._id)
      const users = await User.find({ $or: [{ _id: id1 }, { _id: id3 }] })
      expect(users).to.have.length(2)

      const u1 = String(users[0]._id) === String(user1._id) ? users[0] : users[1]
      const u3 = String(users[1]._id) === String(user3._id) ? users[1] : users[0]

      expect(String(u1._id)).to.be.equal(String(user1._id))
      expect(String(u3._id)).to.be.equal(String(user3._id))
    })
  })

  describe('indexes', function () {
    before(function () {
      if (!process.env.MONGO_HOSTNAME) this.skip()
    })
    it('should reject documents with duplicate values in unique-indexed fields', async function () {
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
      user1.name = 'Billy'
      user2.email = 'billy@example.com'

      await Promise.all([user1.save(), user2.save()])
        .then(() => expect.fail(null, Error, 'Expected error, but got none.'))
        .catch(error => expect(error instanceof Error).to.be.true())
    })

    it('should accept documents with duplicate values in non-unique-indexed fields', async function () {
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
      user1.name = 'Billy'
      user2.email = 'billy@example.com'

      await Promise.all([user1.save(), user2.save()])
      validateId(user1)
      validateId(user2)
      expect(user1.email).to.be.equal('billy@example.com')
      expect(user2.email).to.be.equal('billy@example.com')
    })
  })
})
