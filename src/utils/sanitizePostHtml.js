"use strict";

const sanitizeHtml = require("sanitize-html");

const options = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "s",
    "h1",
    "h2",
    "h3",
    "h4",
    "ul",
    "ol",
    "li",
    "blockquote",
    "code",
    "pre",
    "a",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  transformTags: {
    a: (_tagName, attributes) => {
      const result = {};
      if (attributes.href) result.href = attributes.href;
      if (attributes.target === "_blank") {
        result.target = "_blank";
        result.rel = "noopener noreferrer";
      }
      return { tagName: "a", attribs: result };
    },
  },
};

function sanitizePostHtml(value) {
  return sanitizeHtml(String(value || ""), options);
}

module.exports = { sanitizePostHtml };
