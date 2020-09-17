/* eslint-env mocha */

import chai from 'chai'
import dirtyChai from 'dirty-chai'
import { connect } from '../lib/connect'
import { ValidationError } from '../lib/errors'
import { validateId } from './util'

chai.use(dirtyChai)
const expect = chai.expect
const assert = chai.assert

describe('Embedded', () => {
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

  describe('general', () => {
    it('should not have an _id', async () => {
      class EmbeddedModel extends EmbeddedDocument {
        constructor () {
          super()
          this.str = String
        }
      }

      class DocumentModel extends Document {
        constructor () {
          super()
          this.mod = EmbeddedModel
          this.num = { type: Number }
        }
      }

      const data = DocumentModel.create()
      data.mod = EmbeddedModel.create()
      data.mod.str = 'some data'
      data.num = 1

      await data.save()
      expect(data.mod._id).to.be.undefined()
      const d = await DocumentModel.findOne({ num: 1 })
      expect(d.mod._id).to.be.undefined()
    })
  })

  describe('types', () => {
    it('should allow embedded types', async () => {
      class EmbeddedModel extends EmbeddedDocument {
        constructor () {
          super()
          this.str = String
        }
      }

      class DocumentModel extends Document {
        constructor () {
          super()
          this.mod = EmbeddedModel
          this.num = { type: Number }
        }
      }

      const data = DocumentModel.create()
      data.mod = EmbeddedModel.create()
      data.mod.str = 'some data'
      data.num = 1

      await data.save()
      validateId(data)
      const d = await DocumentModel.findOne({ num: 1 })
      validateId(d)
      expect(d.num).to.be.equal(1)
      expect(d.mod).to.be.a('object')
      expect(d.mod).to.be.an.instanceof(EmbeddedModel)
      expect(d.mod.str).to.be.equal('some data')
    })

    it('should allow array of embedded types', async () => {
      class Limb extends EmbeddedDocument {
        constructor () {
          super()
          this.type = String
        }
      }

      class Person extends Document {
        constructor () {
          super()
          this.limbs = [Limb]
          this.name = String
        }

        static collectionName () {
          return 'people'
        }
      }

      const person = Person.create()
      person.name = 'Scott'
      person.limbs.push(Limb.create())
      person.limbs[0].type = 'left arm'
      person.limbs.push(Limb.create())
      person.limbs[1].type = 'right arm'
      person.limbs.push(Limb.create())
      person.limbs[2].type = 'left leg'
      person.limbs.push(Limb.create())
      person.limbs[3].type = 'right leg'

      await person.save()
      validateId(person)
      expect(person.limbs).to.have.length(4)
      const p = await Person.findOne({ name: 'Scott' })
      validateId(p)
      expect(p.name).to.be.equal('Scott')
      expect(p.limbs).to.be.a('array')
      expect(p.limbs).to.have.length(4)
      expect(p.limbs[0].type).to.be.equal('left arm')
      expect(p.limbs[1].type).to.be.equal('right arm')
      expect(p.limbs[2].type).to.be.equal('left leg')
      expect(p.limbs[3].type).to.be.equal('right leg')
    })

    it('should save nested array of embeddeds', async () => {
      class Point extends EmbeddedDocument {
        constructor () {
          super()
          this.x = Number
          this.y = Number
        }
      }

      class Polygon extends EmbeddedDocument {
        constructor () {
          super()
          this.points = [Point]
        }
      }

      class WorldMap extends Document {
        constructor () {
          super()
          this.polygons = [Polygon]
        }
      }

      const map = WorldMap.create()
      const polygon1 = Polygon.create()
      const polygon2 = Polygon.create()
      const point1 = Point.create({ x: 123.45, y: 678.90 })
      const point2 = Point.create({ x: 543.21, y: 987.60 })

      map.polygons.push(polygon1)
      map.polygons.push(polygon2)
      polygon2.points.push(point1)
      polygon2.points.push(point2)

      await map.save()
      const m = await WorldMap.findOne()
      expect(m.polygons).to.have.length(2)
      expect(m.polygons[0]).to.be.instanceof(Polygon)
      expect(m.polygons[1]).to.be.instanceof(Polygon)
      expect(m.polygons[1].points).to.have.length(2)
      expect(m.polygons[1].points[0]).to.be.instanceof(Point)
      expect(m.polygons[1].points[1]).to.be.instanceof(Point)
    })

    it('should allow nested initialization of embedded types', async () => {
      class Discount extends EmbeddedDocument {
        constructor () {
          super()
          this.authorized = Boolean
          this.amount = Number
        }
      }

      class Product extends Document {
        constructor () {
          super()
          this.name = String
          this.discount = Discount
        }
      }

      const product = Product.create({
        name: 'bike',
        discount: {
          authorized: true,
          amount: 9.99
        }
      })

      await product.save()
      validateId(product)
      expect(product.name).to.be.equal('bike')
      expect(product.discount).to.be.a('object')
      expect(product.discount instanceof Discount).to.be.true()
      expect(product.discount.authorized).to.be.equal(true)
      expect(product.discount.amount).to.be.equal(9.99)
    })

    it('should allow initialization of array of embedded documents', async () => {
      class Discount extends EmbeddedDocument {
        constructor () {
          super()
          this.authorized = Boolean
          this.amount = Number
        }
      }

      class Product extends Document {
        constructor () {
          super()
          this.name = String
          this.discounts = [Discount]
        }
      }

      const product = Product.create({
        name: 'bike',
        discounts: [{
          authorized: true,
          amount: 9.99
        }, {
          authorized: false,
          amount: 187.44
        }]
      })

      await product.save()
      validateId(product)
      expect(product.name).to.be.equal('bike')
      expect(product.discounts).to.have.length(2)
      expect(product.discounts[0] instanceof Discount).to.be.true()
      expect(product.discounts[1] instanceof Discount).to.be.true()
      expect(product.discounts[0].authorized).to.be.equal(true)
      expect(product.discounts[0].amount).to.be.equal(9.99)
      expect(product.discounts[1].authorized).to.be.equal(false)
      expect(product.discounts[1].amount).to.be.equal(187.44)
    })
  })

  describe('defaults', () => {
    it('should assign defaults to embedded types', async () => {
      class EmbeddedModel extends EmbeddedDocument {
        constructor () {
          super()
          this.str = { type: String, default: 'hello' }
        }
      }

      class DocumentModel extends Document {
        constructor () {
          super()
          this.emb = EmbeddedModel
          this.num = { type: Number }
        }
      }

      const data = DocumentModel.create()
      data.emb = EmbeddedModel.create()
      data.num = 1

      await data.save()
      validateId(data)
      const d = await DocumentModel.findOne({ num: 1 })
      validateId(d)
      expect(d.emb.str).to.be.equal('hello')
    })

    it('should assign defaults to array of embedded types', async () => {
      class Money extends EmbeddedDocument {
        constructor () {
          super()
          this.value = { type: Number, default: 100 }
        }
      }

      class Wallet extends Document {
        constructor () {
          super()
          this.contents = [Money]
          this.owner = String
        }
      }

      const wallet = Wallet.create()
      wallet.owner = 'Scott'
      wallet.contents.push(Money.create())
      wallet.contents.push(Money.create())
      wallet.contents.push(Money.create())

      await wallet.save()
      validateId(wallet)
      const w = await Wallet.findOne({ owner: 'Scott' })
      validateId(w)
      expect(w.owner).to.be.equal('Scott')
      expect(w.contents[0].value).to.be.equal(100)
      expect(w.contents[1].value).to.be.equal(100)
      expect(w.contents[2].value).to.be.equal(100)
    })
  })

  describe('validate', () => {
    it('should validate embedded values', async () => {
      class EmbeddedModel extends EmbeddedDocument {
        constructor () {
          super()
          this.num = { type: Number, max: 10 }
        }
      }

      class DocumentModel extends Document {
        constructor () {
          super()
          this.emb = EmbeddedModel
        }
      }

      const data = DocumentModel.create()
      data.emb = EmbeddedModel.create()
      data.emb.num = 26

      await data.save()
        .then(() => expect.fail(null, Error, 'Expected error, but got none.'))
        .catch(error => {
          expect(error).to.be.instanceof(ValidationError)
          expect(error.message).to.contain('max')
        })
    })

    it('should validate array of embedded values', async () => {
      class Money extends EmbeddedDocument {
        constructor () {
          super()
          this.value = { type: Number, choices: [1, 5, 10, 20, 50, 100] }
        }
      }

      class Wallet extends Document {
        constructor () {
          super()
          this.contents = [Money]
        }
      }

      expect(() => Wallet.create({
        contents: [Money.create({ value: 5 }), Money.create({ value: 26 })]
      })).to.throw(Error, /choices/)
    })

    it('should save when embedded is not required', async () => {
      class Money extends EmbeddedDocument {
        constructor () {
          super()
          this.value = { type: String, default: 'hello' }
        }
      }

      class Wallet extends Document {
        constructor () {
          super()
          this.contents = Money // not required by default
        }
      }

      await Wallet.create({}).save()

      const result = await Wallet.find({})
      assert.strictEqual(result.length, 1)
      assert.isTrue(Object.hasOwnProperty.call(result[0], 'contents'))
      assert.strictEqual(result[0].contents, undefined)
    })

    it('should throw when embedded is required', async () => {
      class Money extends EmbeddedDocument {
        constructor () {
          super()
          this.value = { type: String, default: 'hello' }
        }
      }

      class Wallet extends Document {
        constructor () {
          super()
          this.contents = { type: Money, required: true }
        }
      }

      expect(() => Wallet.create({})).to.throw(Error, /required/)
    })
  })

  describe('canonicalize', () => {
    it('should ensure timestamp dates are converted to Date objects', async () => {
      class Education extends EmbeddedDocument {
        constructor () {
          super()

          this.school = String
          this.major = String
          this.dateGraduated = Date
        }

        static collectionName () {
          return 'people'
        }
      }

      class Person extends Document {
        constructor () {
          super()

          this.gradSchool = Education
        }

        static collectionName () {
          return 'people'
        }
      }

      const now = new Date()

      const person = Person.create({
        gradSchool: {
          school: 'CMU',
          major: 'ECE',
          dateGraduated: now
        }
      })

      await person.save()
      validateId(person)
      expect(person.gradSchool.school).to.be.equal('CMU')
      expect(person.gradSchool.dateGraduated.getFullYear()).to.be.equal(now.getFullYear())
      expect(person.gradSchool.dateGraduated.getHours()).to.be.equal(now.getHours())
      expect(person.gradSchool.dateGraduated.getMinutes()).to.be.equal(now.getMinutes())
      expect(person.gradSchool.dateGraduated.getMonth()).to.be.equal(now.getMonth())
      expect(person.gradSchool.dateGraduated.getSeconds()).to.be.equal(now.getSeconds())
    })
  })

  describe('hooks', () => {
    it('should call all pre and post functions on embedded models', async () => {
      let preValidateCalled = false
      let preSaveCalled = false
      let preDeleteCalled = false

      let postValidateCalled = false
      let postSaveCalled = false
      let postDeleteCalled = false

      class Coffee extends EmbeddedDocument {
        preValidate () {
          preValidateCalled = true
        }

        postValidate () {
          postValidateCalled = true
        }

        preSave () {
          preSaveCalled = true
        }

        postSave () {
          postSaveCalled = true
        }

        preDelete () {
          preDeleteCalled = true
        }

        postDelete () {
          postDeleteCalled = true
        }
      }

      class Cup extends Document {
        constructor () {
          super()

          this.contents = Coffee
        }
      }

      const cup = Cup.create()
      cup.contents = Coffee.create()

      await cup.save()
      validateId(cup)

      // Pre/post save and validate should be called
      expect(preValidateCalled).to.be.equal(true)
      expect(preSaveCalled).to.be.equal(true)
      expect(postValidateCalled).to.be.equal(true)
      expect(postSaveCalled).to.be.equal(true)

      // Pre/post delete should not have been called yet
      expect(preDeleteCalled).to.be.equal(false)
      expect(postDeleteCalled).to.be.equal(false)

      const numDeleted = await cup.delete()
      expect(numDeleted).to.be.equal(1)

      expect(preDeleteCalled).to.be.equal(true)
      expect(postDeleteCalled).to.be.equal(true)
    })

    it('should call all pre and post functions on array of embedded models', async () => {
      let preValidateCalled = false
      let preSaveCalled = false
      let preDeleteCalled = false

      let postValidateCalled = false
      let postSaveCalled = false
      let postDeleteCalled = false

      class Money extends EmbeddedDocument {
        preValidate () {
          preValidateCalled = true
        }

        postValidate () {
          postValidateCalled = true
        }

        preSave () {
          preSaveCalled = true
        }

        postSave () {
          postSaveCalled = true
        }

        preDelete () {
          preDeleteCalled = true
        }

        postDelete () {
          postDeleteCalled = true
        }
      }

      class Wallet extends Document {
        constructor () {
          super()

          this.contents = [Money]
        }
      }

      const wallet = Wallet.create()
      wallet.contents.push(Money.create())
      wallet.contents.push(Money.create())

      await wallet.save()
      validateId(wallet)

      // Pre/post save and validate should be called
      expect(preValidateCalled).to.be.equal(true)
      expect(postValidateCalled).to.be.equal(true)
      expect(preSaveCalled).to.be.equal(true)
      expect(postSaveCalled).to.be.equal(true)

      // Pre/post delete should not have been called yet
      expect(preDeleteCalled).to.be.equal(false)
      expect(postDeleteCalled).to.be.equal(false)

      const numDeleted = await wallet.delete()
      expect(numDeleted).to.be.equal(1)

      expect(preDeleteCalled).to.be.equal(true)
      expect(postDeleteCalled).to.be.equal(true)
    })
  })

  describe('serialize', () => {
    it('should serialize data to JSON', async () => {
      class Address extends EmbeddedDocument {
        constructor () {
          super()

          this.street = String
          this.city = String
          this.zipCode = Number
          this.isPoBox = Boolean
        }
      }

      class Person extends Document {
        constructor () {
          super()

          this.name = String
          this.age = Number
          this.isAlive = Boolean
          this.children = [String]
          this.address = Address
        }

        static collectionName () {
          return 'people'
        }
      }

      const person = Person.create({
        name: 'Scott',
        address: {
          street: '123 Fake St.',
          city: 'Cityville',
          zipCode: 12345,
          isPoBox: false
        }
      })

      await person.save()
      validateId(person)
      expect(person.name).to.be.equal('Scott')
      expect(person.address).to.be.an.instanceof(Address)
      expect(person.address.street).to.be.equal('123 Fake St.')
      expect(person.address.city).to.be.equal('Cityville')
      expect(person.address.zipCode).to.be.equal(12345)
      expect(person.address.isPoBox).to.be.equal(false)

      const json = person.toJSON()

      expect(json.name).to.be.equal('Scott')
      expect(json.address).to.not.be.an.instanceof(Address)
      expect(json.address.street).to.be.equal('123 Fake St.')
      expect(json.address.city).to.be.equal('Cityville')
      expect(json.address.zipCode).to.be.equal(12345)
      expect(json.address.isPoBox).to.be.equal(false)
    })

    it('should serialize data to JSON and ignore methods', () => {
      class Address extends EmbeddedDocument {
        constructor () {
          super()
          this.street = String
        }

        getBar () {
          return 'bar'
        }
      }

      class Person extends Document {
        constructor () {
          super()

          this.name = String
          this.address = Address
        }

        static collectionName () {
          return 'people'
        }

        getFoo () {
          return 'foo'
        }
      }

      const person = Person.create({
        name: 'Scott',
        address: {
          street: 'Bar street'
        }
      })

      const json = person.toJSON()
      expect(json).to.have.keys(['_id', 'name', 'address'])
      expect(json.address).to.have.keys(['street'])
    })
  })
})
