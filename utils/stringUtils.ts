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

/**
 * Normalizes a song or track title for robust deduplication.
 * Strips HTML entities, brackets, movie tags (From ...), lyrical/video/remix indicators,
 * and punctuation, returning a canonical lowercase string.
 */
export const normalizeTrackTitle = (title: string | undefined | null): string => {
  if (!title) return '';
  let cleaned = decodeHtml(title).toLowerCase();

  // Remove common parenthetical and bracketed suffixes (e.g., "(From Movie)", "[Lyrical Video]", "(Remix)")
  cleaned = cleaned
    .replace(/\((?:from|feat\.?|featuring|with|lyrical|video|full video|audio|official|original|remix|slowed|reverb|version|album version|soundtrack|ost|deluxe|bonus|re-issue|telugu|hindi|tamil|kannada|malayalam|punjabi|english)[^)]*\)/gi, '')
    .replace(/\[(?:from|feat\.?|featuring|with|lyrical|video|full video|audio|official|original|remix|slowed|reverb|version|album version|soundtrack|ost|deluxe|bonus|re-issue|telugu|hindi|tamil|kannada|malayalam|punjabi|english)[^\]]*\]/gi, '')
    .replace(/\s*-\s*(?:from|lyrical|video|full video|audio|official|original|remix|slowed|reverb|version|telugu|hindi|tamil|kannada|malayalam|punjabi|english|single|soundtrack)[^-\n]*$/gi, '');

  // Strip generic (From ...) or [From ...] remnants
  cleaned = cleaned
    .replace(/\(from.*?\)/gi, '')
    .replace(/\[from.*?\]/gi, '');

  // Remove punctuation and special symbols, keeping unicode letters and numbers for Telugu, Hindi, English, etc.
  cleaned = cleaned.replace(/[^\p{L}\p{N}\s]/gu, '');

  // Normalize whitespace
  return cleaned.replace(/\s+/g, ' ').trim();
};

/**
 * Normalizes an artist name for comparison.
 */
export const normalizeArtistName = (artist: string | undefined | null): string => {
  if (!artist) return '';
  const decoded = decodeHtml(artist).toLowerCase();
  // Take primary artist if comma-separated
  const primary = decoded.split(/[,&/|]/)[0] || '';
  return primary.replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
};

