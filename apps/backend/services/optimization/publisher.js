/**
 * Publisher — writes a finished post into the three static files that make it
 * crawlable once Cloudflare Pages rebuilds:
 *   1. apps/frontend/src/content/blogPosts.jsx  (auto-wires the SPA route,
 *      the prerendered /blog/<slug>/index.html, and the /blog index entry)
 *   2. apps/frontend/public/sitemap.xml          (search-engine discovery)
 *   3. apps/frontend/public/llms.txt             (AI-crawler discovery)
 *
 * Fails loud: if an expected anchor is missing it throws rather than risk
 * corrupting a source file. dryRun returns the rendered fragments without
 * touching disk.
 */

const fs = require('fs');
const config = require('./config');
const { renderEntry, sitemapUrl, llmsLine } = require('./serializer');
const log = require('./log');

function insertAfter(src, anchor, insertion, file) {
  const i = src.indexOf(anchor);
  if (i === -1) throw new Error(`anchor not found in ${file}: ${JSON.stringify(anchor.slice(0, 40))}`);
  const at = i + anchor.length;
  return src.slice(0, at) + insertion + src.slice(at);
}

/**
 * @param {object} post finished, gate-passed post
 * @param {{dryRun?:boolean}} [opts]
 */
function apply(post, { dryRun = false } = {}) {
  const entry = renderEntry(post);
  const url = sitemapUrl(post.slug, post.date);
  const line = llmsLine(post.slug, post.title);

  // --- blogPosts.jsx ---
  let blog = fs.readFileSync(config.PATHS.blogPosts, 'utf8');
  if (blog.includes(`slug: '${post.slug}'`)) {
    throw new Error(`slug already published: ${post.slug}`);
  }
  blog = insertAfter(blog, 'export const BLOG_POSTS = [\n', `${entry}\n`, 'blogPosts.jsx');

  // --- sitemap.xml ---
  let sitemap = fs.readFileSync(config.PATHS.sitemap, 'utf8');
  sitemap = insertAfter(sitemap, '<!-- Blog -->\n', `${url}\n`, 'sitemap.xml');

  // --- llms.txt ---
  let llms = fs.readFileSync(config.PATHS.llms, 'utf8');
  llms = insertAfter(llms, '## Blog Posts\n\n', `${line}\n`, 'llms.txt');

  if (dryRun) {
    log.info('dry run — no files written');
    return { entry, url, line, wrote: [] };
  }

  fs.writeFileSync(config.PATHS.blogPosts, blog);
  fs.writeFileSync(config.PATHS.sitemap, sitemap);
  fs.writeFileSync(config.PATHS.llms, llms);
  const wrote = ['blogPosts.jsx', 'sitemap.xml', 'llms.txt'];
  log.ok(`published /blog/${post.slug} → wrote ${wrote.join(', ')}`);
  return { entry, url, line, wrote };
}

module.exports = { apply };
