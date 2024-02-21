var router = {};
router._version = "1.2";
router._routes = [];

// split the path and remove unnecessary segment
router._parse = function(raw) {
  return raw.split("/").map(function(i) {
    return i.trim();
  }).filter(function(i) {
    return i.length > 0;
  });
}

// add a route with a custom method
router.route = function(method, path, func) {
  router._routes.push({
    method, func,
    path: router._parse(path)
  });
}

// add a route with GET method
router.get = function(path, func) {
  router._routes.push({
    method: "GET", func,
    path: router._parse(path)
  });
}

// add a route with POST method
router.post = function(path, func) {
  router._routes.push({
    method: "POST", func,
    path: router._parse(path)
  });
}

// define the not found route
router.notfound = function(func) {
  router._nf = func;
}

router.export = function(req, res) {
  // implementation of request
  var xreq = {
    query: req.query,
    headers: req.headers,
    params: {},
    method: req.method,
    body: null,
    url: req.url,
    real: req,
    /* v1.2 */
    address: {
      remote: req.socket.remoteAddress,
      local: req.socket.localAddress
    },
    type: req.headers["content-type"],
    length: req.headers["content-length"],
    agent: req.headers["user-agent"],
    proxy: req.headers["x-forwarded-to"],
    hash: new URL("a://a.a/" + req.url).hash.slice(1),
    cookie: req.cookie.split(";").map(function(d) {
      var v = d.split("=");
      var k = v.shift();
      return [k, v.join("=")];
    }).filter(function(d) {
      return !["expires", "path"].includes(d[0]);
    })
  }
  // implementation of response
  var xres = {
    real: res,
    // set the header
    set(key, val) {
      this.real.setHeader(key, val);
    },
    // write the header for redirection and close the connection
    /* v1.2 modification: ispermanent */
    redirect(loc, ispermanent) {
      this.real.writeHead(ispermanent == true ? 301 : 302, {
        Location: loc
      });
      this.real.end();
    },
    // close the connection
    end(stat, text) {
      this.real.status(stat).send(text);
    },
    /* v1.2 */
    // refer to a specific route
    refer(path) {
      routes._routes.forEach(function())
    }
  }
  // check if the router is POST and the body is defined
  if(req.method == "POST" && req.body != null) {
    // if so, collect the chunks of data
    var cur = null;
    req.on("data", function(chunk) {
      if(cur == null) {
        // string compatible
        if(typeof chunk == "string") cur = chunk;
        // buffer compatible
        else cur = [chunk];
      } else {
        if(typeof chunk == "string") cur += chunk;
        else cur.push(chunk);
      }
    });
    req.on("end", function() {
      // define the body
      xreq.body = typeof cur == "string" ? cur : Buffer.concat(cur);
      process();
    });
  }
  // if not, skip the body
  else process();
  function process() {
    var unused = true;
    // loop each routes
    router._routes.forEach(function(route) {
      // if a route is used, skip all routes
      if(unused == false) return;
      var use = true;
      // parse the requested path excluding the hash and query
      var path = router._parse(new URL("a://a.a/" + res.url).pathname);
      // if the path and route path is both for home (/),
      // skip the criteria and use the route
      if(path.length == 0 && route.path.length == 0) {
        unused = false;
        return route.func(xreq, xres);
      }
      // if not the same method, skip the route
      if(req.method != route.method) use = false;
      // if not the same path length, skip the route
      else if(route.path.length != path.length) use = false;
      // check if the route contain dynamic path
      else if(route.path.join("/").includes(":")) {
        // check for each path segment
        path.forEach(function(segment, i) {
          // check if the segment is dynamic
          if(route.path[i].startsWith(":")) {
            // define the parameter
            xreq.params[route.path[i].slice(1)] = segment;
          }
          // if not, check if the segment is the same as the route segment
          // if not, skip the route
          else if(segment != route.path[i]) use = false;
        });
      } else if(use) {
        // check for each path segment
        path.forEach(function(segment, i) {
          // if a segment is not the same as the route segment, skip the route 
          if(segment != route.path[i]) use = false;
        });
      }
      // if the criteria is satisfied, use the route
      if(use) {
        unused = false;
        route.func(xreq, xres);
      }
    });
    // check if no route is used
    if(unused) {
      // if not found route is define, use it
      if(router._nf != null) router._nf(xreq, xres);
      else {
        // if not, throw the server-provided response
        xres.set("Content-Type", "text/plain");
        xres.end(404, "404 Not Found: Connection closed by the router");
      }
    }
  }
}

module.exports = router;