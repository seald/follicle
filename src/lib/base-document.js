'use strict'

import _ from 'lodash'
import { ValidationError } from './errors'

export default ({client, validators}) => {
  const {
    isArray,
    isDate,
    isDocument,
    isEmbeddedDocument,
    isEmptyValue,
    isInChoices,
    isNumber,
    isString,
    isSupportedType,
    isValidType
  } = validators

  const normalizeType = property => {
    // TODO: Only copy over stuff we support

    let typeDeclaration = {}
    if (property.type) typeDeclaration = property
    else if (isSupportedType(property)) typeDeclaration.type = property
    else throw new Error('Unsupported type or bad variable. Remembuer, non-persisted objects must start with an underscore (_). Got:', property)

    return typeDeclaration
  }

  return class BaseDocument {
    constructor () {
      this._schema = { // Defines document structure/properties
        _id: {type: client.nativeIdType()} // Native ID to backend database
      }

      this._id = null
    }

    // TODO: Is there a way to tell if a class is
    // a subclass of something? Until I find out
    // how, we'll be lazy use this.
    static documentClass () {
      throw new TypeError('You must override documentClass (static).')
    }

    documentClass () {
      throw new TypeError('You must override documentClass.')
    }

    collectionName () {
      // DEPRECATED
      // Getting ready to remove this functionality
      if (this._meta) return this._meta.collection

      return this.constructor.collectionName()
    }

    /**
     * Get current collection name
     *
     * @returns {String}
     */
    static collectionName () {
      return this.name
      // DEPRECATED
      // Getting ready to remove this functionality
      /*
      let instance = new this()
      if (instance._meta) return instance._meta.collection

      return this.name.toLowerCase() + 's'
      */
    }

    /**
     * set schema
     * @param {Object} extension
     */
    schema (extension) {
      if (!extension) return

      _.keys(extension).forEach(k => {
        this[k] = extension[k]
      })
    }

    /*
     * Pre/post Hooks
     *
     * To add a hook, the extending class just needs
     * to override the appropriate hook method below.
     */

    preValidate () { }

    postValidate () { }

    preSave () { }

    postSave () { }

    preDelete () { }

    postDelete () { }

    /**
     * Generate this._schema from fields
     *
     * TODO : EMBEDDED
     * Need to share this with embedded
     */
    generateSchema () {
      const that = this

      _.keys(this).forEach(k => {
        // Ignore private variables
        if (_.startsWith(k, '_')) {
          return
        }

        // Normalize the type format
        this._schema[k] = normalizeType(this[k])

        // Assign a default if needed
        if (isArray(this._schema[k].type)) this[k] = that.getDefault(k) || []
        else this[k] = that.getDefault(k)
      })
    }

    /**
     * Validate current document
     *
     * The method throw errors if document has invalid value
     *
     * TODO: This is not the right approach. The method needs to collect all errors in array and return them.
     */
    validate () {
      _.keys(this._schema).forEach(key => {
        const value = this[key]

        // TODO: This should probably be in Document, not BaseDocument
        if (value !== null && value !== undefined) {
          if (isEmbeddedDocument(value)) {
            value.validate()
            return
          } else if (isArray(value) && value.length > 0 && isEmbeddedDocument(value[0])) {
            value.forEach(v => {
              if (v.validate) v.validate()
            })
            return
          }
        }

        if (!isValidType(value, this._schema[key].type)) {
          // TODO: Formatting should probably be done somewhere else
          let typeName = null
          let valueName = null
          if (Array.isArray(this._schema[key].type) && this._schema[key].type.length > 0) {
            typeName = `[${this._schema[key].type[0].name}]`
          } else if (Array.isArray(this._schema[key].type) && this._schema[key].type.length === 0) {
            typeName = '[]'
          } else {
            typeName = this._schema[key].type.name
          }

          // TODO: Not descriptive enough! Strings can look like numbers
          if (Array.isArray(value)) valueName = `[${value.toString()}]`
          else valueName = typeof (value)

          throw new ValidationError(`Value assigned to ${this.collectionName()}.${key} should be ${typeName}, got ${valueName}`)
        }

        if (this._schema[key].required && isEmptyValue(value)) { throw new ValidationError(`Key ${this.collectionName()}.${key} is required, but got ${value}`) }

        if (this._schema[key].match && isString(value) && !this._schema[key].match.test(value)) { throw new ValidationError(`Value assigned to ${this.collectionName()}.${key} does not match the regex/string ${this._schema[key].match.toString()}. Value was ${value}`) }

        if (!isInChoices(this._schema[key].choices, value)) { throw new ValidationError(`Value assigned to ${this.collectionName()}.${key} should be in choices [${this._schema[key].choices.join(', ')}], got ${value}`) }

        if (isNumber(this._schema[key].min) && value < this._schema[key].min) { throw new ValidationError(`Value assigned to ${this.collectionName()}.${key} is less than min, ${this._schema[key].min}, got ${value}`) }

        if (isNumber(this._schema[key].max) && value > this._schema[key].max) { throw new ValidationError(`Value assigned to ${this.collectionName()}.${key} is less than max, ${this._schema[key].max}, got ${value}`) }

        if (typeof (this._schema[key].validate) === 'function' && !this._schema[key].validate(value)) { throw new ValidationError(`Value assigned to ${this.collectionName()}.${key} failed custom validator. Value was ${value}`) }
      })
    }

    /*
     * Right now this only canonicalizes dates (integer timestamps
     * get converted to Date objects), but maybe we should do the
     * same for strings (UTF, Unicode, ASCII, etc)?
     */
    canonicalize () {
      _.keys(this._schema).forEach(key => {
        const value = this[key]

        if (this._schema[key].type === Date && isDate(value)) this[key] = new Date(value)
        // TODO: This should probably be in Document, not BaseDocument
        else if (value !== null && value !== undefined && value.documentClass && value.documentClass() === 'embedded') { value.canonicalize() }
      })
    }

    /**
     * Create new document from data
     *
     * @param {Object} data
     * @returns {Document}
     */
    static create (data) {
      this.createIndexes()

      if (typeof (data) !== 'undefined') return this._fromData(data)

      return this._instantiate()
    }

    static createIndexes () { }

    /**
     * Create new document from self
     *
     * @returns {BaseDocument}
     * @private
     */
    static _instantiate () {
      let instance = new this()
      instance.generateSchema()
      return instance
    }

    // TODO: Should probably move some of this to Embedded and Document classes since Base shouldn't need to know about child classes
    static _fromData (datas) {
      if (!isArray(datas)) datas = [datas]

      const documents = []
      datas.forEach(d => {
        const instance = this._instantiate()
        _.keys(d).forEach(key => {
          const value = d[key] === null ? instance.getDefault(key) : d[key]
          // If its not in the schema, we don't care about it... right?
          if (key in instance._schema) {
            const type = instance._schema[key].type
            // Initialize EmbeddedDocument
            if (type.documentClass && type.documentClass() === 'embedded') instance[key] = type._fromData(value)
            else if (isArray(type) && type.length > 0 && type[0].documentClass && type[0].documentClass() === 'embedded') {
              // Initialize array of EmbeddedDocuments
              instance[key] = []
              value.forEach((v, i) => {
                instance[key][i] = type[0]._fromData(v)
              })
            } else instance[key] = value // Initialize primitive or array of primitives
          } else if (key in instance) instance[key] = value // Handles virtual setters
        })
        documents.push(instance)
      })

      if (documents.length === 1) return documents[0]
      return documents
    }

    populate () {
      return BaseDocument.populate(this)
    }

    /**
     * Populates document references
     *
     * TODO : EMBEDDED
     * @param {Array|Document} docs
     * @param {Array} fields
     * @returns {Promise}
     */
    static async populate (docs, fields) {
      if (!docs) return []

      let documents = null

      if (!isArray(docs)) documents = [docs]
      else if (docs.length < 1) return docs
      else documents = docs

      // Load all 1-level-deep references
      // First, find all unique keys needed to be loaded...
      const keys = []

      // TODO: Bad assumption: Not all documents in the database will have the same schema...
      // Hmm, if this is true, thats an error on the user. Right?
      const anInstance = documents[0]

      _.keys(anInstance._schema).forEach(key => {
        // Only populate specified fields
        if (isArray(fields) && fields.indexOf(key) < 0) return

        // Handle array of references (ex: { type: [MyObject] })
        if (isArray(anInstance._schema[key].type) && anInstance._schema[key].type.length > 0 && isDocument(anInstance._schema[key].type[0])) keys.push(key)
        // Handle anInstance[key] being a string id, a native id, or a Document instance
        else if ((isString(anInstance[key]) || client.isNativeId(anInstance[key])) && isDocument(anInstance._schema[key].type)) keys.push(key)
      })

      // ...then get all ids for each type of reference to be loaded...
      // ids = {
      //   houses: {
      //     'abc123': ['ak23lj', '2kajlc', 'ckajl32'],
      //     'l2jo99': ['28dsa0']
      //   },
      //   friends: {
      //     '1039da': ['lj0adf', 'k2jha']
      //   }
      // }
      const ids = {}
      keys.forEach(k => {
        ids[k] = {}
        documents.forEach(d => {
          ids[k][client.toCanonicalId(d._id)] = [].concat(d[k]) // Handles values and arrays

          // Also, initialize document member arrays
          // to assign to later if needed
          if (isArray(d[k])) d[k] = []
        })
      })

      // TODO: Is this really the most efficient
      // way to do this? Maybe make a master list
      // of all objects that need to be loaded (separated
      // by type), load those, and then search through
      // ids to see where dereferenced objects should
      // go?

      // ...then for each array of ids, load them all...

      for (let key of _.keys(ids)) {
        let keyIds = []
        _.keys(ids[key]).forEach(k => {
          // Before adding to list, we convert id to the
          // backend database's native ID format.
          keyIds = keyIds.concat(ids[key][k])
        })

        // Only want to load each reference once
        keyIds = _.uniq(keyIds)

        // Handle array of references (like [MyObject])
        const type = isArray(anInstance._schema[key].type) ? anInstance._schema[key].type[0] : anInstance._schema[key].type

        // Bulk load dereferences
        const dereferences = await type.find({'_id': {$in: keyIds}}, {populate: false})
        // Assign each dereferenced object to parent

        _.keys(ids[key]).forEach(k => {
          // TODO: Replace with documents.find when able
          // Find the document to assign the derefs to
          let doc
          documents.forEach(d => {
            if (client.toCanonicalId(d._id) === k) doc = d
          })

          // For all ids to be dereferenced, find the
          // deref and assign or push it
          ids[key][k].forEach(id => {
            // TODO: Replace with dereferences.find when able
            // Find the right dereference
            let deref
            dereferences.forEach(d => {
              if (client.toCanonicalId(d._id) === client.toCanonicalId(id)) deref = d
            })

            if (isArray(anInstance._schema[key].type)) doc[key].push(deref)
            else doc[key] = deref
          })
        })
      }
      return docs
    }

    /**
     * Get default value
     *
     * @param {String} schemaProp Key of current schema
     * @returns {*}
     */
    getDefault (schemaProp) {
      if (schemaProp in this._schema && 'default' in this._schema[schemaProp]) {
        const def = this._schema[schemaProp].default
        const defVal = typeof (def) === 'function' ? def() : def
        this[schemaProp] = defVal // TODO: Wait... should we be assigning it here?
        return defVal
      } else if (schemaProp === '_id') return null
    }

    /**
     * For JSON.Stringify
     *
     * @returns {*}
     */
    toJSON () {
      const values = this._toData({_id: true})
      const schema = this._schema
      for (let key in schema) {
        if (schema.hasOwnProperty(key)) {
          if (schema[key].private) delete values[key]
          else if (values[key] && values[key].toJSON) values[key] = values[key].toJSON()
          else if (isArray(values[key])) {
            const newArray = []
            values[key].forEach(i => {
              if (i && i.toJSON) newArray.push(i.toJSON())
              else newArray.push(i)
            })
            values[key] = newArray
          }
        }
      }
      return values
    }

    /**
     *
     * @param keep
     * @returns {{}}
     * @private
     */
    _toData (keep = {}) {
      if (keep === null) keep = {}
      else if (keep._id === undefined) keep._id = true

      const values = {}
      _.keys(this).forEach((k) => {
        if (_.startsWith(k, '_')) {
          if (k === '_id' && keep._id) values[k] = this[k]
        } else if (isEmbeddedDocument(this[k])) values[k] = this[k]._toData()
        else if (isArray(this[k]) && this[k].length > 0 && isEmbeddedDocument(this[k][0])) {
          values[k] = []
          this[k].forEach(v => {
            values[k].push(v._toData())
          })
        } else values[k] = this[k]
      })

      return values
    }

    _getEmbeddeds () {
      let embeddeds = []
      _.keys(this._schema).forEach(v => {
        if (isEmbeddedDocument(this._schema[v].type) || (isArray(this._schema[v].type) && isEmbeddedDocument(this._schema[v].type[0]))) { embeddeds = embeddeds.concat(this[v]) }
      })
      return embeddeds
    }

    _getHookPromises (hookName) {
      const embeddeds = this._getEmbeddeds()
      let hookPromises = []
      hookPromises = hookPromises.concat(_.invokeMap(embeddeds, hookName))
      hookPromises.push(this[hookName]())
      return hookPromises
    }
  }
}
