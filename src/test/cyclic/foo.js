'use strict'

import { Document } from '../../index'
import Bar from './bar'

export default class Foo extends Document {
  constructor () {
    super()

    this.bar = Bar
    this.num = Number
  }
}
