const URIre = /^(http[s]?:\/\/)?([^/\s:#]+)?(:[0-9]+)?((?:\/?\w?)+(?:\/?[\w\-.]+[^#?\s])?)?(\??[^#?\s]+)?(#(?:\/?[\w\-$])*)?$/;

/**
 * @typedef {Object} UriComponents
 * @prop {?string} match - The full URI that matched the query.
 * @prop {?string} scheme - The protocol, either "http://" or "https://".
 * @prop {?string} domain - The domain and/or subdomain (eg, "api.example.com").
 * @prop {?string} port - The port if specified (eg, ":80").
 * @prop {?string} path - The relative directory path and/or file name (eg, "/foo/index.html").
 * @prop {?string} query - Search params (eg, "?foo=42&bar=36").
 * @prop {?string} fragment - The hash or JSON pointer (eg, "#Introduction", "#$defs/address").
 */

/**
 * Parses a URI into its component strings.
 * @param {string} uri
 * @returns {UriComponents}
 */
export default function parseURI(uri) {
  const groups = uri.match(URIre) || [];
  const [
    match, scheme, domain, port, path, query, fragment,
  ] = groups;
  return {
    match, scheme, domain, port, path, query, fragment,
  };
}
