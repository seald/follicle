import Datastore from '@seald-io/nedb'
import DatabaseClient from './client'
import { joinPath } from '../util'

/**
 * @param {String} url
 * @returns {String}
 */
const urlToPath = url => {
  if (url.indexOf('nedb://') > -1) {
    return url.slice(7, url.length)
  }
  return url
}

/**
 * @param {String} dbLocation
 * @param {String} collection
 * @returns {string|*}
 */
const getCollectionPath = (dbLocation, collection) => {
  if (dbLocation === 'memory') {
    return dbLocation
  }
  return joinPath(dbLocation, collection) + '.fdb'
}

/**
 * @param {String} collectionName
 * @param {String} url
 * @param {Object} options
 * @return {{datastore: Datastore, loaded: Promise<void>}}
 */
const createCollection = (collectionName, url, options) => {
  if (url === 'memory') {
    return { datastore: new Datastore({ ...options, inMemoryOnly: true }), loaded: Promise.resolve() }
  } else {
    const collectionPath = getCollectionPath(url, collectionName)
    const datastore = new Datastore({ ...options, filename: collectionPath, autoload: false })
    return { datastore, loaded: datastore.loadDatabaseAsync() }
  }
}

export default class NeDbClient extends DatabaseClient {
  constructor (url, collections, options = {}) {
    super(url)
    this._path = urlToPath(url)
    this._options = options

    /** @type {Object.<string, {datastore: Datastore, loaded: Promise<void>}>} */
    this._collections = collections || {}
  }

  /**
    * @param {String} name
    * @return {Promise<Datastore>}
  */
  async _getCollection (name) {
    if (!(name in this._collections)) this._collections[name] = createCollection(name, this._path, this._options)
    await this._collections[name].loaded
    return this._collections[name].datastore
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
    const db = await this._getCollection(collection)

    if (id === null) {
      const { _id } = await db.insertAsync(values)
      return _id
    } else return db.updateAsync({ _id: id }, { _id: id, ...values }, { upsert: true })
    // Yes, we have to put the id both in the query and in the actual document, or custom IDs fail
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
    const db = await this._getCollection(collection)
    return db.removeAsync({ _id: id })
  }

  /**
   * Delete one document by query
   *
   * @param {String} collection Collection's name
   * @param {Object} query Query
   * @returns {Promise}
   */
  async deleteOne (collection, query) {
    const db = await this._getCollection(collection)
    return db.removeAsync(query)
  }

  /**
   * Delete many documents by query
   *
   * @param {String} collection Collection's name
   * @param {Object} query Query
   * @returns {Promise}
   */
  async deleteMany (collection, query) {
    const db = await this._getCollection(collection)
    return db.removeAsync(query, { multi: true })
  }

  /**
   * Find one document
   *
   * @param {String} collection Collection's name
   * @param {Object} query Query
   * @returns {Promise}
   */
  async findOne (collection, query) {
    const db = await this._getCollection(collection)
    return db.findOneAsync(query)
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
    options.returnUpdatedDocs = true
    const db = await this._getCollection(collection)

    const { affectedDocuments } = await db.updateAsync(query, { $set: values }, options)
    return affectedDocuments
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
    const db = await this._getCollection(collection)
    return db.removeAsync(query, options)
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
    const db = await this._getCollection(collection)
    const cursor = db.findAsync(query)

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

      cursor.sort(sortOptions)
    }

    if (typeof options.skip === 'number') cursor.skip(options.skip)
    if (typeof options.limit === 'number') cursor.limit(options.limit)
    return cursor.execAsync()
  }

  /**
   * Get count of collection by query
   *
   * @param {String} collection Collection's name
   * @param {Object} query Query
   * @returns {Promise}
   */
  async count (collection, query) {
    const db = await this._getCollection(collection)
    return db.countAsync(query)
  }

  /**
   * Remove index
   *
   * @param {String} collection Collection's name
   * @param {String} field Field name
   * @returns {Promise}
   */
  async removeIndex (collection, field) {
    // The _id index is created by nedb and used in its internal functions.
    // Removing the _id index breaks the database:
    // - it would return empty Arrays at all requests;
    // - crash when creating a new index.
    // We silently avoid removing it.
    if (field === '_id') return
    const db = await this._getCollection(collection)
    await db.removeIndexAsync(field)
  }

  /**
   * List indexes
   *
   * @param {String} collection Collection's name
   * @returns {Promise<Array<string>>}
   */
  async listIndexes (collection) {
    const db = await this._getCollection(collection)
    return Object.keys(db.indexes)
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

    const db = await this._getCollection(collection)
    await db.ensureIndexAsync({ fieldName: field, unique: options.unique, sparse: options.sparse })
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
    return new NeDbClient(dbLocation, {}, options)
  }

  /**
   * Close current connection
   * Camo didn't close anything in its implementation, nedb does not expose any API to close anything.
   * It is a good idea to:
   *   - persist cached database & compact (done via persistCachedDatabase);
   *   - stop further compactions (doen via stopAutocompaction);
   *   - remove references to datastores so that they cannot be used without being re-loaded.
   *
   * @returns {Promise}
   */
  async close () {
    await this._waitForTasks()
    for (const collection of Object.keys(this._collections)) {
      let db
      try {
        await this._collections[collection].loaded
        db = this._collections[collection].datastore
        db.stopAutocompaction()
        await db.compactDatafileAsync()
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
   * **Warning:**this must be carefully used, will drop database known at this point in runtime. If no instance of a
   * model has been created, the collection of this model won't be dropped.
   * @returns {Promise}
   */
  async dropDatabase () {
    await this._waitForTasks()
    const datastores = Object.values(this._collections)
    await this.close()
    for (const { datastore } of datastores) {
      await datastore.dropDatabaseAsync()
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
