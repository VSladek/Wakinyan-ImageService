export class UrlHelper {
  /**
   * Parse a URL string into components without using URL constructor
   */
  static parseUrl(urlString: string): {
    protocol: string
    hostname: string
    port: string
    pathname: string
    search: string
    hash: string
  } {
    const result = {
      protocol: "",
      hostname: "",
      port: "",
      pathname: "",
      search: "",
      hash: "",
    }

    try {
      // Extract protocol
      if (urlString.includes("://")) {
        const protocolMatch = urlString.match(/^([^:]+):\/\//)
        if (protocolMatch) {
          result.protocol = protocolMatch[1]
          urlString = urlString.substring(protocolMatch[0].length)
        }
      }

      // Extract hash
      const hashIndex = urlString.indexOf("#")
      if (hashIndex !== -1) {
        result.hash = urlString.substring(hashIndex + 1)
        urlString = urlString.substring(0, hashIndex)
      }

      // Extract search params
      const searchIndex = urlString.indexOf("?")
      if (searchIndex !== -1) {
        result.search = urlString.substring(searchIndex + 1)
        urlString = urlString.substring(0, searchIndex)
      }

      // Extract hostname, port, and pathname
      const pathIndex = urlString.indexOf("/")
      if (pathIndex !== -1) {
        result.pathname = urlString.substring(pathIndex)
        urlString = urlString.substring(0, pathIndex)
      } else {
        result.pathname = "/"
      }

      // Extract hostname and port
      if (urlString.includes(":")) {
        const parts = urlString.split(":")
        result.hostname = parts[0]
        result.port = parts[1]
      } else {
        result.hostname = urlString
      }
    } catch (error) {
      console.warn("URL parsing failed:", error)
    }

    return result
  }

  /**
   * Build a URL from components
   */
  static buildUrl(components: {
    protocol?: string
    hostname?: string
    port?: string
    pathname?: string
    search?: string
    hash?: string
  }): string {
    let url = ""

    if (components.protocol) {
      url += `${components.protocol}://`
    }

    if (components.hostname) {
      url += components.hostname
    }

    if (components.port) {
      url += `:${components.port}`
    }

    if (components.pathname) {
      url += components.pathname.startsWith("/") ? components.pathname : `/${components.pathname}`
    }

    if (components.search) {
      url += `?${components.search}`
    }

    if (components.hash) {
      url += `#${components.hash}`
    }

    return url
  }

  /**
   * Join URL paths safely
   */
  static joinPaths(base: string, ...paths: string[]): string {
    let result = base.endsWith("/") ? base.slice(0, -1) : base

    for (const path of paths) {
      if (path) {
        const cleanPath = path.startsWith("/") ? path : `/${path}`
        result += cleanPath
      }
    }

    return result
  }

  /**
   * Validate if string is a valid URL format
   */
  static isValidUrl(urlString: string): boolean {
    try {
      return urlString.startsWith("http://") || urlString.startsWith("https://")
    } catch {
      return false
    }
  }

  /**
   * Extract query parameters from URL string
   */
  static getQueryParams(urlString: string): Record<string, string> {
    const params: Record<string, string> = {}

    try {
      const searchIndex = urlString.indexOf("?")
      if (searchIndex === -1) return params

      const queryString = urlString.substring(searchIndex + 1)
      const hashIndex = queryString.indexOf("#")
      const cleanQuery = hashIndex !== -1 ? queryString.substring(0, hashIndex) : queryString

      const pairs = cleanQuery.split("&")
      for (const pair of pairs) {
        const [key, value] = pair.split("=")
        if (key) {
          params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : ""
        }
      }
    } catch (error) {
      console.warn("Query param parsing failed:", error)
    }

    return params
  }

  /**
   * Add query parameters to URL
   */
  static addQueryParams(urlString: string, params: Record<string, string>): string {
    try {
      const hasQuery = urlString.includes("?")
      const separator = hasQuery ? "&" : "?"

      const queryPairs = Object.entries(params)
        .filter(([key, value]) => key && value !== undefined && value !== null)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)

      if (queryPairs.length === 0) return urlString

      return `${urlString}${separator}${queryPairs.join("&")}`
    } catch (error) {
      console.warn("Adding query params failed:", error)
      return urlString
    }
  }
}
