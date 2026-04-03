/**
 * Decodes HTML entities in a string (e.g., &quot; to ")
 */
export const decodeHtml = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&nbsp;/g, ' ');
};

/**
 * Ensures image URLs are high quality and secure (https)
 */
export const sanitizeImageUrl = (images: any): string | null => {
  if (!images) return null;
  
  let url = '';
  if (Array.isArray(images)) {
    // Pick the last one (highest resolution)
    url = images[images.length - 1]?.link || images[images.length - 1]?.url || '';
  } else if (typeof images === 'string') {
    url = images;
  } else if (typeof images === 'object') {
    url = images.link || images.url || '';
  }

  if (!url) return null;

  // Upgrade to HTTPS and high res if it's a JioSaavn link
  let sanitized = url.replace('http:', 'https:');
  if (sanitized.includes('150x150')) {
    sanitized = sanitized.replace('150x150', '500x500');
  }
  
  return sanitized;
};
