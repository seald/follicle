'use strict'

import * as path from 'path'
import * as fs from 'fs'
import _ from 'lodash'
import Datastore from 'nedb'
import DatabaseClient from './client'
import tmp from 'tmp'

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
    const { path: tmpDir, cleanupBackup } = await new Promise((resolve, reject) => {
      // Setting the `unsafeCleanup` option to `true` allows to delete a directory even if it contains items when
      // calling the `cleanupCallback`
      tmp.dir({ unsafeCleanup: true }, (err, path, cleanupBackup) => {
        if (err) reject(err)
        else {
          resolve({ path, cleanupBackup })
        }
      })
    })
    const tmpFile = path.join(tmpDir, collectionName)
    await new Promise((resolve, reject) => {
      fs.copyFile(collectionPath, tmpFile, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
    // We set a corruptAlertThreshold to 0 in order to alert when database corruption occurs rather than trying to repare it
    const intermediaryDataStore = new Datastore({ ...options, filename: tmpFile, autoload: true, corruptAlertThreshold: 0 })
    const data = await new Promise((resolve, reject) => {
      intermediaryDataStore.find({}, (err, results) => {
        if (err) reject(err)
        else resolve(results)
      })
    })
    const finalDataStore = new Datastore({ ...options, inMemoryOnly: true })
    await new Promise((resolve, reject) => {
      finalDataStore.insert(data, (err, docs) => {
        if (err) reject(err)
        else resolve(docs)
      })
    })
    cleanupBackup() // cleanup intermediary datastore
    return finalDataStore
  } else {
    const collectionPath = getCollectionPath(url, collectionName)
    return new Datastore({ ...options, filename: collectionPath, autoload: true })
  }
}

const getCollection = async (name, collections, path, options, readOnly) => {
  if (!(name in collections)) {
    // there is a bit of trickery here to avoid race conditions, take 1g of acetaminophen if necessary
    collections[name] = createCollection(name, path, options, readOnly)
    collections[name] = await collections[name]
    return collections[name]
  }

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
    if (id === null) {
      return new Promise((resolve, reject) => {
        db.insert(values, (error, result) => {
          if (error) reject(error)
          else resolve(result._id)
        })
      })
    } else {
      return new Promise((resolve, reject) => {
        db.update({ _id: id }, { $set: values }, { upsert: true }, (error, result) => {
          if (error) reject(error)
          else resolve(result)
        })
      })
    }
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
    return new Promise((resolve, reject) => {
      db.remove({ _id: id }, (error, numRemoved) => {
        if (error) reject(error)
        else resolve(numRemoved)
      })
    })
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
    return new Promise((resolve, reject) => {
      db.remove(query, (error, numRemoved) => {
        if (error) reject(error)
        else resolve(numRemoved)
      })
    })
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
    return new Promise((resolve, reject) => {
      db.remove(query, { multi: true }, (error, numRemoved) => {
        if (error) reject(error)
        else resolve(numRemoved)
      })
    })
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
    return new Promise((resolve, reject) => {
      db.findOne(query, (error, result) => {
        if (error) reject(error)
        else resolve(result)
      })
    })
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
  async findOneAndUpdate (collection, query, values, options) {
    if (!options) {
      options = {}
    }

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
      if (options.upsert) {
        return new Promise((resolve, reject) => {
          db.insert(values, (error, result) => {
            if (error) reject(error)
            else resolve(result)
          })
        })
      } else return null
    } else {
      await new Promise((resolve, reject) => {
        db.update(query, { $set: values }, (error, result) => {
          if (error) reject(error)
          else resolve(result) // Fixes issue #55. Remove when NeDB is updated to v1.8+
        })
      })
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
  async findOneAndDelete (collection, query, options) {
    if (!options) {
      options = {}
    }

    // Since this is 'findOne...' we'll only allow user to update
    // one document at a time
    options.multi = false
    const db = await getCollection(collection, this._collections, this._path, this._options, this._readOnly)
    return new Promise((resolve, reject) => {
      db.remove(query, options, (error, numRemoved) => {
        if (error) reject(error)
        else resolve(numRemoved)
      })
    })
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

    if (options.sort && (_.isArray(options.sort) || _.isString(options.sort))) {
      const sortOptions = {}
      if (!_.isArray(options.sort)) options.sort = [options.sort]

      options.sort.forEach(s => {
        if (!_.isString(s)) return

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
    return new Promise((resolve, reject) => {
      cursor.exec((error, result) => {
        if (error) reject(error)
        else resolve(result)
      })
    })
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
    return new Promise((resolve, reject) => {
      db.count(query, (error, count) => {
        if (error) reject(error)
        else resolve(count)
      })
    })
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
    db.ensureIndex({ fieldName: field, unique: options.unique, sparse: options.sparse })
  }

  /**
   * Connect to database
   *
   * @param {String} url
   * @param {Object} options
   * @returns {Promise}
   */
  static connect (url, options = {}) {
    // Could be directory path or 'memory'
    const dbLocation = urlToPath(url)

    return new Promise(resolve => {
      const collections = {}

      // TODO: Load all data upfront or on-demand?
      // Maybe give user the option to load upfront.
      // But which should we do by default?
      /* fs.readdir(dbLocation, function(error, files) {
                files.forEach(function(file) {
                    let extname = path.extname(file);
                    let filename = file.split('.')[0];
                    if (extname === '.db' && filename.length > 0) {
                        let collectionName = filename;
                        collections[collectionName] = createCollection(collectionName, dbLocation);
                    }
                });
                global.CLIENT = new NeDbClient(dbLocation, collections);
                resolve(global.CLIENT);
            }); */
      // global.CLIENT = new NeDbClient(dbLocation, collections);
      resolve(new NeDbClient(dbLocation, collections, options))
    })
  }

  /**
   * Close current connection
   *
   * @returns {Promise}
   */
  close () {
    // Nothing to do for NeDB
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
  dropDatabase () {
    const clearPromises = []
    _.keys(this._collections).forEach(key => {
      const p = new Promise((resolve, reject) => {
        const dbLocation = getCollectionPath(this._path, key)

        if (dbLocation === 'memory') {
          // Only exists in memory, so just delete the 'Datastore'
          delete this._collections[key]
          resolve()
        } else {
          // Delete the file, but only if it exists
          fs.stat(dbLocation, err => {
            if (err === null) {
              fs.unlink(dbLocation, err => {
                if (err) reject(err)
                else {
                  delete this._collections[key]
                  resolve()
                }
              })
            } else resolve()
          })
        }
      })
      clearPromises.push(p)
    })

    return Promise.all(clearPromises)
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
