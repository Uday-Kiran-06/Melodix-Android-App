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
 * Handles string, array of objects, or single object inputs from various API versions
 */
export const sanitizeImageUrl = (images: any): string | null => {
  if (!images) return null;
  
  let url = '';
  if (Array.isArray(images)) {
    // Pick the last one (highest resolution)
    const last = images[images.length - 1];
    url = last?.link || last?.url || (typeof last === 'string' ? last : '');
  } else if (typeof images === 'string') {
    url = images;
  } else if (typeof images === 'object') {
    url = images.link || images.url || '';
  }

  if (!url || typeof url !== 'string') return null;

  // Cleanup: Support URLs that might have been partially decoded or have extra markers
  let sanitized = url.trim().replace('http:', 'https:');
  
  // Upgrade to high resolution if it's a known JioSaavn/CDN pattern
  if (sanitized.includes('150x150')) {
    sanitized = sanitized.replace('150x150', '500x500');
  } else if (sanitized.includes('50x50')) {
    sanitized = sanitized.replace('50x50', '500x500');
  }
  
  return sanitized;
};
