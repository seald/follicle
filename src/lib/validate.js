export const isString = s => typeof s === 'string'
export const isNumber = n => typeof n === 'number' && isFinite(n)
export const isBoolean = b => b === true || b === false
export const isDate = d => isNumber(d) || d instanceof Date || isNumber(Date.parse(d))
export const isBuffer = b => typeof b === 'object' || b instanceof Buffer
export const isObject = o => typeof o === 'object' && o != null
export const isArray = a => Array.isArray(a)
export const isDocument = m => m && m.documentClass && m.documentClass() === 'document'
export const isEmbeddedDocument = e => e && e.documentClass && e.documentClass() === 'embedded'
export const isSupportedType = t => (t === String || t === Number || t === Boolean ||
  t === Buffer || t === Date || t === Array ||
  isArray(t) || t === Object || t instanceof Object ||
  typeof (t.documentClass) === 'function')
export const isInChoices = (choices, choice) => {
  if (!choices) return true
  return choices.indexOf(choice) > -1
}
export const isEmptyValue = value =>
  value == null ||
  (value === '') ||
  (!(typeof value === 'number' || value instanceof Date || typeof value === 'boolean' || typeof value === 'string') && (Object.keys(value).length === 0))

export default ({ client }) => {
  const isNativeId = n => client.isNativeId(n)
  const isReferenceable = r => isDocument(r) || isNativeId(r)
  const isType = (value, type) => {
    if (type === String) return isString(value)
    else if (type === Number) return isNumber(value)
    else if (type === Boolean) return isBoolean(value)
    else if (type === Buffer) return isBuffer(value)
    else if (type === Date) return isDate(value)
    else if (type === Array || isArray(type)) return isArray(value)
    else if (type === Object) return isObject(value)
    else if (type.documentClass && type.documentClass() === 'document') return isDocument(value) || client.isNativeId(value)
    else if (type.documentClass && type.documentClass() === 'embedded') return isEmbeddedDocument(value)
    else if (type === client.nativeIdType()) return isNativeId(value)
    else throw new Error(`Unsupported type: ${type.name}`)
  }

  const isValidType = (value, type) => {
    // NOTE
    // Maybe look at this:
    // https://github.com/Automattic/mongoose/tree/master/lib/types

    // TODO: For now, null is okay for all types. May
    // want to specify in schema using 'nullable'?
    if (value === null) return true

    // Issue #9: To avoid all model members being stored
    // in DB, allow undefined to be assigned. If you want
    // unassigned members in DB, use null.
    if (value === undefined) return true

    // Arrays take a bit more work
    if (type === Array || isArray(type)) {
      // Validation for types of the form [String], [Number], etc
      if (isArray(type) && type.length > 1) throw new Error('Unsupported type. Only one type can be specified in arrays, but multiple found:', +type)

      if (isArray(type) && type.length === 1 && isArray(value)) {
        const arrayType = type[0]
        for (let i = 0; i < value.length; i++) {
          const v = value[i]
          if (!isType(v, arrayType)) return false
        }
      } else if (isArray(type) && type.length === 0 && !isArray(value)) return false
      else if (type === Array && !isArray(value)) return false

      return true
    }

    return isType(value, type)
  }

  return {
    isString,
    isNumber,
    isBoolean,
    isDate,
    isBuffer,
    isObject,
    isArray,
    isDocument,
    isEmbeddedDocument,
    isReferenceable,
    isNativeId,
    isSupportedType,
    isType,
    isValidType,
    isInChoices,
    isEmptyValue
  }
}
