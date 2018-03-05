'use strict'

import NeDbClient from './clients/nedbclient'

import MongoClient from './clients/mongoclient'

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
    const db = await NeDbClient.connect(url, options)
    global.CLIENT = db
    return db
  } else if (url.indexOf('mongodb://') > -1) {
    // url example: 'mongodb://localhost:27017/myproject'
    const db = await MongoClient.connect(url, options)
    global.CLIENT = db
    return db
  } else throw new Error('Unrecognized DB connection url.')
}
