const fs = require('fs');
const path = require('path');

/**
 * Sitemap Generator Utility
 * Implements dynamic sitemap generation for SEO optimization
 */
class SitemapGenerator {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.urls = [];
  }

  /**
   * Add a URL to the sitemap
   * @param {string} loc - URL location
   * @param {string} lastmod - Last modification date (YYYY-MM-DD)
   * @param {string} changefreq - How frequently the page changes (always/hourly/daily/weekly/monthly/yearly/never)
   * @param {number} priority - Priority of this URL relative to other URLs (0.0 to 1.0)
   */
  addURL(loc, lastmod = null, changefreq = 'weekly', priority = 0.8, alternates = null) {
    this.urls.push({
      loc: `${this.baseURL}${loc}`,
      lastmod,
      changefreq,
      priority,
      // Optional [{ hreflang, href }] for localized alternates (hreflang cluster).
      alternates: Array.isArray(alternates) ? alternates : null,
    });
  }

  /**
   * Generate the sitemap XML string
   * @returns {string} XML sitemap
   */
  generateSitemap() {
    let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
    sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
    sitemap += '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';

    this.urls.forEach(url => {
      sitemap += '  <url>\n';
      sitemap += `    <loc>${this.escapeXml(url.loc)}</loc>\n`;

      if (url.lastmod) {
        sitemap += `    <lastmod>${url.lastmod}</lastmod>\n`;
      }

      sitemap += `    <changefreq>${url.changefreq}</changefreq>\n`;
      sitemap += `    <priority>${url.priority}</priority>\n`;
      if (url.alternates) {
        url.alternates.forEach(alt => {
          sitemap += `    <xhtml:link rel="alternate" hreflang="${this.escapeXml(alt.hreflang)}" href="${this.escapeXml(alt.href)}" />\n`;
        });
      }
      sitemap += '  </url>\n';
    });

    sitemap += '</urlset>';
    return sitemap;
  }

  /**
   * Escape XML special characters
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  escapeXml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Save the sitemap to a file
   * @param {string} filePath - Path to save the sitemap
   */
  saveToFile(filePath) {
    const sitemap = this.generateSitemap();
    fs.writeFileSync(filePath, sitemap, 'utf8');
  }

  /**
   * Generate sitemap for the entire site
   * @returns {string} Complete sitemap XML
   */
  generateCompleteSitemap() {
    // Add main pages
    this.addURL('/', null, 'daily', 1.0);
    this.addURL('/search', null, 'daily', 0.9);
    this.addURL('/about', null, 'weekly', 0.7);
    this.addURL('/contact', null, 'weekly', 0.7);
    this.addURL('/privacy', null, 'monthly', 0.6);
    this.addURL('/terms', null, 'monthly', 0.6);
    
    // Add dynamic content pages if needed
    // These would be added programmatically based on actual content
    
    return this.generateSitemap();
  }
}

module.exports = SitemapGenerator;