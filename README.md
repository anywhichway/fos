# fos v0.0.9a

Function Oriented Server: The easy way to expose JavaScript APIs to clients as micro-services.

FOS instances can also emulate Express or be used to augment existing Express or Koa apps.

# installation

`npm install fos`

# why

On the function orineted side, we wanted to be able to expose an already existing, well-defined, and well-understood API without having to create a whole new set of documentation, build volumes of unit tests, or run the risk of changing the API semantics during the mapping/wrapping process. In short, we wanted to be efficient for ourselves and others.

On the more route based middleware side, we also wanted to a server that designed to run in Service Worker or on a server from day one.

# usage

## FOS server

Just create a new server by passing in an object with the functions you wish to expose, allowed client IPs or domains, and a name. Then start start listening:

```javascript
const FOS = require("fos"),
  fos = new FOS({echo:arg => arg,upper:arg => arg.toUpperCase()},{allow:"*",name:"F"});
fos.listen(3000);
```

The functions can be asynchronus. The FOS will await their return prior to sending a result to the client.

If you want your FOS to also be a regular HTTP file server, then add a static route:

```javascript
fos.static("/");
```

The full signature for `static` is:

```javascript
static(path,{location="",defaultFile="index.html",mimeTypes={}}={})
```

`location` is relative to the start-up directory of your FOS.

`defaultFile` is the file to serve if only a root path is speficied.

`mimeTypes` are additional mimeTypes to support. To keep FOS small only `html` and `js` are built-in. The
surface of the object is `{<extension>:<mime-type>[,<extension>:<mime-type>...]}`.

## FOS Enabled Express or Koa App

If you want to use your existing Express or Koa apps as Function Oriented Servers, you can do this instead:

```
const express = require('express'),
fosify = require("../index.js").fosify,
	app = express();

fosify(app,{echo:arg => arg,upper:arg => arg.toUpperCase()},{allow:"*",name:"F"});
app.use(express.static(__dirname + "/"));
app.listen(3000, () => console.log("Express FOS listening on 3000"))
```

```
const Koa = require('koa'),
	fosify = require("../index.js").fosify,
	app = new Koa();

app.use(require('koa-static')(__dirname + "/"));
fosify(app,{echo:arg => arg,upper:arg => arg.toUpperCase()},{allow:"*",name:"F"});
app.listen(3000,() => console.log("Koa FOS listening on 3000"));
```

## browser

Define an HTML file, perhaps `index.html` that loads the exposed functions from the path `/fos` of the FOS. The exposed functions will have the same call signature as those on the server, except they will return Promises that resolve to the normal return values.

```html
<html>
<head>
<script src="http://localhost:3000/fos"></script>
</head>
<body>
<script>
F.echo("a").then(result => alert(result));
</script>
</body>
</html>
```

Load the file in your browser from another server, e.g. `http://localhost:8080/index.html`, or even as a file, e.g. `file:///C:/<path>/index.html`, or (if you have enabled your FOS for static files) `http://localhost:3000/index.html`.


# advanced usage

## un-named scripts and server to server communication

You can leave a script un-named and load it using fetch from the browser or another server and call it whatever you want:

```javascript
const FOS = require("fos"),
  fos = new FOS({echo:arg => arg,upper:arg => arg.toUpperCase()},{allow:"*"});
fos.listen(3000);
```

```javascript
var fos,
  fetch;
if(typeof(window)==="undefined") {
  fetch = require("fetch");
}
fetch("http://localhost:3000/fos").then(response => response.text()).then(text => Function("fos = " + text)());
```

## nested objects

You can pass in nested objects when creating the server and access them via their dot notation, e.g. `F.Math.sqr(2)`:

```javascript
new FOS({
  echo:arg => arg,
  Math: {
    sqr: value => value * value
  }
})
```

## method enhancements

You can pass in `before`, `after`, and `done` methods when creating the server in order to add security or specialized processing.

All the methods take a `Request` object as an argument option `request`. They also take a `ServerResponse` object as an argument option `response`.

### before: function({request,response})  { ... }

Called before the server function is invoked. If it sends headers (not just sets), then processing is aborted and the response is ended.

### after: function({request,response,result})  { ...; return result; }

Called after the server function is invoked. If it sends headers (not just sets), then processing is aborted and the response is ended. It can return the `result` passed in or a different/modified value that will be used as the response body.

### done: function({request,response})  { ... }

Called after the response has been sent.

## special values

FOS and the clients it generates will automatically handle serializing and deserializing values that can't normally be handled by JSON:

1) NaN

2) Infinity

3) -Infinity

4) undefined

## passing functions

A server can always pass functions back to clients; however, for security, functions passed to servers by clients are ignored unless the server is started with the option `functions:true`.

## setting options and headers

The primary object from which the client functions are accessed is actually a function itself. It can be called with an `options` object just like that used as the second argument for `fetch(url,options)` as [documented on MDN](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch). The return value can chain to any defined client function. After the call, the options are not cached.

```html
<html>
<head>
<script src="http://localhost:3000/fos"></script>
</head>
<body>
F({credentials:true}).echo("a").then(result => alert(result));
</body>
</html>
```

## emulating Express ... plus some extras

To emulate basic Express functionality, just use the Express API like you normally would:

```
const fos = new FOS({});
fos.use("/hello",(request,response) => response.end("hi!"));
fos.listen(3000);
```
You will then be able to load URLs directly in the browser from the FOS server, e.g. http://localhost:3000/hello, or request them using `request(<path>)`.

The following Express functions are supported on the server:

1) `get(key)` - identical to Express for properties, not supported for top level routing, except there are no special keys.

2) `set(key,value)` - identical to Express, except there are no special keys.

3) `param(paramName,callback)` - identical to Express.

4) `route(path)` - Identical to Express except `path` can also be a function taking the request object as an argument and returning `true` || `false`.

5) `use(pathOrCallback,...callbacks)` - identical to Express.

6) HTTP verb methods, e.g. `delete`, `get`, etc.

The `Request` object used by callbacks on the server goes beyond Express and is enhanced to support all the properties and methods available on a standards compliant URL as 
[documented on MDN](https://developer.mozilla.org/en-US/docs/Web/API/URL). This includes aliasing `pathname` to `path` and `searchParams` to `query`.

Note, the current release of FOS does not support the `acceptsXXX` methods, template engine functionality, or `mountpath` and the `use` method can’t take another middleware as an argument.


# release history (reverse chronological order)

2018-10-27 v0.0.9a ALPHA More static path fixes

2018-10-27 v0.0.8a ALPHA Static path fixes

2018-09-01 v0.0.7a ALPHA Documentation fixes

2018-08-29 v0.0.6a ALPHA Added support to `fosify` Express and Koa apps.

2018-08-28 v0.0.5a ALPHA Documentation updates

2018-08-28 v0.0.4a ALPHA Improved Express emulation. fos script now loaded from /fos not root. No longer necessary to add FOS.request to handler object; done automatically on the first call to `use` or `route`. Corrected Express emulation for root path, i.e. "/". Added static router.

2018-08-22 v0.0.3a ALPHA enhanced Express like functionality

2018-08-22 v0.0.2a ALPHA added Express like functionality

2018-08-22 v0.0.1a ALPHA first public release

