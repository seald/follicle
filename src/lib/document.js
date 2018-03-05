'use strict'

import _ from 'lodash'
import depd from 'depd'
import { getClient as DB } from './clients'
import BaseDocument from './base-document'
import { isArray, isEmbeddedDocument, isReferenceable, isString, isSupportedType } from './validate'

const deprecate = depd('camo')

export default class Document extends BaseDocument {
  constructor (name) {
    super()

    if (name !== undefined && name !== null) {
      deprecate('Document.constructor(name) - override Document.collectionName() instead')
      this._meta = {
        collection: name
      }
    }
  }

  // TODO: Is there a way to tell if a class is
  // a subclass of something? Until I find out
  // how, we'll be lazy use this.
  static documentClass () {
    return 'document'
  }

  documentClass () {
    return 'document'
  }

  get meta () {
    return this._meta
  }

  set meta (meta) {
    this._meta = meta
  }

  /**
   * Save (upsert) current document
   *
   * TODO: The method is too long and complex, it is necessary to divide...
   * @returns {Promise}
   */
  async save () {
    await Promise.all(this._getHookPromises('preValidate'))

    // Ensure we at least have defaults set

    // TODO: We already do this on .create(), so should it really be done again?
    _.keys(this._schema).forEach(key => {
      if (!(key in this._schema)) this[key] = this.getDefault(key)
    })

    // Validate the assigned type, choices, and min/max
    this.validate()

    // Ensure all data types are saved in the same encodings
    this.canonicalize()

    await Promise.all(this._getHookPromises('postValidate'))
    await Promise.all(this._getHookPromises('preSave'))
    // TODO: We should instead track what has changed and
    // only update those values. Maybe make this._changed
    // object to do this.
    // Also, this might be really slow for objects with
    // lots of references. Figure out a better way.
    let toUpdate = this._toData({_id: false})

    // Reference our objects
    _.keys(this._schema).forEach(key => {
      // Never care about _id
      if (key === '_id') return
      // isReferenceable OR ( isArray AND contains value AND value isReferenceable )
      if (isReferenceable(this[key]) || (isArray(this[key]) && this[key].length > 0 && isReferenceable(this[key][0]))) {
        // Handle array of references (ex: { type: [MyObject] })
        if (isArray(this[key])) {
          toUpdate[key] = []
          this[key].forEach(v => {
            if (DB().isNativeId(v)) toUpdate[key].push(v)
            else toUpdate[key].push(v._id)
          })
        } else {
          if (DB().isNativeId(this[key])) toUpdate[key] = this[key]
          else toUpdate[key] = this[key]._id
        }
      }
    })

    // Replace EmbeddedDocument references with just their data
    _.keys(this._schema).forEach(key => {
      // isEmbeddedDocument OR ( isArray AND contains value AND value isEmbeddedDocument )
      if (isEmbeddedDocument(this[key]) || (isArray(this[key]) && this[key].length > 0 && isEmbeddedDocument(this[key][0]))) {
        // Handle array of references (ex: { type: [MyObject] })
        if (isArray(this[key])) {
          toUpdate[key] = []
          this[key].forEach(v => {
            toUpdate[key].push(v._toData())
          })
        } else toUpdate[key] = this[key]._toData()
      }
    })

    const id = await DB().save(this.collectionName(), this._id, toUpdate)
    if (this._id === null) this._id = id
    // TODO: hack?
    await Promise.all(this._getHookPromises('postSave'))
    return this
  }

  /**
   * Delete current document
   *
   * @returns {Promise}
   */
  async delete () {
    let preDeletePromises = this._getHookPromises('preDelete')

    await Promise.all(preDeletePromises)
    const deleteReturn = await DB().delete(this.collectionName(), this._id)
    // TODO: hack?
    let postDeletePromises = [deleteReturn].concat(this._getHookPromises('postDelete'))
    const prevData = await Promise.all(postDeletePromises)
    return prevData[0]
  }

  /**
   * Delete one document in current collection
   *
   * @param {Object} query Query
   * @returns {Promise}
   */
  static async deleteOne (query) {
    return DB().deleteOne(this.collectionName(), query)
  }

  /**
   * Delete many documents in current collection
   *
   * @param {Object} query Query
   * @returns {Promise}
   */
  static async deleteMany (query = {}) {
    if (query === null) query = {}

    return DB().deleteMany(this.collectionName(), query)
  }

  /**
   * Find one document in current collection
   *
   * TODO: Need options to specify whether references should be loaded
   *
   * @param {Object} query Query
   * @returns {Promise}
   */
  static async findOne (query, options = {}) {
    const populate = options.hasOwnProperty('populate') ? options.populate : true

    const data = await DB().findOne(this.collectionName(), query)
    if (!data) return null

    let doc = this._fromData(data)
    if (populate === true || (isArray(populate) && populate.length > 0)) doc = this.populate(doc, populate)
    return doc || null
  }

  /**
   * Find one document and update it in current collection
   *
   * @param {Object} query Query
   * @param {Object} values
   * @param {Object} options
   * @returns {Promise}
   */
  static async findOneAndUpdate (query, values, options = {}) {
    const populate = options.hasOwnProperty('populate') ? options.populate : true

    const data = await DB().findOneAndUpdate(this.collectionName(), query, values, options)
    if (!data) {
      return null
    }

    let doc = this._fromData(data)
    if (populate) doc = this.populate(doc)
    return doc || null
  }

  /**
   * Find one document and delete it in current collection
   *
   * @param {Object} query Query
   * @param {Object} options
   * @returns {Promise}
   */
  static async findOneAndDelete (query, options = {}) {
    return DB().findOneAndDelete(this.collectionName(), query, options)
  }

  /**
   * Find documents
   *
   * TODO: Need options to specify whether references should be loaded
   *
   * @param {Object} query Query
   * @param {Object} options
   * @returns {Promise}
   */
  static async find (query = {}, options) {
    if (options === undefined || options === null) {
      // Populate by default
      // TODO: if options is set, populate isn't true by default, is that the expected behaviour ?
      options = {populate: true}
    }
    console.log(query, options)

    const datas = await DB().find(this.collectionName(), query, options)
    console.log(datas)
    let docs = this._fromData(datas)
    console.log(docs)
    if (options.populate === true || (isArray(options.populate) && options.populate.length > 0)) docs = await this.populate(docs, options.populate)
    console.log(docs)
    // Ensure we always return an array
    return [].concat(docs)
  }

  /**
   * Get count documents in current collection by query
   *
   * @param {Object} query Query
   * @returns {Promise}
   */
  static async count (query) {
    return DB().count(this.collectionName(), query)
  }

  /**
   * Create indexes
   *
   * @returns {Promise}
   */
  static createIndexes () {
    if (this._indexesCreated) return
    let instance = this._instantiate()

    _.keys(instance._schema).forEach(k => {
      if (instance._schema[k].unique) DB().createIndex(this.collectionName(), k, {unique: true})
    })

    this._indexesCreated = true
  }

  static _fromData (datas) {
    const instances = super._fromData(datas)
    // This way we preserve the original structure of the data. Data
    // that was passed as an array is returned as an array, and data
    // passes as a single object is returned as single object
    /*
    let datasArray = [].concat(datas)
    let instancesArray = [].concat(instances)

     instancesArray = instancesArray.map((instanceArray, i) => {
      if (datasArray[i].hasOwnProperty('_id')) {
        instanceArray._id = datasArray[i]._id
      } else {
        instanceArray._id = null
      }
    })
    */

    return instances
  }

  /**
   * Clear current collection
   *
   * @returns {Promise}
   */
  static async clearCollection () {
    return DB().clearCollection(this.collectionName())
  }
}
