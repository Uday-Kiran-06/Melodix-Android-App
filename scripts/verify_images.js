const jioSaavnService = {
    sanitizeImageUrl: (images, quality = '500x500') => {
        if (!images) return null;
        let url = "";
        try {
            if (Array.isArray(images) && images.length > 0) {
                const match = images.find(img => img && typeof img === 'object' && img.quality === quality);
                url = match?.url || images[images.length - 1]?.url || images[0]?.url || "";
            } else if (typeof images === 'object' && images !== null) {
                url = images.url || images.uri || "";
            } else if (typeof images === 'string') {
                url = images;
            }
        } catch (e) {
            return null;
        }
        if (!url || typeof url !== 'string' || url === "null" || url === "undefined" || url.trim() === "") return null;
        let sanitized = url.replace("http://", "https://")
            .replace(/50x50/g, "500x500")
            .replace(/150x150/g, "500x500");
        if (sanitized.includes('default_album.png') || sanitized.includes('default_artist.png')) {
            return null;
        }
        return sanitized;
    }
};

const testCases = [
    { name: "Null Input", input: null, expected: null },
    { name: "Undefined Input", input: undefined, expected: null },
    { name: "Empty String", input: "", expected: null },
    { name: "Saavn Array (Match)", input: [{ quality: '500x500', url: 'http://test.com/50x50' }], expected: 'https://test.com/500x500' },
    { name: "Saavn Array (No Match)", input: [{ quality: '50x50', url: 'http://test.com/50x50' }], expected: 'https://test.com/500x500' },
    { name: "Saavn Object", input: { url: 'http://test.com/150x150' }, expected: 'https://test.com/500x500' },
    { name: "Plain URL", input: 'http://test.com/image.jpg', expected: 'https://test.com/image.jpg' },
    { name: "Placeholder Image", input: 'https://c.saavncdn.com/default_album.png', expected: null },
    { name: "Invalid String 'null'", input: 'null', expected: null },
];

console.log("Running jioSaavnService.sanitizeImageUrl Tests:");
testCases.forEach(tc => {
    const result = jioSaavnService.sanitizeImageUrl(tc.input);
    const pass = result === tc.expected;
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${tc.name}: Expected ${tc.expected}, Got ${result}`);
});
