'use strict'

import { connect } from './lib/db'
import Document from './lib/document'
import EmbeddedDocument from './lib/embedded-document'

exports.connect = connect
exports.getClient = require('./lib/clients').getClient

exports.Document = Document
exports.EmbeddedDocument = EmbeddedDocument
