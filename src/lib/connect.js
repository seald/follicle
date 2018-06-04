'use strict'

import { DocumentsFactory } from './documentsFactory'

/**
 * Connect to current database
 *
 * @param {String} url
 * @param {Object} [options]
 * @returns {Promise}
 */
export const connect = async (url, options, migrations) => {
  if (url.indexOf('nedb://') > -1) {
    // url example: nedb://path/to/file/folder
    const client = await (require('./clients/nedbclient').default.connect(url, options))
    return DocumentsFactory(client, migrations)
  } else if (url.indexOf('mongodb://') > -1) {
    // url example: mongodb://localhost/db
    const client = await (require('./clients/mongoclient').default.connect(url, options))
    return DocumentsFactory(client, migrations)
  } else throw new Error('Unrecognized DB connection url.')
}
