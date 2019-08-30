/* global describe, it, before, afterEach */

'use strict'

import dirtyChai from 'dirty-chai'
import chai from 'chai'
import { connect } from '../lib/connect'
import { validateId } from './util'

chai.use(dirtyChai)
const expect = chai.expect

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
      user1.name = 'Billy'
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
