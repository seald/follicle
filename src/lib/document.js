import depd from 'depd'
import { migrateDocument } from './util'
import { CamoError } from './errors'

const deprecate = depd('camo')

export default ({ client, BaseDocument, validators, migrations = {} }) => {
  const { isArray, isEmbeddedDocument, isReferenceable } = validators

  return class Document extends BaseDocument {
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
     * @returns {Promise}
     */
    save () {
      return client._startTask(this._save())
    }

    /**
     * Save (upsert) current document
     *
     * TODO: The method is too long and complex, it is necessary to divide...
     * @returns {Promise}
     */
    async _save () {
      await Promise.all(this._getHookPromises('preValidate'))

      // Ensure we at least have defaults set

      // TODO: We already do this on .create(), so should it really be done again?
      Object.keys(this._schema).forEach(key => {
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
      const toUpdate = this._toData({ _id: false })

      // Reference our objects
      Object.keys(this._schema).forEach(key => {
        // Never care about _id
        if (key === '_id') return
        // isReferenceable OR ( isArray AND contains value AND value isReferenceable )
        if (isReferenceable(this[key]) || (isArray(this[key]) && this[key].length > 0 && isReferenceable(this[key][0]))) {
          // Handle array of references (ex: { type: [MyObject] })
          if (isArray(this[key])) {
            toUpdate[key] = []
            this[key].forEach(v => {
              if (client.isNativeId(v)) toUpdate[key].push(v)
              else toUpdate[key].push(v._id)
            })
          } else {
            if (client.isNativeId(this[key])) toUpdate[key] = this[key]
            else toUpdate[key] = this[key]._id
          }
        }
      })

      // Replace EmbeddedDocument references with just their data
      Object.keys(this._schema).forEach(key => {
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

      toUpdate._version = this.constructor._getDocumentVersion()
      const id = await client.save(this.collectionName(), this._id, toUpdate)
      if (this._id === null) this._id = id
      // TODO: hack?
      await Promise.all(this._getHookPromises('postSave'))
      return this
    }

    /**
     * Delete current document
     * @returns {Promise}
     */
    delete () {
      return client._startTask(this._delete())
    }

    /**
     * Delete current document
     *
     * @returns {Promise}
     */
    async _delete () {
      const preDeletePromises = this._getHookPromises('preDelete')

      await Promise.all(preDeletePromises)
      const deleteReturn = await client.delete(this.collectionName(), this._id)
      // TODO: hack?
      const postDeletePromises = [deleteReturn].concat(this._getHookPromises('postDelete'))
      const prevData = await Promise.all(postDeletePromises)
      return prevData[0]
    }

    /**
     * Delete one document in current collection
     *
     * @param {Object} query Query
     * @returns {Promise}
     */
    static deleteOne (query) {
      return client._startTask(this._deleteOne(query))
    }

    /**
     * Delete one document in current collection
     *
     * @param {Object} query Query
     * @returns {Promise}
     */
    static async _deleteOne (query) {
      return client.deleteOne(this.collectionName(), query)
    }

    /**
     * Delete many documents in current collection
     *
     * @param {Object} query Query
     * @returns {Promise}
     */
    static deleteMany (query = {}) {
      return client._startTask(this._deleteMany(query))
    }

    /**
     * Delete many documents in current collection
     *
     * @param {Object} query Query
     * @returns {Promise}
     */
    static async _deleteMany (query = {}) {
      if (query === null) query = {}

      return client.deleteMany(this.collectionName(), query)
    }

    /**
     * Find one document in current collection
     *
     * TODO: Need options to specify whether references should be loaded
     *
     * @param {Object} query Query
     * @param {Object} [options = {}]
     * @param {boolean|Array<string>>} [options.populate = true]
     * @returns {Promise}
     */
    static findOne (query, options) {
      return client._startTask(this._findOne(query, options))
    }

    /**
     * Find one document in current collection
     *
     * TODO: Need options to specify whether references should be loaded
     *
     * @param {Object} query Query
     * @param {Object} [options = {}]
     * @param {boolean|Array<string>>} [options.populate = true]
     * @returns {Promise}
     */
    static async _findOne (query, { populate = true } = {}) {
      const data = await client.findOne(this.collectionName(), query)
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
    static findOneAndUpdate (query, values, options) {
      return client._startTask(this._findOneAndUpdate(query, values, options))
    }

    /**
     * Find one document and update it in current collection
     *
     * @param {Object} query Query
     * @param {Object} values
     * @param {Object} [options = {}]
     * @param {boolean|Array<string>>} [options.populate = true]
     * @returns {Promise}
     */
    static async _findOneAndUpdate (query, values, options = {}) {
      const populate = Object.prototype.hasOwnProperty.call(options, 'populate') ? options.populate : true

      const data = await client.findOneAndUpdate(this.collectionName(), query, values, options)
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
    static findOneAndDelete (query, options = {}) {
      return client._startTask(this._findOneAndDelete(query, options))
    }

    /**
     * Find one document and delete it in current collection
     *
     * @param {Object} query Query
     * @param {Object} options
     * @returns {Promise}
     */
    static async _findOneAndDelete (query, options = {}) {
      return client.findOneAndDelete(this.collectionName(), query, options)
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
    static find (query, options) {
      return client._startTask(this._find(query, options))
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
    static async _find (query = {}, options) {
      if (options === undefined || options === null) {
        // Populate by default
        // TODO: if options is set, populate isn't true by default, is that the expected behaviour ?
        options = { populate: true }
      }

      const datas = await client.find(this.collectionName(), query, options)
      let docs = this._fromData(datas)
      if (options.populate === true || (isArray(options.populate) && options.populate.length > 0)) docs = await this.populate(docs, options.populate)
      // Ensure we always return an array
      return [].concat(docs)
    }

    /**
     * Get count documents in current collection by query
     *
     * @param {Object} query Query
     * @returns {Promise}
     */
    static count (query) {
      return client._startTask(this._count(query))
    }

    /**
     * Get count documents in current collection by query
     *
     * @param {Object} query Query
     * @returns {Promise}
     */
    static async _count (query) {
      return client.count(this.collectionName(), query)
    }

    static removeIndexes () {
      return client._startTask(this._removeIndexes())
    }

    static async _removeIndexes () {
      for (const k of await client.listIndexes(this.collectionName())) {
        // The _id index cannot be removed, otherwise the collection is not indexed at all, and all queries will return
        // empty.
        if (k !== '_id') await client.removeIndex(this.collectionName(), k)
      }
      this._indexesCreated = false
    }

    static createIndexes () {
      return client._startTask(this._createIndexes())
    }

    /**
     * Create indexes
     *
     * @returns {Promise}
     */
    static async _createIndexes () {
      if (this._indexesCreated) return
      const instance = this._instantiate()

      for (const k of Object.keys(instance._schema)) {
        if (instance._schema[k].unique) await client.createIndex(this.collectionName(), k, { unique: true })
      }

      this._indexesCreated = true
    }

    static _fromData (datas) {
      if (!isArray(datas)) datas = [datas]
      const documentVersion = this._getDocumentVersion()
      if (datas.some(data => Object.prototype.hasOwnProperty.call(data, '_version') && data._version !== documentVersion)) throw new CamoError('💩')

      return super._fromData(datas)
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
    }

    static _getDocumentVersion () {
      return this._getMigrations().length // cast to string
    }

    static _getMigrations () {
      return migrations[this.collectionName()] || []
    }

    static _migrateCollection () {
      return client._startTask(this.__migrateCollection())
    }

    static async __migrateCollection () {
      const data = await client.find(this.collectionName(), { _version: { $ne: this._getDocumentVersion() } }, {})
      // The constraints in the model may have changed between the previous version and the current version of the
      // model. Instead of inferring if the indexes currently in database match the model, we remove existing
      // constraints during the migration and add new clean constraints from the current version of the model.
      // Because this can be a heavy operation, we only do it if there are some documents to migrate in the collection.
      if (data.length) await this.removeIndexes()
      const migrate = migrateDocument(this._getMigrations())
      await Promise.all(data
        .map(entry => migrate(entry))
        .map(async entry => client.save(this.collectionName(), entry._id, entry))
      )
      await this.createIndexes()
    }

    /**
     * Clear current collection
     *
     * @returns {Promise}
     */
    static clearCollection () {
      return client._startTask(this._clearCollection())
    }

    /**
     * Clear current collection
     *
     * @returns {Promise}
     */
    static async _clearCollection () {
      return client.clearCollection(this.collectionName())
    }
  }
}
