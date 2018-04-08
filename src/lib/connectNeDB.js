'use strict'

import { DocumentsFactory } from './documentsFactory'

/**
 * Connect to current database
 *
 * @param {String} url
 * @param {Object} [options]
 * @returns {Promise}
 */
export const connectNeDB = async (url, options, migrations) => {
  if (url.indexOf('nedb://') > -1) {
    // url example: nedb://path/to/file/folder
    const client = await (require('./clients/nedbclient').default.connect(url, options))
    return DocumentsFactory(client, migrations)
  } else throw new Error('Unrecognized DB connection url.')
}
