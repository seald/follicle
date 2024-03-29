export default class DatabaseClient {
  constructor (url) {
    this._url = url
    /**
     * Set of the ongoing tasks
     * @type {Set<Promise>}
     * @private
     */
    this._tasks = new Set()
  }

  /**
   * Adds an ongoing task
   * Should be used for each task involving the database from the Document class
   * @param {Promise<*>} promise
   * @returns {Promise<*>}
   */
  _startTask (promise) {
    const p = promise.finally(() => this._tasks.delete(p)).catch(() => {})
    this._tasks.add(p)
    return promise.then(x => x) // this "creates" a new promise so that it triggers an 'unhandledRejection' event if `promise` fails and is unhandled
  }

  /**
   * Waits for all ongoing tasks to finish (fail or succeed)
   * Can be awaited at any time when you want to ensure all ongoing tasks are over.
   * @returns {Promise<[*]>}
   */
  async _waitForTasks () {
    return Promise.all(this._tasks.values())
  }

  save (collection, query, values) {
    throw new TypeError('You must override save.')
  }

  delete (collection) {
    throw new TypeError('You must override delete.')
  }

  deleteOne (collection, query) {
    throw new TypeError('You must override deleteOne.')
  }

  deleteMany (collection, query) {
    throw new TypeError('You must override deleteMany.')
  }

  findOne (collection, query) {
    throw new TypeError('You must override findOne.')
  }

  findOneAndUpdate (collection, query, values, options) {
    throw new TypeError('You must override findOneAndUpdate.')
  }

  findOneAndDelete (collection, query, options) {
    throw new TypeError('You must override findOneAndDelete.')
  }

  find (collection, query, options) {
    throw new TypeError('You must override findMany.')
  }

  count (collection, query) {
    throw new TypeError('You must override count.')
  }

  createIndex (collection, field, options) {
    throw new TypeError('You must override createIndex.')
  }

  removeIndex (collection, field) {
    throw new TypeError('You must override removeIndex.')
  }

  listIndexes (collection) {
    throw new TypeError('You must override listIndexes.')
  }

  static connect (url, options) {
    throw new TypeError('You must override connect (static).')
  }

  close () {
    throw new TypeError('You must override close.')
  }

  clearCollection (collection) {
    throw new TypeError('You must override clearCollection.')
  }

  dropDatabase () {
    throw new TypeError('You must override dropDatabase.')
  }

  toCanonicalId (id) {
    throw new TypeError('You must override toCanonicalId.')
  }

  isNativeId (value) {
    throw new TypeError('You must override isNativeId.')
  }

  toNativeId (id) {
    return this.nativeIdType()(id)
  }

  nativeIdType () {
    throw new TypeError('You must override nativeIdType.')
  }

  driver () {
    throw new TypeError('You must override driver.')
  }
}
