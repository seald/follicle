'use strict'

export default Document => class Data extends Document {
  constructor () {
    super()

    this.schema({
      number: {
        type: Number
      },
      source: {
        type: String,
        choices: ['reddit', 'hacker-news', 'wired', 'arstechnica'],
        default: 'reddit'
      },
      item: {
        type: Number,
        min: 0,
        max: 100
      },
      values: {
        type: [Number]
      },
      date: {
        type: Date,
        default: Date.now
      }
    })
  }
}

export const getMigratedDataModel = Document => class Data extends Document {
  constructor () {
    super()

    this.schema({
      number: {
        type: Number
      },
      source: {
        type: String,
        choices: ['redit', 'hacker-news', 'wired', 'arstechnica'],
        default: 'redit'
      },
      fluffykin: { // renaming model field item to fluffykin
        type: Number,
        min: 0,
        max: 100
      },
      values: {
        type: [Number]
      },
      date: {
        type: Date,
        default: Date.now
      }
    })
  }
}
