'use strict'

import { Document } from '../../index'
import Foo from './foo'

export default class Bar extends Document {
  constructor () {
    super()

    this.foo = Foo
    this.num = Number
  }
}
