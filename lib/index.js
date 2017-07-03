var $ = require('jquery')
var Backbone = require('backbone')
var Mastodon = require('mastodon-api')
var PouchDB = require('pouchdb')
var Handlebars = require('handlebars')

/*
CONSTANTS
 */

const APP_NAME = 'nerdpanel'

/*
TEMPLATES
 */

const TEMPLATE_NAMES = [
  'signin-form',
  'toot-search',
  'toot-list',
  'toot-show'
]
const TEMPLATES = collectTemplates(TEMPLATE_NAMES)

function collectTemplates (names) {
  var templates = {}
  names.forEach(function (name) {
    var src = $('#' + name + '-template').text()
    templates[name] = Handlebars.compile(src)
  })
  return templates
}

/*
MAIN
- Runs once page loads
 */

function main () {
  const APP = $('#app')
  const TEMPLATES = collectTemplates(TEMPLATE_NAMES)
  var form = TEMPLATES['signin-form']({})
  APP.html(form)
}

$(main)