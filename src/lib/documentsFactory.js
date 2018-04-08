import getBaseDocument from './base-document'
import getValidators from './validate'
import getEmbeddedDocument from './embedded-document'
import getDocument from './document'

/**
 * @param {DatabaseClient} client
 * @param {Object} migrations
 * @return {{validators: {isString, isNumber, isBoolean, isDate, isBuffer, isObject, isArray, isDocument, isEmbeddedDocument, isReferenceable, isNativeId, isSupportedType, isType, isValidType, isInChoices, isEmptyValue}, BaseDocument: BaseDocument, Document: Document, EmbeddedDocument: EmbeddedDocument}}
 * @constructor
 */
export const DocumentsFactory = (client, migrations) => {
  const validators = getValidators({client})
  const BaseDocument = getBaseDocument({client, validators})
  const Document = getDocument({BaseDocument, client, validators, migrations})
  const EmbeddedDocument = getEmbeddedDocument({BaseDocument, client, validators})

  return {
    client,
    validators,
    BaseDocument,
    Document,
    EmbeddedDocument
  }
}
