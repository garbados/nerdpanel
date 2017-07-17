# nerdpanel

A static site for examining your toots. A nerdy lil vanity~

The app provides full-text search for toots, and allows sorting toots by interactions.

This app is currently a proof of concept. See the [issues](https://github.com/garbados/nerdpanel/issues) page to learn about upcoming enhancements, to file a bug report, or to request a feature.

## Usage

You can use the nerdpanel app on [garbados.github.io](https://garbados.github.io/nerdpanel) or you can build it yourself and use it locally, or deploy it wherever on the web.

## Install

Use [git](https://git-scm.com) and [npm](https://www.npmjs.com) to install the panel and build it.

```bash
git clone git@github.com:garbados/nerdpanel.git
cd nerdpanel
npm install
npm run build
```

Running `npm run build` will build the website to the `build/` folder. You can serve that folder as a static site.

You can also run `npm start` which will build the app and serve it at `http://localhost:8000`.

## Testing

To run the test suite, do:

```bash
npm test
```

For development, you can use `npm run watch` to watch changes to the `lib/` and `static/` folders.

## Contributing

Every little bit helps! If you find a bug, please file an issue. If you fix a bug, please file a pull request. Thank you!

## Addendum

I believe in you!

## License

[GPL-3.0](https://www.gnu.org/licenses/gpl-3.0.en.html)
