import * as path from 'path'
import Datastore from 'react-native-local-mongodb'
import DatabaseClient from './client'
import AsyncStorage from '@react-native-community/async-storage'
import util from 'util'

const urlToPath = function (url) {
  if (url.indexOf('reactnedb://') > -1) {
    return url.slice(12, url.length)
  }
  return url
}

const getCollectionPath = function (dbLocation, collection) {
  if (dbLocation === 'memory') {
    return dbLocation
  }
  return path.join(dbLocation, collection)
}

const createCollection = function (collectionName, url, options) {
  if (url === 'memory') {
    return new Datastore({ inMemoryOnly: true, storage: AsyncStorage })
  }
  const collectionPath = getCollectionPath(url, collectionName)
  return new Datastore({ ...options, filename: collectionPath, autoload: true, storage: AsyncStorage })
}

const getCollection = function (name, collections, path, options) {
  if (!(name in collections)) {
    const collection = createCollection(name, path, options)
    collections[name] = collection
    return collection
  }

  return collections[name]
}

export default class ReactNativeLocalMongoClient extends DatabaseClient {
  constructor (url, collections, options) {
    super(url)
    this._path = urlToPath(url)

    this.options = options
    this._tasks = new Set()

    if (collections) {
      this._collections = collections
    } else {
      this._collections = {}
    }
  }

  _startTask (promise) {
    this._tasks.add(promise)
    promise.finally(() => this._tasks.delete(promise))
    return promise
  }

  async _waitForTasks () {
    return Promise.all(this._tasks.values())
  }

  /**
   * Save (upsert) document
   *
   * @param {String} collection Collection's name
   * @param {ObjectId?} id Document's id
   * @param {Object} values Data for save
   * @returns {Promise} Promise with result insert or update query
   */
  async save (collection, id, values) {
    const db = await getCollection(collection, this._collections, this._path, this._options)

    // TODO: I'd like to just use update with upsert:true, but I'm
    // note sure how the query will work if id == null. Seemed to
    // have some problems before with passing null ids.
    if (id === null) return (await util.promisify(db.insert.bind(db))(values))._id
    else return util.promisify(db.update.bind(db))({ _id: id }, { _id: id, ...values }, { upsert: true }) // Yes, we have to put the id both in the query and in the actual document, or custom IDs fail
  }

  /**
   * Delete document
   *
   * @param {String} collection Collection's name
   * @param {ObjectId} id Document's id
   * @returns {Promise}
   */
  async delete (collection, id) {
    if (id === null) return 0
    const db = await getCollection(collection, this._collections, this._path, this._options)
    return util.promisify(db.remove.bind(db))({ _id: id })
  }

  /**
   * Delete one document by query
   *
   * @param {String} collection Collection's name
   * @param {Object} query Query
   * @returns {Promise}
   */
  async deleteOne (collection, query) {
    const db = await getCollection(collection, this._collections, this._path, this._options)
    return util.promisify(db.remove.bind(db))(query)
  }

  /**
   * Delete many documents by query
   *
   * @param {String} collection Collection's name
   * @param {Object} query Query
   * @returns {Promise}
   */
  async deleteMany (collection, query) {
    const db = await getCollection(collection, this._collections, this._path, this._options)
    return util.promisify(db.remove.bind(db))(query, { multi: true })
  }

  /**
   * Find one document
   *
   * @param {String} collection Collection's name
   * @param {Object} query Query
   * @returns {Promise}
   */
  async findOne (collection, query) {
    const db = await getCollection(collection, this._collections, this._path, this._options)
    return util.promisify(db.findOne.bind(db))(query)
  }

  /**
   * Find one document and update it
   *
   * @param {String} collection Collection's name
   * @param {Object} query Query
   * @param {Object} values
   * @param {Object} options
   * @returns {Promise}
   */
  async findOneAndUpdate (collection, query, values, options = {}) {
    // Since this is 'findOne...' we'll only allow user to update
    // one document at a time
    options.multi = false
    const db = await getCollection(collection, this._collections, this._path, this._options)

    // TODO: Would like to just use 'Collection.update' here, but
    // it doesn't return objects on update (but will on insert)...
    /* db.update(query, values, options, function(error, numReplaced, newDoc) {
              if (error) return reject(error);
              resolve(newDoc);
          }); */

    const data = await this.findOne(collection, query)
    if (!data) {
      if (options.upsert) return util.promisify(db.insert.bind(db))(values)
      else return null
    } else {
      await util.promisify(db.update.bind(db))(query, { $set: values })
      // Fixes issue camo#55. Remove when NeDB is updated to v1.8+
      return this.findOne(collection, { _id: data._id })
    }
  }

  /**
   * Find one document and delete it
   *
   * @param {String} collection Collection's name
   * @param {Object} query Query
   * @param {Object} options
   * @returns {Promise}
   */
  async findOneAndDelete (collection, query, options = {}) {
    // Since this is 'findOne...' we'll only allow user to update
    // one document at a time
    options.multi = false
    const db = await getCollection(collection, this._collections, this._path, this._options)
    return util.promisify(db.remove.bind(db))(query, options)
  }

  /**
   * Find documents
   *
   * @param {String} collection Collection's name
   * @param {Object} query Query
   * @param {Object} options
   * @returns {Promise}
   */
  async find (collection, query, options) {
    const db = await getCollection(collection, this._collections, this._path, this._options)
    let cursor = db.find(query)

    if (options.sort && (Array.isArray(options.sort) || typeof options.sort === 'string' || options.sort instanceof String)) {
      const sortOptions = {}
      if (!Array.isArray(options.sort)) options.sort = [options.sort]

      options.sort.forEach(s => {
        if (typeof s !== 'string' && !(s instanceof String)) return

        let sortOrder = 1
        if (s[0] === '-') {
          sortOrder = -1
          s = s.substring(1)
        }
        sortOptions[s] = sortOrder
      })

      cursor = cursor.sort(sortOptions)
    }

    if (typeof options.skip === 'number') cursor = cursor.skip(options.skip)
    if (typeof options.limit === 'number') cursor = cursor.limit(options.limit)
    return util.promisify(cursor.exec.bind(cursor))()
  }

  /**
   * Get count of collection by query
   *
   * @param {String} collection Collection's name
   * @param {Object} query Query
   * @returns {Promise}
   */
  async count (collection, query) {
    const db = await getCollection(collection, this._collections, this._path, this._options)
    return util.promisify(db.count.bind(db))(query)
  }

  /**
   * Create index
   *
   * @param {String} collection Collection's name
   * @param {String} field Field name
   * @param {Object} options Options
   * @returns {Promise}
   */
  async createIndex (collection, field, options) {
    options = options || {}
    options.unique = options.unique || false
    options.sparse = options.sparse || false

    const db = await getCollection(collection, this._collections, this._path, this._options)
    await util.promisify(db.ensureIndex.bind(db))({ fieldName: field, unique: options.unique, sparse: options.sparse })
  }

  /**
   * Connect to database
   *
   * @param {String} url
   * @param {Object} options
   * @returns {Promise}
   */
  static async connect (url, options = {}) {
    // Could be directory path or 'memory'
    const dbLocation = urlToPath(url)
    return new ReactNativeLocalMongoClient(dbLocation, {}, options)
  }

  /**
   * Close current connection
   *
   * @returns {Promise}
   */
  async close () {
    await this._waitForTasks()
    for (const collection of Object.keys(this._collections)) {
      let db
      try {
        db = this._collections[collection]
        db.persistence.stopAutocompaction()
        const queueDrained = new Promise(resolve => { db.executor.queue.drain = resolve })
        // Since Collections are always loaded manually (not with nedb's `autoload`), and db is a properly loaded
        // Collection, the queue must be `ready`, and there is no need for forceQueuing the task in the Executor.
        // If those lines mean nothing to you, go and read nedb's executor.js and particularly the `push` method, the
        // `processBuffer` method, where it's called.
        db.executor.push({ this: db.persistence, fn: db.persistence.persistCachedDatabase, arguments: [] }, false)
        await queueDrained
      } catch (error) {
        console.warn(`Collection ${collection} cannot be loaded because of ${error}.
        Skipping`)
      }
    }
    this._collections = {}
  }

  /**
   * Drop collection
   *
   * @param {String} collection
   * @returns {Promise}
   */
  clearCollection (collection) {
    return this.deleteMany(collection, {})
  }

  /**
   * Drop current database
   * @returns {Promise}
   */
  // TODO: this must be carefully used, will drop database known at this point in runtime. If no instance of a model has been created, the collection of this model won't be dropped.
  async dropDatabase () {
    await this._waitForTasks()
    const locations = Object.keys(this._collections).map(collection => getCollectionPath(this._path, collection))
    await this.close()
    for (const location of locations) {
      // Only exists in memory, so just delete the 'Datastore'
      if (location !== 'memory') {
        // Delete the file, but only if it exists
        try {
          // Delete the file, but only if it exists
          const result = await AsyncStorage.getItem(location)
          if (result) await AsyncStorage.removeItem(location)
        } catch (error) {
          console.error('deletion errored with error', error)
          // pass, there is no one error code on all platforms that indicates the file does not exist
        }
      }
    }
  }

  toCanonicalId (id) {
    return id
  }

  // Native ids are the same as NeDB ids
  isNativeId (value) {
    return String(value).match(/^[a-zA-Z0-9]{16}$/) !== null
  }

  nativeIdType () {
    return String
  }

  driver () {
    return this._collections
  }
}
