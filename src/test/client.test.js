/* global describe, it, beforeEach, before, afterEach, after */
'use strict'
import chai from 'chai'
import dirtyChai from 'dirty-chai'
import { connect } from '../index'
import getData from './data'
import { data, validateData1, validateId } from './util'

chai.use(dirtyChai)
const expect = chai.expect

process.on('unhandledRejection', console.error)

describe('Client', () => {
  let Document, EmbeddedDocument, validators
  let Data, Address, Pet, User, City
  let getData1, getData2
  let Springfield, SouthPark, Quahog
  const url = 'nedb://memory'
  // const url = 'mongodb://localhost/camo_test';
  let database = null

  before(async () => {
    ({Document, EmbeddedDocument, validators, client: database} = await connect(url))
    await database.dropDatabase()
    Data = await getData(Document);
    ({data1: getData1, data2: getData2} = data(Document))

    Address = class Address extends Document {
      constructor () {
        super()

        this.street = String
        this.city = String
        this.zipCode = Number
      }

      static collectionName () {
        return 'addresses'
      }
    }

    Pet = class Pet extends Document {
      constructor () {
        super()

        this.schema({
          type: String, name: String
        })
      }
    }

    User = class User extends Document {
      constructor () {
        super()

        this.schema({
          firstName: String, lastName: String, pet: Pet, address: Address
        })
      }
    }
    City = class City extends Document {
      constructor () {
        super()

        this.name = String
        this.population = Number
      }

      static collectionName () {
        return 'cities'
      }
    }
  })

  afterEach(async () => {
    await database.dropDatabase()
  })

  after(async () => {
    await database.dropDatabase()
  })

  describe('#save()', () => {
    it('should persist the object and its members to the database', async () => {
      let data = getData1()

      await data.save()
      validateId(data)
      validateData1(data)
    })
  })

  describe('#findOne()', () => {
    it('should load a single object from the collection', async () => {
      let data = getData1()

      await data.save()
      validateId(data)

      const d = await Data.findOne({item: 99})
      validateId(d)
      validateData1(d)
    })

    it('should populate all fields', async () => {
      let address = Address.create({
        street: '123 Fake St.', city: 'Cityville', zipCode: 12345
      })

      let dog = Pet.create({
        type: 'dog', name: 'Fido'
      })

      let user = User.create({
        firstName: 'Billy', lastName: 'Bob', pet: dog, address: address
      })

      await Promise.all([address.save(), dog.save()])

      validateId(address)
      validateId(dog)
      await user.save()

      validateId(user)
      const u = await User.findOne({_id: user._id}, {populate: true})

      expect(u.pet).to.be.an.instanceof(Pet)
      expect(u.address).to.be.an.instanceof(Address)
    })

    it('should not populate any fields', async () => {
      let address = Address.create({
        street: '123 Fake St.', city: 'Cityville', zipCode: 12345
      })

      let dog = Pet.create({
        type: 'dog', name: 'Fido'
      })

      let user = User.create({
        firstName: 'Billy', lastName: 'Bob', pet: dog, address: address
      })

      await Promise.all([address.save(), dog.save()])
      validateId(address)
      validateId(dog)
      await user.save()

      validateId(user)
      const u = await User.findOne({_id: user._id}, {populate: false})

      expect(validators.isNativeId(u.pet)).to.be.true()
      expect(validators.isNativeId(u.address)).to.be.true()
    })

    it('should populate specified fields', async () => {
      let address = Address.create({
        street: '123 Fake St.', city: 'Cityville', zipCode: 12345
      })

      let dog = Pet.create({
        type: 'dog', name: 'Fido'
      })

      let user = User.create({
        firstName: 'Billy', lastName: 'Bob', pet: dog, address: address
      })

      await Promise.all([address.save(), dog.save()])
      validateId(address)
      validateId(dog)
      await user.save()
      validateId(user)

      const u = await User.findOne({_id: user._id}, {populate: ['pet']})
      expect(u.pet).to.be.an.instanceof(Pet)
      expect(validators.isNativeId(u.address)).to.be.true()

    })
  })

  describe('#findOneAndUpdate()', () => {
    it('should load and update a single object from the collection', async () => {
      let data = getData1()

      await data.save()
      validateId(data)
      const d = await Data.findOneAndUpdate({number: 1}, {source: 'wired'})

      validateId(d)
      expect(d.number).to.equal(1)
      expect(d.source).to.equal('wired')
    })

    it('should insert a single object to the collection', async () => {
      let d = await Data.findOne({number: 1})
      expect(d).to.be.null()
      const data = await Data.findOneAndUpdate({number: 1}, {number: 1}, {upsert: true})
      validateId(data)
      expect(data.number).to.equal(1)
      d = await  Data.findOne({number: 1})
      validateId(d)
      expect(d.number).to.equal(1)
    })
  })

  describe('#findOneAndDelete()', () => {
    it('should load and delete a single object from the collection', async () => {
      let data = getData1()

      await data.save()
      validateId(data)
      let count = await Data.count({number: 1})
      expect(count).to.be.equal(1)
      const numDeleted = await Data.findOneAndDelete({number: 1})
      expect(numDeleted).to.equal(1)
      count = await Data.count({number: 1})
      expect(count).to.equal(0)
    })
  })

  describe('#find()', async () => {
    beforeEach(async () => {
      Springfield = City.create({
        name: 'Springfield', population: 30720
      })

      SouthPark = City.create({
        name: 'South Park', population: 4388
      })

      Quahog = City.create({
        name: 'Quahog', population: 800
      })

      await Promise.all([Springfield.save(), SouthPark.save(), Quahog.save()])

      validateId(Springfield)
      validateId(SouthPark)
      validateId(Quahog)
    })

    it('should load multiple objects from the collection', async () => {
      const cities = await City.find({})
      expect(cities).to.have.length(3)
      validateId(cities[0])
      validateId(cities[1])
      validateId(cities[2])
    })

    it('should load all objects when query is not provided', async () => {
      const cities = await City.find()
      expect(cities).to.have.length(3)
      validateId(cities[0])
      validateId(cities[1])
      validateId(cities[2])
    })

    it('should sort results in ascending order', async () => {
      const cities = await City.find({}, {sort: 'population'})
      expect(cities).to.have.length(3)
      validateId(cities[0])
      validateId(cities[1])
      validateId(cities[2])
      expect(cities[0].population).to.be.equal(800)
      expect(cities[1].population).to.be.equal(4388)
      expect(cities[2].population).to.be.equal(30720)
    })

    it('should sort results in descending order', async () => {
      const cities = await City.find({}, {sort: '-population'})
      expect(cities).to.have.length(3)
      validateId(cities[0])
      validateId(cities[1])
      validateId(cities[2])
      expect(cities[0].population).to.be.equal(30720)
      expect(cities[1].population).to.be.equal(4388)
      expect(cities[2].population).to.be.equal(800)
    })

    it('should sort results using multiple keys', async () => {
      let AlphaVille = City.create({
        name: 'Alphaville', population: 4388
      })

      let BetaTown = City.create({
        name: 'Beta Town', population: 4388
      })

      await Promise.all([AlphaVille.save(), BetaTown.save()])
      const cities = await City.find({}, {sort: ['population', '-name']})
      expect(cities).to.have.length(5)
      validateId(cities[0])
      validateId(cities[1])
      validateId(cities[2])
      validateId(cities[3])
      validateId(cities[4])
      expect(cities[0].population).to.be.equal(800)
      expect(cities[0].name).to.be.equal('Quahog')
      expect(cities[1].population).to.be.equal(4388)
      expect(cities[1].name).to.be.equal('South Park')
      expect(cities[2].population).to.be.equal(4388)
      expect(cities[2].name).to.be.equal('Beta Town')
      expect(cities[3].population).to.be.equal(4388)
      expect(cities[3].name).to.be.equal('Alphaville')
      expect(cities[4].population).to.be.equal(30720)
      expect(cities[4].name).to.be.equal('Springfield')
    })

    it('should limit number of results returned', async () => {
      const cities = await City.find({}, {limit: 2})
      expect(cities).to.have.length(2)
      validateId(cities[0])
      validateId(cities[1])
    })

    it('should skip given number of results', async () => {
      const cities = await City.find({}, {sort: 'population', skip: 1})
      expect(cities).to.have.length(2)
      validateId(cities[0])
      validateId(cities[1])
      expect(cities[0].population).to.be.equal(4388)
      expect(cities[1].population).to.be.equal(30720)
    })

    it('should populate all fields', async () => {
      let address = Address.create({
        street: '123 Fake St.', city: 'Cityville', zipCode: 12345
      })

      let dog = Pet.create({
        type: 'dog', name: 'Fido'
      })

      let user1 = User.create({
        firstName: 'Billy', lastName: 'Bob', pet: dog, address: address
      })

      let user2 = User.create({
        firstName: 'Sally', lastName: 'Bob', pet: dog, address: address
      })

      await Promise.all([address.save(), dog.save()])
      validateId(address)
      validateId(dog)
      await Promise.all([user1.save(), user2.save()])
      validateId(user1)
      validateId(user2)
      const users = await User.find({}, {populate: true})

      expect(users[0].pet).to.be.an.instanceof(Pet)
      expect(users[0].address).to.be.an.instanceof(Address)
      expect(users[1].pet).to.be.an.instanceof(Pet)
      expect(users[1].address).to.be.an.instanceof(Address)
    })

    it('should not populate any fields', async () => {
      let address = Address.create({
        street: '123 Fake St.', city: 'Cityville', zipCode: 12345
      })

      let dog = Pet.create({
        type: 'dog', name: 'Fido'
      })

      let user1 = User.create({
        firstName: 'Billy', lastName: 'Bob', pet: dog, address: address
      })

      let user2 = User.create({
        firstName: 'Sally', lastName: 'Bob', pet: dog, address: address
      })

      await Promise.all([address.save(), dog.save()])
      validateId(address)
      validateId(dog)
      await Promise.all([user1.save(), user2.save()])

      validateId(user1)
      validateId(user2)
      const users = await User.find({}, {populate: false})
      expect(validators.isNativeId(users[0].pet)).to.be.true()
      expect(validators.isNativeId(users[0].address)).to.be.true()
      expect(validators.isNativeId(users[1].pet)).to.be.true()
      expect(validators.isNativeId(users[1].address)).to.be.true()
    })

    it('should populate specified fields', async () => {
      let address = Address.create({
        street: '123 Fake St.', city: 'Cityville', zipCode: 12345
      })

      let dog = Pet.create({
        type: 'dog', name: 'Fido'
      })

      let user1 = User.create({
        firstName: 'Billy', lastName: 'Bob', pet: dog, address: address
      })

      let user2 = User.create({
        firstName: 'Sally', lastName: 'Bob', pet: dog, address: address
      })

      await Promise.all([address.save(), dog.save()])
      validateId(address)
      validateId(dog)
      await Promise.all([user1.save(), user2.save()])
      validateId(user1)
      validateId(user2)
      const users = await User.find({}, {populate: ['pet']})

      expect(users[0].pet).to.be.an.instanceof(Pet)
      expect(validators.isNativeId(users[0].address)).to.be.true()
      expect(users[1].pet).to.be.an.instanceof(Pet)
      expect(validators.isNativeId(users[1].address)).to.be.true()

    })
  })

  describe('#count()', () => {
    it('should return 0 objects from the collection', async () => {
      let data1 = getData1()
      let data2 = getData2()

      await Promise.all([data1.save(), data2.save()])
      validateId(data2)
      const count = await Data.count({number: 3})
      expect(count).to.be.equal(0)
    })

    it('should return 2 matching objects from the collection', async () => {
      let data1 = getData1()
      let data2 = getData2()

      await Promise.all([data1.save(), data2.save()])
      validateId(data1)
      validateId(data2)
      const count = await Data.count({})
      expect(count).to.be.equal(2)
    })
  })

  describe('#delete()', () => {
    it('should remove instance from the collection', async () => {
      let data = getData1()

      await data.save()
      validateId(data)
      const numDeleted = await data.delete()
      expect(numDeleted).to.be.equal(1)
      const d = await Data.findOne({item: 99})
      expect(d).to.be.null()
    })
  })

  describe('#deleteOne()', () => {
    it('should remove the object from the collection', async () => {
      let data = getData1()

      await data.save()
      validateId(data)
      const numDeleted = await Data.deleteOne({number: 1})
      expect(numDeleted).to.be.equal(1)
      const d = await Data.findOne({number: 1})
      expect(d).to.be.null()
    })
  })

  describe('#deleteMany()', () => {
    it('should remove multiple objects from the collection', async () => {
      let data1 = getData1()
      let data2 = getData2()

      await Promise.all([data1.save(), data2.save()])
      validateId(data1)
      validateId(data2)
      const numDeleted = await Data.deleteMany({})
      expect(numDeleted).to.be.equal(2)
      const datas = await Data.find({})
      expect(datas).to.have.length(0)
    })

    it('should remove all objects when query is not provided', async () => {
      let data1 = getData1()
      let data2 = getData2()

      await Promise.all([data1.save(), data2.save()])
      validateId(data1)
      validateId(data2)
      const numDeleted = await Data.deleteMany()
      expect(numDeleted).to.be.equal(2)
      const datas = await Data.find({})
      expect(datas).to.have.length(0)
    })
  })

  describe('#clearCollection()', () => {
    it('should remove all objects from the collection', async () => {
      let data1 = getData1()
      let data2 = getData2()

      await Promise.all([data1.save(), data2.save()])
      validateId(data1)
      validateId(data2)
      await Data.clearCollection()
      const datas = await Data.find()
      expect(datas).to.have.length(0)
    })
  })
})
