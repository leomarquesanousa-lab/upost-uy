import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export const mediaPattern = /^\/media\/[a-f0-9-]{36}\.webp$/;
export function renderBody(markdown) {
  return sanitizeHtml(marked.parse(markdown, { async: false, breaks: true }), {
    allowedTags: ['p','br','h2','h3','h4','strong','em','a','ul','ol','li','blockquote','hr','img','code','pre'],
    allowedAttributes: { a: ['href','title','rel'], img: ['src','alt','title','loading'] },
    allowedSchemes: ['https','http','mailto'],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attrs) => ({ tagName, attribs: { ...attrs, rel: 'noopener noreferrer' } }),
      img: (tagName, attrs) => ({ tagName, attribs: { ...attrs, loading: 'lazy' } }),
    },
    exclusiveFilter: frame => frame.tag === 'img' && !mediaPattern.test(frame.attribs.src || ''),
  });
}
export function plainText(markdown) {
  return sanitizeHtml(renderBody(markdown), { allowedTags: [], allowedAttributes: {} }).trim();
}

// Check the images actually rendered, including Markdown reference-style images.
export function renderedImagePaths(markdown) {
  return [...new Set([...renderBody(markdown).matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map(match => match[1]))];
}
