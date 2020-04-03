'use strict'

import * as path from 'path'
import * as fs from 'fs'
import Datastore from 'nedb'
import DatabaseClient from './client'
import temp from 'temp'
import util from 'util'

temp.track()

const urlToPath = url => {
  if (url.indexOf('nedb://') > -1) {
    return url.slice(7, url.length)
  }
  return url
}

const getCollectionPath = (dbLocation, collection) => {
  if (dbLocation === 'memory') {
    return dbLocation
  }
  return path.join(dbLocation, collection) + '.fdb'
}

const createCollection = async (collectionName, url, options, readOnly) => {
  if (url === 'memory') {
    return new Datastore({ ...options, inMemoryOnly: true })
  } else if (readOnly) {
    // The goal is to copy the collection to a temporary directory in order to be able to open it concurrently
    // from another instance of nedb. Otherwise, nedb tries to read/write to the `filename~` (note the ~) from both
    // instances, which causes IO crashes.
    // Once we have the instance of nedb on-disk, we only need to get all documents from it and insert them into a
    // read-only instance
    const collectionPath = getCollectionPath(url, collectionName)

    const tmpDir = await util.promisify(temp.mkdir)('temp-database')
    const tmpFile = path.join(tmpDir, collectionName)
    await util.promisify(fs.copyFile)(collectionPath, tmpFile)
    // We set a corruptAlertThreshold to 0 in order to alert when database corruption occurs rather than trying to repare it
    const intermediaryDataStore = new Datastore({ ...options, filename: tmpFile, autoload: false, corruptAlertThreshold: 0 })

    await util.promisify(intermediaryDataStore.loadDatabase.bind(intermediaryDataStore))()

    const data = await util.promisify(intermediaryDataStore.find.bind(intermediaryDataStore))({})
    const finalDataStore = new Datastore({ ...options, inMemoryOnly: true })

    await util.promisify(finalDataStore.insert.bind(finalDataStore))(data)

    await util.promisify(fs.unlink)(tmpFile)
    return finalDataStore
  } else {
    const collectionPath = getCollectionPath(url, collectionName)
    const dataStore = new Datastore({ ...options, filename: collectionPath, autoload: false })
    await util.promisify(dataStore.loadDatabase.bind(dataStore))()
    return dataStore
  }
}

const getCollection = async (name, collections, path, options, readOnly) => {
  if (!(name in collections)) collections[name] = createCollection(name, path, options, readOnly)
  return collections[name]
}

export default class NeDbClient extends DatabaseClient {
  constructor (url, collections, options = {}) {
    super(url)
    this._path = urlToPath(url)
    this._readOnly = options.readOnly || false
    delete options.readOnly
    this._options = options

    if (collections) {
      this._collections = collections
    } else {
      this._collections = {}
    }
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
    const db = await getCollection(collection, this._collections, this._path, this._options, this._readOnly)

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
    const db = await getCollection(collection, this._collections, this._path, this._options, this._readOnly)
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
    const db = await getCollection(collection, this._collections, this._path, this._options, this._readOnly)
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
    const db = await getCollection(collection, this._collections, this._path, this._options, this._readOnly)
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
    const db = await getCollection(collection, this._collections, this._path, this._options, this._readOnly)
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
    const db = await getCollection(collection, this._collections, this._path, this._options, this._readOnly)

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
    const db = await getCollection(collection, this._collections, this._path, this._options, this._readOnly)
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
    const db = await getCollection(collection, this._collections, this._path, this._options, this._readOnly)
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
    const db = await getCollection(collection, this._collections, this._path, this._options, this._readOnly)
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

    const db = await getCollection(collection, this._collections, this._path, this._options, this._readOnly)
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
    for (const collection in this._collections) {
      let db
      try {
        db = await getCollection(collection, this._collections, this._path, this._options, this._readOnly)
        db.persistence.stopAutocompaction()
        await util.promisify(db.persistence.persistCachedDatabase.bind(db.persistence))()
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
    for (const collection in this._collections) {
      const dbLocation = getCollectionPath(this._path, collection)
      // Only exists in memory, so just delete the 'Datastore'
      if (dbLocation !== 'memory') {
        // Delete the file, but only if it exists
        try {
          await util.promisify(fs.unlink)(dbLocation)
        } catch (error) {
          // pass, there is no one error code on all platforms that indicates the file does not exist
        }
      }
      delete this._collections[collection]
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
