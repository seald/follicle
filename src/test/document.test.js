/* global describe, it, before, afterEach, after */

'use strict'
import chai from 'chai'
import dirtyChai from 'dirty-chai'
import { connect } from '../index'
import { isDocument } from '../lib/validate'
import { ValidationError } from '../lib/errors'
import getData from './data'
import { expectError, fail, validateId } from './util'

chai.use(dirtyChai)
const expect = chai.expect

describe('Document', () => {
  // TODO: Should probably use mock database client...
  const url = 'nedb://memory'
  // const url = 'mongodb://localhost/camo_test';
  let database = null
  let Document
  let Data

  before(async () => {
    ({Document, client: database} = await connect(url))
    await database.dropDatabase()
    Data = await getData(Document)
  })

  afterEach(() => database.dropDatabase())

  after(() => database.dropDatabase())

  describe('instantiation', () => {
    it('should allow creation of instance', async () => {
      class User extends Document {
        constructor () {
          super()
          this.firstName = String
          this.lastName = String
        }
      }

      let user = User.create()
      user.firstName = 'Billy'
      user.lastName = 'Bob'

      await user.save()
      validateId(user)
    })

    it('should allow schema declaration via method', async () => {
      class User extends Document {
        constructor () {
          super()

          this.schema({
            firstName: String,
            lastName: String
          })
        }
      }

      let user = User.create()
      user.firstName = 'Billy'
      user.lastName = 'Bob'

      await user.save()
      validateId(user)
    })

    it('should allow creation of instance with data', () => {
      class User extends Document {
        constructor () {
          super()
          this.firstName = String
          this.lastName = String
          this.nicknames = [String]
        }
      }

      let user = User.create({
        firstName: 'Billy',
        lastName: 'Bob',
        nicknames: ['Bill', 'William', 'Will']
      })

      expect(user.firstName).to.be.equal('Billy')
      expect(user.lastName).to.be.equal('Bob')
      expect(user.nicknames).to.have.length(3)
      expect(user.nicknames).to.include('Bill')
      expect(user.nicknames).to.include('William')
      expect(user.nicknames).to.include('Will')
    })

    it('should allow creation of instance with references', async () => {
      class Coffee extends Document {
        constructor () {
          super()
          this.temp = Number
        }
      }

      class User extends Document {
        constructor () {
          super()
          this.drinks = [Coffee]
        }
      }

      let coffee = Coffee.create()
      coffee.temp = 105

      await coffee.save()
      let user = User.create({drinks: [coffee]})
      expect(user.drinks).to.have.length(1)
    })
  })

  describe('class', () => {
    it('should allow use of member variables in getters', async () => {
      class User extends Document {
        constructor () {
          super()
          this.firstName = String
          this.lastName = String
        }

        get fullName () {
          return this.firstName + ' ' + this.lastName
        }
      }

      let user = User.create()
      user.firstName = 'Billy'
      user.lastName = 'Bob'

      await user.save()
      validateId(user)
      expect(user.fullName).to.be.equal('Billy Bob')
    })

    it('should allow use of member variables in setters', async () => {
      class User extends Document {
        constructor () {
          super()
          this.firstName = String
          this.lastName = String
        }

        get fullName () {
          return this.firstName + ' ' + this.lastName
        }

        set fullName (name) {
          let nameArr = name.split(' ')
          this.firstName = nameArr[0]
          this.lastName = nameArr[1]
        }
      }

      let user = User.create()
      user.fullName = 'Billy Bob'

      await user.save()
      validateId(user)
      expect(user.firstName).to.be.equal('Billy')
      expect(user.lastName).to.be.equal('Bob')
    })

    it('should allow use of member variables in methods', async () => {
      class User extends Document {
        constructor () {
          super()
          this.firstName = String
          this.lastName = String
        }

        fullName () {
          return this.firstName + ' ' + this.lastName
        }
      }

      let user = User.create()
      user.firstName = 'Billy'
      user.lastName = 'Bob'

      await user.save()
      validateId(user)
      expect(user.fullName()).to.be.equal('Billy Bob')
    })

    it('should allow schemas to be extended', async () => {
      class User extends Document {
        constructor (collection) {
          super(collection)
          this.firstName = String
          this.lastName = String
        }
      }

      class ProUser extends User {
        constructor () {
          super()
          this.paymentMethod = String
        }
      }

      let user = ProUser.create()
      user.firstName = 'Billy'
      user.lastName = 'Bob'
      user.paymentMethod = 'cash'

      await user.save()
      validateId(user)
      expect(user.firstName).to.be.equal('Billy')
      expect(user.lastName).to.be.equal('Bob')
      expect(user.paymentMethod).to.be.equal('cash')
    })

    it('should allow schemas to be overridden', async () => {
      class Vehicle extends Document {
        constructor (collection) {
          super(collection)
          this.numWheels = {
            type: Number,
            default: 4
          }
        }
      }

      class Motorcycle extends Vehicle {
        constructor () {
          super()
          this.numWheels = {
            type: Number,
            default: 2
          }
        }
      }

      let bike = Motorcycle.create()

      await bike.save()
      validateId(bike)
      expect(bike.numWheels).to.be.equal(2)
    })

    it('should provide default collection name based on class name', () => {
      class User extends Document {}

      let user = User.create()

      expect(user.collectionName()).to.be.equal('User')
      expect(User.collectionName()).to.be.equal('User')
    })

    it('should provide default collection name based on subclass name', () => {
      class User extends Document {}

      class ProUser extends User {}

      let pro = ProUser.create()

      expect(pro.collectionName()).to.be.equal('ProUser')
      expect(ProUser.collectionName()).to.be.equal('ProUser')
    })

    it('should allow custom collection name', () => {
      class User extends Document {
        static collectionName () {
          return 'sheeple'
        }
      }

      let user = User.create()

      expect(user.collectionName()).to.be.equal('sheeple')
      expect(User.collectionName()).to.be.equal('sheeple')
    })
  })

  describe('types', () => {
    it('should allow reference types', async () => {
      class ReferenceeModel extends Document {
        constructor () {
          super()
          this.str = String
        }

        static collectionName () {
          return 'referencee1'
        }
      }

      class ReferencerModel extends Document {
        constructor () {
          super()
          this.ref = ReferenceeModel
          this.num = {type: Number}
        }

        static collectionName () {
          return 'referencer1'
        }
      }

      let data = ReferencerModel.create()
      data.ref = ReferenceeModel.create()
      data.ref.str = 'some data'
      data.num = 1

      await data.ref.save()
      validateId(data.ref)
      await data.save()
      validateId(data)
      const d = await ReferencerModel.findOne({num: 1})
      validateId(d)
      validateId(d.ref)
      expect(d.ref).to.be.an.instanceof(ReferenceeModel)
      expect(d.ref.str).to.be.equal('some data')
    })

    it('should allow array of references', async () => {
      class ReferenceeModel extends Document {
        constructor () {
          super()
          this.schema({str: {type: String}})
        }

        static collectionName () {
          return 'referencee2'
        }
      }

      class ReferencerModel extends Document {
        constructor () {
          super()
          this.refs = [ReferenceeModel]
          this.num = Number
        }

        static collectionName () {
          return 'referencer2'
        }
      }

      let data = ReferencerModel.create()
      data.refs.push(ReferenceeModel.create())
      data.refs.push(ReferenceeModel.create())
      data.refs[0].str = 'string1'
      data.refs[1].str = 'string2'
      data.num = 1

      await data.refs[0].save()
      validateId(data.refs[0])
      await data.refs[1].save()
      validateId(data.refs[1])
      await data.save()
      validateId(data)
      const d = await ReferencerModel.findOne({num: 1})
      validateId(d)
      validateId(d.refs[0])
      validateId(d.refs[1])
      expect(d.refs[0]).to.be.an.instanceof(ReferenceeModel)
      expect(d.refs[1]).to.be.an.instanceof(ReferenceeModel)
      expect(d.refs[0].str).to.be.equal('string1')
      expect(d.refs[1].str).to.be.equal('string2')
    })

    it('should allow references to be saved using the object or its id', async () => {
      class ReferenceeModel extends Document {
        constructor () {
          super()
          this.str = String
        }

        static collectionName () {
          return 'referencee3'
        }
      }

      class ReferencerModel extends Document {
        constructor () {
          super()
          this.ref1 = ReferenceeModel
          this.ref2 = ReferenceeModel
          this.num = {type: Number}
        }

        static collectionName () {
          return 'referencer3'
        }
      }

      let data = ReferencerModel.create()
      data.ref1 = ReferenceeModel.create()
      let ref2 = ReferenceeModel.create()
      data.ref1.str = 'string1'
      ref2.str = 'string2'
      data.num = 1

      await data.ref1.save()
      validateId(data.ref1)
      await data.save()
      validateId(data)
      await ref2.save()
      validateId(ref2)
      data.ref2 = ref2._id
      await data.save()
      const d = await ReferencerModel.findOne({num: 1})
      validateId(d.ref1)
      validateId(d.ref2)
      expect(d.ref1.str).to.be.equal('string1')
      expect(d.ref2.str).to.be.equal('string2')
    })

    it('should allow array of references to be saved using the object or its id', async () => {
      class ReferenceeModel extends Document {
        constructor () {
          super()
          this.schema({str: {type: String}})
        }

        static collectionName () {
          return 'referencee4'
        }
      }

      class ReferencerModel extends Document {
        constructor () {
          super()
          this.refs = [ReferenceeModel]
          this.num = Number
        }

        static collectionName () {
          return 'referencer4'
        }
      }

      let data = ReferencerModel.create()
      data.refs.push(ReferenceeModel.create())
      let ref2 = ReferenceeModel.create()
      data.refs[0].str = 'string1'
      ref2.str = 'string2'
      data.num = 1

      await data.refs[0].save()
      validateId(data.refs[0])
      await data.save()
      validateId(data)
      await ref2.save()
      validateId(ref2)
      data.refs.push(ref2._id)
      await data.save()
      const d = await ReferencerModel.findOne({num: 1})
      validateId(d.refs[0])
      validateId(d.refs[1])
      expect(d.refs[1].str).to.be.equal('string2')
    })

    it('should allow circular references', async () => {
      class Employee extends Document {
        constructor () {
          super()
          this.name = String
          this.boss = Boss
        }
      }

      class Boss extends Document {
        constructor () {
          super()
          this.salary = Number
          this.employees = [Employee]
        }

        static collectionName () {
          return 'bosses'
        }
      }

      let employee = Employee.create()
      employee.name = 'Scott'

      let boss = Boss.create()
      boss.salary = 10000000

      employee.boss = boss

      await boss.save()
      validateId(boss)

      await employee.save()
      validateId(employee)
      validateId(employee.boss)

      boss.employees.push(employee)

      await boss.save()
      validateId(boss)
      validateId(boss.employees[0])
      validateId(boss.employees[0].boss)

      const b = await Boss.findOne({salary: 10000000})
      // If we had an issue with an infinite loop
      // of loading circular dependencies then the
      // test probably would have crashed by now,
      // so we're good.

      validateId(b)

      // Validate that boss employee ref was loaded
      validateId(b.employees[0])

      // .findOne should have only loaded 1 level
      // of references, so the boss's reference
      // to the employee is still the ID.
      expect(b.employees[0].boss).to.not.be.null()
      expect(!isDocument(b.employees[0].boss)).to.be.true()
    })

    it('should allow string types', async () => {
      class StringModel extends Document {
        constructor () {
          super()
          this.schema({str: {type: String}})
        }
      }

      let data = StringModel.create()
      data.str = 'hello'

      await data.save()
      validateId(data)
      expect(data.str).to.be.equal('hello')
    })

    it('should allow number types', async () => {
      class NumberModel extends Document {
        constructor () {
          super()
          this.schema({num: {type: Number}})
        }

        static collectionName () {
          return 'numbers1'
        }
      }

      let data = NumberModel.create()
      data.num = 26

      await data.save()
      validateId(data)
      expect(data.num).to.be.equal(26)
    })

    it('should allow boolean types', async () => {
      class BooleanModel extends Document {
        constructor () {
          super()
          this.schema({bool: {type: Boolean}})
        }
      }

      let data = BooleanModel.create()
      data.bool = true

      await data.save()
      validateId(data)
      expect(data.bool).to.be.equal(true)
    })

    it('should allow date types', async () => {
      class DateModel extends Document {
        constructor () {
          super()
          this.schema({date: {type: Date}})
        }
      }

      let data = DateModel.create()
      let date = new Date()
      data.date = date

      await data.save()
      validateId(data)
      expect(data.date.valueOf()).to.be.equal(date.valueOf())
    })

    it('should allow object types', async () => {
      class ObjectModel extends Document {
        constructor () {
          super()
          this.schema({obj: {type: Object}})
        }
      }

      let data = ObjectModel.create()
      data.obj = {hi: 'bye'}

      await data.save()
      validateId(data)
      expect(data.obj.hi).to.not.be.null()
      expect(data.obj.hi).to.be.equal('bye')
    })

    it('should allow buffer types', async () => {
      class BufferModel extends Document {
        constructor () {
          super()
          this.schema({buf: {type: Buffer}})
        }
      }

      let data = BufferModel.create()
      data.buf = Buffer.from('hello')

      await data.save()
      validateId(data)
      expect(data.buf.toString('ascii')).to.be.equal('hello')
    })

    it('should allow array types', async () => {
      class ArrayModel extends Document {
        constructor () {
          super()
          this.schema({arr: {type: Array}})
        }
      }

      let data = ArrayModel.create()
      data.arr = [1, 'number', true]

      await data.save()
      validateId(data)
      expect(data.arr).to.have.length(3)
      expect(data.arr).to.include(1)
      expect(data.arr).to.include('number')
      expect(data.arr).to.include(true)
    })

    it('should allow typed-array types', async () => {
      class ArrayModel extends Document {
        constructor () {
          super()
          this.schema({arr: {type: [String]}})
        }
      }

      let data = ArrayModel.create()
      data.arr = ['1', '2', '3']

      await data.save()
      validateId(data)
      expect(data.arr).to.have.length(3)
      expect(data.arr).to.include('1')
      expect(data.arr).to.include('2')
      expect(data.arr).to.include('3')
    })

    it('should reject objects containing values with different types', async () => {
      class NumberModel extends Document {
        constructor () {
          super()
          this.schema({num: {type: Number}})
        }

        static collectionName () {
          return 'numbers2'
        }
      }

      let data = NumberModel.create()
      data.num = '1'

      await data.save()
        .then(() => expect.fail(null, Error, 'Expected error, but got none.'))
        .catch(error => expect(error).to.be.instanceof(ValidationError))
    })

    it('should reject typed-arrays containing different types', async () => {
      class ArrayModel extends Document {
        constructor () {
          super()
          this.schema({arr: {type: [String]}})
        }
      }

      let data = ArrayModel.create()
      data.arr = [1, 2, 3]

      await data.save()
        .then(() => expect.fail(null, Error, 'Expected error, but got none.'))
        .catch(error => expect(error).to.be.instanceof(ValidationError))
    })
  })

  describe('defaults', function () {
    it('should assign default value if unassigned', async () => {
      let data = Data.create()

      await data.save()
      validateId(data)
      expect(data.source).to.be.equal('reddit')
    })

    it('should assign default value via function if unassigned', async () => {
      let data = Data.create()

      await data.save()
      validateId(data)
      expect(data.date).to.be.below(new Date())
    })

    it('should be undefined if unassigned and no default is given', async () => {
      class Person extends Document {
        constructor () {
          super()
          this.name = String
          this.age = Number
        }

        static collectionName () {
          return 'people'
        }
      }

      let person = Person.create({
        name: 'Scott'
      })

      await person.save()
      validateId(person)
      const p = await Person.findOne({name: 'Scott'})
      validateId(p)
      expect(p.name).to.be.equal('Scott')
      expect(p.age).to.be.undefined()
    })
  })

  describe('choices', () => {
    it('should accept value specified in choices', async () => {
      let data = Data.create()
      data.source = 'wired'

      await data.save()
      validateId(data)
      expect(data.source).to.be.equal('wired')
    })

    it('should reject values not specified in choices', async () => {
      let data = Data.create()
      data.source = 'google'

      await data.save()
        .then(() => expect.fail(null, Error, 'Expected error, but got none.'))
        .catch(error => expect(error).to.be.instanceof(ValidationError))
    })
  })

  describe('min', () => {
    it('should accept value > min', async () => {
      let data = Data.create()
      data.item = 1

      await data.save()
      validateId(data)
      expect(data.item).to.be.equal(1)
    })

    it('should accept value == min', async () => {
      let data = Data.create()
      data.item = 0

      await data.save()
      validateId(data)
      expect(data.item).to.be.equal(0)
    })

    it('should reject value < min', async () => {
      let data = Data.create()
      data.item = -1

      await data.save()
        .then(() => expect.fail(null, Error, 'Expected error, but got none.'))
        .catch(error => expect(error).to.be.instanceof(ValidationError))
    })
  })

  describe('max', () => {
    it('should accept value < max', async () => {
      let data = Data.create()
      data.item = 99

      await data.save()
      validateId(data)
      expect(data.item).to.be.equal(99)
    })

    it('should accept value == max', async () => {
      let data = Data.create()
      data.item = 100

      await data.save()
      validateId(data)
      expect(data.item).to.be.equal(100)
    })

    it('should reject value > max', async () => {
      let data = Data.create()
      data.item = 101

      await data.save()
        .then(() => expect.fail(null, Error, 'Expected error, but got none.'))
        .catch(error => expect(error).to.be.instanceof(ValidationError))
    })
  })

  describe('match', () => {
    it('should accept value matching regex', async () => {
      class Product extends Document {
        constructor () {
          super()
          this.name = String
          this.cost = {
            type: String,
            match: /^\$?[\d,]+(\.\d*)?$/
          }
        }
      }

      let product = Product.create()
      product.name = 'Dark Roast Coffee'
      product.cost = '$1.39'

      await product.save()
      validateId(product)
      expect(product.name).to.be.equal('Dark Roast Coffee')
      expect(product.cost).to.be.equal('$1.39')
    })

    it('should reject value not matching regex', async () => {
      class Product extends Document {
        constructor () {
          super()
          this.name = String
          this.cost = {
            type: String,
            match: /^\$?[\d,]+(\.\d*)?$/
          }
        }
      }

      let product = Product.create()
      product.name = 'Light Roast Coffee'
      product.cost = '$1..39'

      await product.save()
        .then(() => fail(null, Error, 'Expected error, but got none.'))
        .catch(error => expectError(error))
    })
  })

  describe('validate', () => {
    it('should accept value that passes custom validator', async () => {
      class Person extends Document {
        constructor () {
          super()

          this.name = {
            type: String,
            validate: function (value) {
              return value.length > 4
            }
          }
        }

        static collectionName () {
          return 'people'
        }
      }

      let person = Person.create({
        name: 'Scott'
      })

      await person.save()
      validateId(person)
      expect(person.name).to.be.equal('Scott')
    })

    it('should reject value that fails custom validator', async () => {
      class Person extends Document {
        constructor () {
          super()

          this.name = {
            type: String,
            validate: function (value) {
              return value.length > 4
            }
          }
        }

        static collectionName () {
          return 'people'
        }
      }

      let person = Person.create({
        name: 'Matt'
      })

      await person.save()
        .then(() => fail(null, Error, 'Expected error, but got none.'))
        .catch(error => expectError(error))
    })
  })

  describe('canonicalize', () => {
    it('should ensure timestamp dates are converted to Date objects', async () => {
      class Person extends Document {
        constructor () {
          super()

          this.birthday = Date
        }

        static collectionName () {
          return 'people'
        }
      }

      let now = new Date()

      let person = Person.create({
        birthday: now
      })

      await person.save()
      validateId(person)
      expect(person.birthday.valueOf()).to.be.equal(now.valueOf())
    })

    it('should ensure date strings are converted to Date objects', async () => {
      class Person extends Document {
        constructor () {
          super()
          this.birthday = Date
          this.graduationDate = Date
          this.weddingDate = Date
        }

        static collectionName () {
          return 'people'
        }
      }

      let birthday = new Date(Date.UTC(2016, 1, 17, 5, 6, 8, 0))
      let graduationDate = new Date(2016, 1, 17, 0, 0, 0, 0)
      let weddingDate = new Date(2016, 1, 17, 0, 0, 0, 0)

      let person = Person.create({
        birthday: '2016-02-17T05:06:08+00:00',
        graduationDate: 'February 17, 2016',
        weddingDate: '2016/02/17'
      })

      await person.save()
      validateId(person)
      expect(person.birthday.valueOf()).to.be.equal(birthday.valueOf())
      expect(person.graduationDate.valueOf()).to.be.equal(graduationDate.valueOf())
      expect(person.weddingDate.valueOf()).to.be.equal(weddingDate.valueOf())
    })
  })

  describe('required', () => {
    it('should accept empty value that is not reqired', async () => {
      class Person extends Document {
        constructor () {
          super()

          this.name = {
            type: String,
            required: false
          }
        }

        static collectionName () {
          return 'people'
        }
      }

      let person = Person.create({
        name: ''
      })

      await person.save()
      validateId(person)
      expect(person.name).to.be.equal('')
    })

    it('should accept value that is not undefined', async () => {
      class Person extends Document {
        constructor () {
          super()

          this.name = {
            type: String,
            required: true
          }
        }

        static collectionName () {
          return 'people'
        }
      }

      let person = Person.create({
        name: 'Scott'
      })

      await person.save()
      validateId(person)
      expect(person.name).to.be.equal('Scott')
    })

    it('should accept an empty value if default is specified', async () => {
      class Person extends Document {
        constructor () {
          super()

          this.name = {
            type: String,
            required: true,
            default: 'Scott'
          }
        }

        static collectionName () {
          return 'people'
        }
      }

      let person = Person.create()

      await person.save()
      validateId(person)
      expect(person.name).to.be.equal('Scott')
    })

    it('should accept boolean value', async () => {
      class Person extends Document {
        constructor () {
          super()

          this.isSingle = {
            type: Boolean,
            required: true
          }
          this.isMerried = {
            type: Boolean,
            required: true
          }
        }

        static collectionName () {
          return 'people'
        }
      }

      let person = Person.create({
        isMerried: true,
        isSingle: false
      })

      await person.save()
      validateId(person)
      expect(person.isMerried).to.be.true()
      expect(person.isSingle).to.be.false()
    })

    it('should accept date value', async () => {
      class Person extends Document {
        constructor () {
          super()

          this.birthDate = {
            type: Date,
            required: true
          }
        }

        static collectionName () {
          return 'people'
        }
      }

      let myBirthDate = new Date()

      let person = Person.create({
        birthDate: myBirthDate
      })

      const savedPerson = await person.save()
      validateId(person)
      expect(savedPerson.birthDate.valueOf()).to.equal(myBirthDate.valueOf())
    })

    it('should accept any number value', async () => {
      class Person extends Document {
        constructor () {
          super()

          this.age = {
            type: Number,
            required: true
          }
          this.level = {
            type: Number,
            required: true
          }
        }

        static collectionName () {
          return 'people'
        }
      }

      let person = Person.create({
        age: 21,
        level: 0
      })

      const savedPerson = await person.save()
      validateId(person)
      expect(savedPerson.age).to.equal(21)
      expect(savedPerson.level).to.equal(0)
    })

    it('should reject value that is undefined', async () => {
      class Person extends Document {
        constructor () {
          super()

          this.name = {
            type: String,
            required: true
          }
        }

        static collectionName () {
          return 'people'
        }
      }

      let person = Person.create()

      await person.save()
        .then(() => fail(null, Error, 'Expected error, but got none.'))
        .catch(error => expectError(error))
    })

    it('should reject value if specified default empty value', async () => {
      class Person extends Document {
        constructor () {
          super()

          this.name = {
            type: String,
            required: true,
            default: ''
          }
        }

        static collectionName () {
          return 'people'
        }
      }

      let person = Person.create()

      await person.save()
        .then(() => fail(null, Error, 'Expected error, but got none.'))
        .catch(error => expectError(error))
    })

    it('should reject value that is null', async () => {
      class Person extends Document {
        constructor () {
          super()

          this.name = {
            type: Object,
            required: true
          }
        }

        static collectionName () {
          return 'people'
        }
      }

      let person = Person.create({
        name: null
      })

      await person.save()
        .then(() => fail(null, Error, 'Expected error, but got none.'))
        .catch(error => expectError(error))
    })

    it('should reject value that is an empty array', async () => {
      class Person extends Document {
        constructor () {
          super()

          this.names = {
            type: Array,
            required: true
          }
        }

        static collectionName () {
          return 'people'
        }
      }

      let person = Person.create({
        names: []
      })

      await person.save()
        .then(() => fail(null, Error, 'Expected error, but got none.'))
        .catch(error => expectError(error))
    })

    it('should reject value that is an empty string', async () => {
      class Person extends Document {
        constructor () {
          super()

          this.name = {
            type: String,
            required: true
          }
        }

        static collectionName () {
          return 'people'
        }
      }

      let person = Person.create({
        name: ''
      })

      await person.save()
        .then(() => fail(null, Error, 'Expected error, but got none.'))
        .catch(error => expectError(error))
    })

    it('should reject value that is an empty object', async () => {
      class Person extends Document {
        constructor () {
          super()

          this.names = {
            type: Object,
            required: true
          }
        }

        static collectionName () {
          return 'people'
        }
      }

      let person = Person.create({
        names: {}
      })

      await person.save()
        .then(() => fail(null, Error, 'Expected error, but got none.'))
        .catch(error => expectError(error))
    })
  })

  describe('hooks', () => {
    it('should call all pre and post functions', async () => {
      let preValidateCalled = false
      let preSaveCalled = false
      let preDeleteCalled = false

      let postValidateCalled = false
      let postSaveCalled = false
      let postDeleteCalled = false

      class Person extends Document {
        static collectionName () {
          return 'people'
        }

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

      let person = Person.create()

      await person.save()
      validateId(person)

      // Pre/post save and validate should be called
      expect(preValidateCalled).to.be.equal(true)
      expect(preSaveCalled).to.be.equal(true)
      expect(postValidateCalled).to.be.equal(true)
      expect(postSaveCalled).to.be.equal(true)

      // Pre/post delete should not have been called yet
      expect(preDeleteCalled).to.be.equal(false)
      expect(postDeleteCalled).to.be.equal(false)

      const numDeleted = await person.delete()
      expect(numDeleted).to.be.equal(1)

      expect(preDeleteCalled).to.be.equal(true)
      expect(postDeleteCalled).to.be.equal(true)
    })
  })

  describe('serialize', () => {
    it('should serialize data to JSON', async () => {
      class Person extends Document {
        constructor () {
          super()

          this.name = String
          this.age = Number
          this.isAlive = Boolean
          this.children = [String]
          this.spouse = {
            type: String,
            default: null
          }
        }

        static collectionName () {
          return 'people'
        }
      }

      let person = Person.create({
        name: 'Scott',
        age: 28,
        isAlive: true,
        children: ['Billy', 'Timmy'],
        spouse: null
      })

      await person.save()
      validateId(person)
      expect(person.name).to.be.equal('Scott')
      expect(person.age).to.be.equal(28)
      expect(person.isAlive).to.be.equal(true)
      expect(person.children).to.have.length(2)
      expect(person.spouse).to.be.null()

      let json = person.toJSON()

      expect(json.name).to.be.equal('Scott')
      expect(json.age).to.be.equal(28)
      expect(json.isAlive).to.be.equal(true)
      expect(json.children).to.have.length(2)
      expect(json.spouse).to.be.null()
      expect(json._id).to.be.equal(person._id.toString())
    })

    it('should serialize data to JSON', async () => {
      class Person extends Document {
        constructor () {
          super()

          this.name = String
          this.children = [Person]
          this.spouse = {
            type: Person,
            default: null
          }
        }

        static collectionName () {
          return 'people'
        }
      }

      let person = Person.create({
        name: 'Scott'
      })

      let spouse = Person.create({
        name: 'Jane'
      })

      let kid1 = Person.create({
        name: 'Billy'
      })

      let kid2 = Person.create({
        name: 'Timmy'
      })

      await spouse.save()
      await kid1.save()

      await kid2.save()
      person.spouse = spouse
      person.children.push(kid1)
      person.children.push(kid2)

      await person.save()
      validateId(person)
      validateId(spouse)
      validateId(kid1)
      validateId(kid2)

      expect(person.name).to.be.equal('Scott')
      expect(person.children).to.have.length(2)
      expect(person.spouse.name).to.be.equal('Jane')
      expect(person.children[0].name).to.be.equal('Billy')
      expect(person.children[1].name).to.be.equal('Timmy')
      expect(person.spouse).to.be.an.instanceof(Person)
      expect(person.children[0]).to.be.an.instanceof(Person)
      expect(person.children[1]).to.be.an.instanceof(Person)

      let json = person.toJSON()

      expect(json.name).to.be.equal('Scott')
      expect(json.children).to.have.length(2)
      expect(json.spouse.name).to.be.equal('Jane')
      expect(json.children[0].name).to.be.equal('Billy')
      expect(json.children[1].name).to.be.equal('Timmy')
      expect(json.spouse).to.not.be.an.instanceof(Person)
      expect(json.children[0]).to.not.be.an.instanceof(Person)
      expect(json.children[1]).to.not.be.an.instanceof(Person)
    })

    it('should serialize data to JSON and ignore methods', () => {
      class Person extends Document {
        constructor () {
          super()

          this.name = String
        }

        static collectionName () {
          return 'people'
        }

        getFoo () {
          return 'foo'
        }
      }

      let person = Person.create({
        name: 'Scott'
      })

      let json = person.toJSON()
      expect(json).to.have.keys(['_id', 'name'])
    })
  })
})
