/* eslint-env mocha */

import chai from 'chai'
import dirtyChai from 'dirty-chai'
import { connect } from '../lib/connect'
import { ValidationError } from '../lib/errors'
import { validateId } from './util'

chai.use(dirtyChai)
const expect = chai.expect

describe('Issues', function () {
  // TODO: Should probably use mock database client...
  const url = 'nedb://memory'
  // const url = 'mongodb://localhost/camo_test';
  let Document, EmbeddedDocument
  let database = null

  before(async () => {
    ({ Document, EmbeddedDocument, client: database } = await connect(url))
    await database.dropDatabase()
  })

  afterEach(() => database.dropDatabase())

  after(() => database.dropDatabase())

  describe('#4', () => {
    it('should not load duplicate references in array when only one reference is present', async () => {
      /*
             * This issue happens when there are multiple objects in the database,
             * each object has an array of references, and at least two of the
             * object's arrays contain the same reference.

             * In this case, both user1 and user2 have a reference to eye1. So
             * when we call `.find()`, both user1 and user2 will have a
             * duplicate reference to eye1, which is not correct.
             */

      class Eye extends Document {
        constructor () {
          super()
          this.color = String
        }
      }

      class User extends Document {
        constructor () {
          super()
          this.eyes = [Eye]
        }
      }

      const user1 = User.create()
      const user2 = User.create()
      const eye1 = Eye.create({ color: 'blue' })
      const eye2 = Eye.create({ color: 'brown' })

      let e = await eye1.save()
      validateId(e)
      e = await eye2.save()
      validateId(e)
      user1.eyes.push(eye1, eye2)
      let u = await user1.save()
      validateId(u)
      user2.eyes.push(eye1)
      u = await user2.save()
      validateId(u)
      const users = await User.find({})
      expect(users).to.have.length(2)

      // Get user1
      const u1 = String(users[0]._id) === String(user1._id) ? users[0] : users[1]

      // Ensure we have correct number of eyes...
      expect(u1.eyes).to.have.length(2)

      const e1 = String(u1.eyes[0]._id) === String(eye1._id) ? u1.eyes[0] : u1.eyes[1]
      const e2 = String(u1.eyes[1]._id) === String(eye2._id) ? u1.eyes[1] : u1.eyes[0]

      // ...and that we have the correct eyes
      expect(String(e1._id)).to.be.equal(String(eye1._id))
      expect(String(e2._id)).to.be.equal(String(eye2._id))
    })
  })

  describe('#5', () => {
    it('should allow multiple references to the same object in same array', async () => {
      /*
             * This issue happens when an object has an array of
             * references and there are multiple references to the
             * same object in the array.
             *
             * In the code below, we give the user two references
             * to the same Eye, but when we load the user there is
             * only one reference there.
             */

      class Eye extends Document {
        constructor () {
          super()
          this.color = String
        }
      }

      class User extends Document {
        constructor () {
          super()
          this.eyes = [Eye]
        }
      }

      const user = User.create()
      const eye = Eye.create({ color: 'blue' })

      const e = await eye.save()
      validateId(e)
      user.eyes.push(eye, eye)
      const u = await user.save()
      validateId(u)
      const users = await User.find({})
      expect(users).to.have.length(1)
      expect(users[0].eyes).to.have.length(2)

      const eyeRefs = users[0].eyes.map(function (e) { return e._id })

      expect(eyeRefs).to.include(eye._id)
    })
  })

  describe('#8', () => {
    it('should use virtuals when initializing instance with data', () => {
      /*
             * This issue happens when a model has virtual setters
             * and the caller tries to use those setters during
             * initialization via `create()`. The setters are
             * never called, but they should be.
             */

      class User extends Document {
        constructor () {
          super()
          this.firstName = String
          this.lastName = String
        }

        set fullName (name) {
          const split = name.split(' ')
          this.firstName = split[0]
          this.lastName = split[1]
        }

        get fullName () {
          return this.firstName + ' ' + this.lastName
        }
      }

      const user = User.create({
        fullName: 'Billy Bob'
      })

      expect(user.firstName).to.be.equal('Billy')
      expect(user.lastName).to.be.equal('Bob')
    })
  })

  describe('#20', () => {
    it('should not alias _id to id in queries and returned documents', async () => {
      /*
             * Camo inconsistently aliases the '_id' field to 'id'. When
             * querying, we must use '_id', but documents are returned
             * with '_id' AND 'id'. 'id' alias should be removed.
             *
             * TODO: Uncomment lines below once '_id' is fully
             * deprecated and removed.
             */

      class User extends Document {
        constructor () {
          super()
          this.name = String
        }
      }

      const user = User.create({
        name: 'Billy Bob'
      })

      await user.save()
      validateId(user)

      // expect(user.id).to.not.exist;
      expect(user._id).to.exist()

      // Should NOT be able to use 'id' to query
      let u = await User.findOne({ id: user._id })
      expect(u).to.not.exist()

      // SHOULD be able to use '_id' to query
      u = await User.findOne({ _id: user._id })
      // expect(u.id).to.not.exist;
      expect(u).to.exist()
      validateId(user)
    })
  })

  describe('#43', () => {
    /*
         * Changes made to the model in postValidate and preSave hooks
         * should be saved to the database
         */
    it('should save changes made in postValidate hook', async () => {
      class Person extends Document {
        constructor () {
          super()

          this.postValidateChange = {
            type: Boolean,
            default: false
          }
          this.pet = Pet
          this.pets = [Pet]
        }

        static collectionName () {
          return 'people'
        }

        postValidate () {
          this.postValidateChange = true
          this.pet.postValidateChange = true
          this.pets[0].postValidateChange = true

          this.pets.push(Pet.create({
            postValidateChange: true
          }))
        }
      }

      class Pet extends EmbeddedDocument {
        constructor () {
          super()

          this.postValidateChange = Boolean
        }

        static collectionName () {
          return 'pets'
        }
      }

      const person = Person.create()
      person.pet = Pet.create()
      person.pets.push(Pet.create())

      await person.save()
      validateId(person)
      const p = await Person.findOne({ _id: person._id }, { populate: true })

      expect(p.postValidateChange).to.be.equal(true)
      expect(p.pet.postValidateChange).to.be.equal(true)
      expect(p.pets[0].postValidateChange).to.be.equal(true)
      expect(p.pets[1].postValidateChange).to.be.equal(true)
    })

    it('should save changes made in preSave hook', async () => {
      class Person extends Document {
        constructor () {
          super()

          this.preSaveChange = {
            type: Boolean,
            default: false
          }
          this.pet = Pet
          this.pets = [Pet]
        }

        static collectionName () {
          return 'people'
        }

        postValidate () {
          this.preSaveChange = true
          this.pet.preSaveChange = true
          this.pets[0].preSaveChange = true

          this.pets.push(Pet.create({
            preSaveChange: true
          }))
        }
      }

      class Pet extends EmbeddedDocument {
        constructor () {
          super()

          this.preSaveChange = Boolean
        }

        static collectionName () {
          return 'pets'
        }
      }

      const person = Person.create()
      person.pet = Pet.create()
      person.pets.push(Pet.create())

      await person.save()
      validateId(person)
      const p = await Person.findOne({ _id: person._id }, { populate: true })
      expect(p.preSaveChange).to.be.equal(true)
      expect(p.pet.preSaveChange).to.be.equal(true)
      expect(p.pets[0].preSaveChange).to.be.equal(true)
      expect(p.pets[1].preSaveChange).to.be.equal(true)
    })
  })

  describe('#53', () => {
    /*
         * Camo should validate that all properties conform to
         * the type they were given in the schema. However,
         * array types are not properly validated due to not
         * properly checking for 'type === Array' and
         * 'type === []' in validator code.
         */

    it('should validate Array types properly', async () => {
      class Foo extends Document {
        constructor () {
          super()

          this.bar = Array
        }
      }

      const foo = Foo.create({ bar: [1, 2, 3] })

      const f = await foo.save()
      expect(f.bar).to.have.length(3)
      expect(f.bar).to.include(1)
      expect(f.bar).to.include(2)
      expect(f.bar).to.include(3)

      foo.bar = 1
      await foo.save()
        .then(() => expect.fail(null, Error, 'Expected error, but got none.'))
        .catch(error => expect(error).to.be.instanceof(ValidationError))
    })

    it('should validate [] types properly', async () => {
      class Foo extends Document {
        constructor () {
          super()

          this.bar = []
        }
      }

      const foo = Foo.create({ bar: [1, 2, 3] })

      const f = await foo.save()
      expect(f.bar).to.have.length(3)
      expect(f.bar).to.include(1)
      expect(f.bar).to.include(2)
      expect(f.bar).to.include(3)

      foo.bar = 2
      await foo.save()
        .then(() => expect.fail(null, Error, 'Expected error, but got none.'))
        .catch(error => expect(error).to.be.instanceof(ValidationError))
    })
  })

  describe('#55', () => {
    it('should return updated data on findOneAndUpdate when updating nested data', async () => {
      /*
             * When updating nested data with findOneAndUpdate,
             * the document returned to you should contain
             * all of the updated data. But due to lack of
             * support in NeDB versions < 1.8, I had to use
             * a hack (_.assign) to update the document. This
             * doesn't properly update nested data.
             *
             * Temporary fix is to just reload the document
             * with findOne.
             */

      class Contact extends EmbeddedDocument {
        constructor () {
          super()

          this.email = String
          this.phone = String
        }
      }

      class Person extends Document {
        constructor () {
          super()
          this.name = String
          this.contact = Contact
        }
      }

      let person = Person.create({
        name: 'John Doe',
        contact: {
          email: 'john@doe.info',
          phone: 'NA'
        }
      })

      person = await person.save()
      person = await Person.findOneAndUpdate({ _id: person._id }, { name: 'John Derp', 'contact.phone': '0123456789' })
      expect(person.name).to.be.equal('John Derp')
      expect(person.contact.email).to.be.equal('john@doe.info')
      expect(person.contact.phone).to.be.equal('0123456789')
    })
  })

  describe('#57', () => {
    it('should not save due to Promise.reject in hook', async () => {
      /*
             * Rejecting a Promise inside of a pre-save hook should
             * cause the save to be aborted, and the .caught() method
             * should be invoked on the Promise chain. This wasn't
             * happening due to how the hooks were being collected
             * and executed.
             */

      class Foo extends Document {
        constructor () {
          super()

          this.bar = String
        }

        preValidate () {
          return Promise.reject(new Error('DO NOT SAVE'))
        }
      }

      await Foo.create({ bar: 'bar' }).save()
        .then(() => expect.fail(null, Error, 'Expected error, but got none.'))
        .catch(error => expect(error).to.have.property('message', 'DO NOT SAVE'))
    })
  })
})
