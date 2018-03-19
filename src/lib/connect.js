'use strict'

import NeDbClient from './clients/nedbclient'

import MongoClient from './clients/mongoclient'
import getBaseDocument from './base-document'
import getEmbeddedDocument from './embedded-document'
import getDocument from './document'
import getValidators from './validate'

/**
 * Connect to current database
 *
 * @param {String} url
 * @param {Object} options
 * @returns {Promise}
 */
export const connect = async (url, options) => {
  if (url.indexOf('nedb://') > -1) {
    // url example: nedb://path/to/file/folder
    const client = await NeDbClient.connect(url, options)
    const validators = getValidators({client})
    const BaseDocument = getBaseDocument({client, validators})
    const Document = getDocument({BaseDocument, client, validators})
    const EmbeddedDocument = getEmbeddedDocument({BaseDocument, client, validators})

    return {
      client,
      validators,
      BaseDocument,
      Document,
      EmbeddedDocument
    }
  } else if (url.indexOf('mongodb://') > -1) {
    // url example: 'mongodb://localhost:27017/myproject'
    const client = await MongoClient.connect(url, options)
    const validators = getValidators({client})
    const BaseDocument = getBaseDocument({client})
    const Document = getDocument({BaseDocument, client})
    const EmbeddedDocument = getEmbeddedDocument({client})

    return {
      client,
      validators,
      BaseDocument,
      Document,
      EmbeddedDocument
    }
  } else throw new Error('Unrecognized DB connection url.')
}
