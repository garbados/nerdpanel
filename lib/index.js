/* global location, emit */
const $ = require('jquery')
const _ = require('underscore')
const Backbone = require('backbone')
const Mastodon = require('mastodon')
const OAuth2 = require('oauth').OAuth2
const PouchDB = require('pouchdb')
PouchDB.plugin(require('pouchdb-quick-search'))

const APP_NAME = 'nerdpanel'

/*
DATABASES
 */

const TOOT_DB = new PouchDB([APP_NAME, 'toots'].join('-'))
const USER_DB = new PouchDB([APP_NAME, 'users'].join('-'))
const ACCT_DB = new PouchDB([APP_NAME, 'accounts'].join('-'))

const DDOC = {
  _id: ['_design', APP_NAME].join('/'),
  views: {
    highestId: {
      map: function (doc) {
        if (doc.type === 'toot') {
          emit(doc.id, doc.id)
        }
      }.toString(),
      reduce: '_stats'
    },
    sortByDate: {
      map: function (doc) {
        if (doc.type === 'toot') {
          emit(doc.created_at, null)
        }
      }.toString()
    },
    sortByBoosts: {
      map: function (doc) {
        if (doc.type === 'toot') {
          emit([doc.reblogs_count, doc.favourites_count, doc.created_at], null)
        }
      }.toString()
    },
    sortByFavs: {
      map: function (doc) {
        if (doc.type === 'toot') {
          emit([doc.favourites_count, doc.reblogs_count, doc.created_at], null)
        }
      }.toString()
    }
  }
}

function setupIndexes () {
  return TOOT_DB.put(DDOC)
    .catch(err => {
      // swallow conflict errors because they reflect that the indexes have already been built
      if (err.name !== 'conflict') throw err
    })
}

/*
VIEWS
 */

const NerdView = Backbone.View.extend({
  el: '#app',
  render: function () {
    this.$el.html(this.template())
    return this
  }
})

const TootSigninView = NerdView.extend({
  template: _.template($('#signin-form-template').text()),
  events: {
    'submit': 'signin',
    'click .btn-signin': 'signin'
  },
  signin: function (event) {
    event.preventDefault()
    var url = this.$('#mastodon-url')[0].value
    var req = $.ajax({
      type: 'post',
      url: url + '/api/v1/apps',
      data: {
        client_name: APP_NAME,
        redirect_uris: location.origin + location.pathname,
        scopes: 'read'
      }
    })
    req.done((data, status) => {
      var oauth = new OAuth2(data.client_id, data.client_secret, url, null, '/oauth/token')
      var authUrl = oauth.getAuthorizeUrl({
        redirect_uri: data.redirect_uri,
        response_type: 'code',
        scope: 'read'
      })
      // create the user
      USER_DB.put({ _id: 'user', instance: url, client_id: data.client_id, client_secret: data.client_secret })
        .then((res) => {
          // redirect the user
          window.location.href = authUrl
        })
    })
  }
})

// use sinceId by default.
// if no sinceId, set it to 0, start at the beginning.
// don't decide whether to go forward or backward.
// just start at the beginning!

const TootDownloadView = NerdView.extend({
  download: function (M, accountId, opts) {
    const LIMIT = 40
    return new Promise((resolve, reject) => {
      opts = opts || {}
      opts.exclude_replies = true
      opts.limit = LIMIT
      M.get('accounts/' + accountId + '/statuses', opts, (err, statuses) => {
        if (err) {
          reject(err)
        } else if (statuses.length === 0) {
          // no toots
          resolve()
        } else {
          // add statuses to database
          var docs = statuses.filter(status => {
            // filter out reblogs
            return !status.reblog
          }).map(status => {
            status._id = String(status.id)
            status.type = 'toot'
            return status
          })
          var statusIds = statuses.map(s => { return s.id })
          // update opts to grab the next page
          if (opts.since_id) {
            opts.since_id = statusIds.reduce((a, b) => { return Math.max(a, b) })
          } else {
            opts.max_id = statusIds.reduce((a, b) => { return Math.min(a, b) })
          }
          TOOT_DB.bulkDocs(docs)
            .then(result => {
              // download the next batch
              if (statuses.length === LIMIT) {
                resolve(this.download(M, accountId, opts))
              } else {
                resolve()
              }
            })
            .catch(reject)
        }
      })
    })
  },
  initialize: function (opts) {
    this.M = new Mastodon({
      access_token: this.model.access_token,
      api_url: this.model.instance + '/api/v1/'
    })
    this.M.get('accounts/verify_credentials', (err, account) => {
      if (err) throw err
      account._id = 'account'
      account.type = 'account'
      ACCT_DB.put(account)
        .catch(err => {
          // account already exists
          if (err.status === 409) {
            // retrieve highest toot id
            return TOOT_DB.query([APP_NAME, 'highestId'].join('/'), { reduce: true })
              .then(result => {
                var lastItem = result.rows.slice(-1)[0]
                if (lastItem) {
                  return lastItem.value.max
                }
              })
          } else {
            throw err
          }
        })
        .then(sinceId => {
          if ((typeof sinceId === 'number') && !isNaN(sinceId)) {
            return this.download(this.M, account.id, { since_id: sinceId })
          } else {
            return this.download(this.M, account.id)
          }
        })
        .then(result => {
          Backbone.history.navigate('list', { trigger: true })
        })
    })
  },
  template: _.template($('#toot-download-template').text())
})

const QueryFormView = Backbone.View.extend({
  template: _.template($('#toot-show-template').text()),
  setup: function (opts) {
    this.el = '#toots'
    this.$el = $(this.el)
    this.opts = opts || {}
    this.opts.include_docs = this.opts.include_docs || true
    this.opts.limit = this.opts.limit || 10
  },
  query: function () {
    throw new Error('NOT IMPLEMENTED')
  },
  nextPage: function (event) {
    throw new Error('NOT IMPLEMENTED')
  },
  addToot: function (toot) {
    this.$el.append(this.template(toot))
    return this
  },
  addToots: function (toots) {
    return toots.map(toot => { this.addToot(toot) })
  },
  addRows: function (rows) {
    var toots = rows.map(row => { return row.doc })
    return this.addToots(toots)
  },
  clear: function () {
    this.$el.html('')
  }
})

const SortedTootsView = QueryFormView.extend({
  initialize: function (index, opts) {
    this.setup(opts)
    this.opts.descending = true
    this.index = index
  },
  nextPage: function (event) {
    if (event) event.preventDefault()
    return this.query().then(result => {
      var lastKey = result.rows.slice(-1)[0].key
      this.opts.startkey = lastKey.slice(0, -1)
      this.addRows(result.rows)
    })
  },
  query: function () {
    var viewName = [APP_NAME, this.index].join('/')
    return TOOT_DB.query(viewName, this.opts)
  }
})

const SearchTootsView = QueryFormView.extend({
  initialize: function (query, opts) {
    this.setup(opts)
    this.opts.fields = ['content', 'spoiler_text']
    this.opts.query = query
  },
  nextPage: function (event) {
    if (event) event.preventDefault()
    return this.query().then(result => {
      this.opts.skip += result.rows.length
      this.addRows(result.rows)
    })
  },
  query: function (query, skip) {
    return TOOT_DB.search(this.opts)
  }
})

const TootListView = NerdView.extend({
  events: {
    'submit #searchForm': 'submitSearch',
    'submit #sortForm': 'submitSort',
    'submit #nextPage': 'getNextPage'
  },
  template: _.template($('#toot-list-template').text()),
  submitSearch: function (event) {
    event.preventDefault()
    var query = event.currentTarget.elements[0].value
    return this.search(query)
  },
  submitSort: function (event) {
    event.preventDefault()
    var index = event.currentTarget.elements[0].value
    return this.sort(index)
  },
  getNextPage: function (event) {
    event.preventDefault()
    return this.view.nextPage()
  },
  search: function (index) {
    this.view = new SearchTootsView(index)
    this.view.clear()
    return this.view.nextPage()
  },
  sort: function (query) {
    this.view = new SortedTootsView(query)
    this.view.clear()
    return this.view.nextPage()
  },
  render: function (title, toots) {
    this.$el.html(this.template())
    this.sort('sortByDate')
    return this
  }
})

const TootRefreshView = NerdView.extend({
  initialize: function () {
    TOOT_DB
      .destroy()
      .then(() => {
        Backbone.history.navigate('download')
        window.location.reload(false)
      })
  },
  template: _.template($('#toot-refresh-template').text())
})

const LogoutView = NerdView.extend({
  initialize: function () {
    Promise.all([
      TOOT_DB.destroy(),
      USER_DB.destroy(),
      ACCT_DB.destroy()
    ])
    .then(() => {
      Backbone.history.navigate('')
      window.location.reload(false)
    })
  },
  template: _.template($('#logout-template').text())
})

/*
ROUTER
 */

const Router = Backbone.Router.extend({
  routes: {
    '': 'home',
    'download': 'download',
    'list': 'list',
    'logout': 'logout',
    'refresh': 'refresh',
    'signin': 'signin'
  },
  home: function () {
    // get user or redirect to signin
    USER_DB.get('user')
      // check if user already exists
      .then((user) => {
        if (!user.access_token) throw new Error('access_token not set')
        return user
      })
      .catch((err) => {
        // not found / lacking access token
        // check the query params for the code
        var hasCode = (location.href.indexOf('code') > -1)
        if (err.name === 'not_found') {
          return null
        } else if (hasCode) {
          var i = location.href.indexOf('?')
          var code = location.href.slice(i + 1).split('&')
            .filter(function (val) {
              return val.match(/^code=/)
            })[0].split('=')[1]
          // convert code to access token
          return USER_DB.get('user')
            .then((user) => {
              var oauth = new OAuth2(user.client_id, user.client_secret, user.instance, null, '/oauth/token')
              return new Promise((resolve, reject) => {
                oauth.getOAuthAccessToken(code, {
                  grant_type: 'authorization_code',
                  redirect_uri: location.origin + location.pathname
                }, function (err, accessToken, refreshToken, res) {
                  if (err) {
                    reject(err)
                  } else {
                    user.access_token = accessToken
                    resolve(USER_DB.put(user))
                  }
                })
              })
            })
        }
      })
      .then((user) => {
        if (user) {
          this.navigate('download', { trigger: true })
        } else {
          this.navigate('signin', { trigger: true })
        }
      })
  },
  download: function () {
    USER_DB.get('user')
      .catch(() => {
        // TODO handle err
        this.navigate('home', { trigger: true })
      })
      .then(user => {
        var view = new TootDownloadView({
          model: user
        })
        view.render()
      })
  },
  signin: function () {
    var view = new TootSigninView()
    view.render()
  },
  list: function () {
    var view = new TootListView()
    view.render()
  },
  logout: function () {
    var view = new LogoutView()
    view.render()
  },
  refresh: function () {
    var view = new TootRefreshView()
    view.render()
  }
})

/*
MAIN
- Runs once page loads
 */

function main () {
  // build indexes / ensure they're built
  setupIndexes()
    .then(result => {
      new Router()
      Backbone.history.start()
    })
}

$(main)
