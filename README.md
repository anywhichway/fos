# fos v0.0.3a

Function Oriented Server: The easy way to expose JavaScript functions to clients as micro-services.

# installation

`npm install fos`

# usage

## server

Just create a new server by passing in an object with the functions you wish to expose, allowed client IPs or domains, and a name. Then start start listening:

```javascript
const FOS = require("fos"),
  fos = new FOS({echo:arg => arg,upper:arg => arg.toUpperCase()},{allow:"*",name:"F"});
fos.listen(3000);
```

The functions can be asynchronus. The FOS will await their return prior to sending a result to the client.

## browser

Define an HTML file that loads the exposed functions from the root of the FOS. The exposed functions will have the same call signature as those on the server,
except they will return Promises that resolve to the normal return values.

```html
<html>
<head>
<script src="http://localhost:3000/"></script>
</head>
<body>
F.echo("a").then(result => alert(result));
</body>
</html>
```

Load the file in your browser from another server, e.g. `http://localhost:8080/index.html`, or even as a file, e.g. `file:///C:/<path>/index.html`.

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
fetch("http://localhost:3000/").then(response => response.text()).then(text => Function("fos = " + text)());
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

You can pass in `before`, `after`, and `done` methods when creating the server in order to add security or specialized processing:

### before: function({request,response})  { ... }

Called before the server function is invoked. If it sends headers (not just sets), then processing is aborted and the response is ended.

### after: function({request,response,result})  { ...; return result; }

Called after the server function is invoked. If it sends headers (not just sets), then processing is aborted and the response is ended. 
It can return the `result` passed in or different/modified value that will be used as the response body.

### done: function({request,response})  { ... }

Called after the response has been sent.

## special values

FOS and the clients it generates will automatically handle serializing and deserializing values that can't normally be handled by JSON:

1) NaN

2) Infinity

3) -Infinity

4) undefined

## passing functions

A server can always pass functions back to clients; however, for security, functions passed to servers by clients are ignored unless the server
is started with the option `functions:true`.

## setting options and headers

The primary object from which the client functions are accessed is actually a function itself. It can be called with an `options` object just like
that used as the second argument for `fetch(url,options)` as [documented on MDN](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch). The return value can chain to any defined client function. After the call, the options
are not cached.

```html
<html>
<head>
<script src="http://localhost:3000/"></script>
</head>
<body>
F({credentials:true}).echo("a").then(result => alert(result));
</body>
</html>
```

## simulating Express ... plus some extras

To simulate basic Express functionality, just add the static function `FOS.request` to your handler object and then add middleware like you normally would:

```
const fos = new FOS({request:FOS.request});
fos.use("/hello",(request,response) => response.end("hi!"));
fos.listen(3000);
```
You will then be able to load URLs directly in the browser from the FOS server, e.g. http://localhost:3000/hello, or request them using `request(<path>)`.

The following Express functions are supported:

1) `get(key)` - identical to Express, except there are no special keys.

2) `set(key,value)` - identical to Express, except there are no special keys.

3) `param(paramName,callback)` - identical to Express.

4) `route(path)` - `path` can also be a function taking the request object as an argument and returning `true` || `false`. Or it can be a RegExp.

5) `use(pathOrCallback,...callbacks)` - identical to Express.


# release history (reverse chronological order)

2018-08-22 v0.0.3a enhanced Express like functionality

2018-08-22 v0.0.2a added Express like functionality

2018-08-22 v0.0.1a first public release

