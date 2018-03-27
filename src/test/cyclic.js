'use strict'

export default Document => {
  class Foo extends Document {
    constructor () {
      super()

      this.bar = Bar
      this.num = Number
    }
  }

  class Bar extends Document {
    constructor () {
      super()

      this.foo = Foo
      this.num = Number
    }
  }

  return {
    Foo,
    Bar
  }
}
