/**
 * Blog Content Service
 * Provides API-like functions for managing blog content
 */

// Mock data for initial blog posts
const initialBlogPosts = [
  {
    id: '1',
    title: 'Getting Started with Truegle Search',
    content: '<p>Learn how to make the most of Truegle\'s unbiased search engine. Our platform provides comprehensive search results without the filter bubbles that plague traditional search engines.</p><p>With Truegle, you get multiple perspectives on any topic, helping you form a well-rounded understanding of complex issues.</p>',
    excerpt: 'Learn how to make the most of Truegle\'s unbiased search engine with multiple perspectives.',
    author: 'Truegle Team',
    publishDate: '2025-12-20',
    tags: 'search, tutorial, introduction',
    published: true,
    createdAt: '2025-12-20T10:00:00Z',
    updatedAt: '2025-12-20T10:00:00Z'
  },
  {
    id: '2',
    title: 'Understanding Our Red Pill vs Blue Pill Search Modes',
    content: '<p>Truegle offers two distinct search modes to help you explore different perspectives on any topic. The Blue Pill mode provides mainstream perspectives, while the Red Pill mode delves into alternative viewpoints.</p><p>Both modes are designed to give you a comprehensive understanding of any issue, allowing you to form your own conclusions based on diverse information sources.</p>',
    excerpt: 'Explore our unique Red Pill vs Blue Pill search modes for comprehensive perspectives.',
    author: 'Truegle Editorial',
    publishDate: '2025-12-22',
    tags: 'search modes, red pill, blue pill, perspective',
    published: true,
    createdAt: '2025-12-22T14:30:00Z',
    updatedAt: '2025-12-22T14:30:00Z'
  },
  {
    id: '3',
    title: 'Privacy-First Search: Why It Matters',
    content: '<p>In an age of data harvesting and privacy invasion, Truegle puts your privacy first. We don\'t track your searches, store your personal information, or build profiles about you.</p><p>Our search results are not personalized based on your search history, ensuring you get unbiased information rather than content designed to keep you engaged.</p>',
    excerpt: 'Learn why privacy-first search matters in the digital age.',
    author: 'Privacy Advocate',
    publishDate: '2025-12-25',
    tags: 'privacy, security, data protection',
    published: true,
    createdAt: '2025-12-25T09:15:00Z',
    updatedAt: '2025-12-25T09:15:00Z'
  }
];

/**
 * Get all blog posts
 * @param {boolean} publishedOnly - Whether to return only published posts
 * @returns {Array} Array of blog posts
 */
export const getBlogPosts = (publishedOnly = true) => {
  const posts = JSON.parse(localStorage.getItem('blogPosts') || JSON.stringify(initialBlogPosts));
  return publishedOnly ? posts.filter(post => post.published) : posts;
};

/**
 * Get a specific blog post by ID
 * @param {string} id - The post ID
 * @returns {Object|null} The blog post or null if not found
 */
export const getBlogPostById = (id) => {
  const posts = JSON.parse(localStorage.getItem('blogPosts') || JSON.stringify(initialBlogPosts));
  return posts.find(post => post.id === id) || null;
};

/**
 * Create a new blog post
 * @param {Object} postData - The post data
 * @returns {Object} The created blog post
 */
export const createBlogPost = (postData) => {
  const posts = JSON.parse(localStorage.getItem('blogPosts') || JSON.stringify(initialBlogPosts));
  
  const newPost = {
    ...postData,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  const updatedPosts = [newPost, ...posts];
  localStorage.setItem('blogPosts', JSON.stringify(updatedPosts));
  
  return newPost;
};

/**
 * Update an existing blog post
 * @param {string} id - The post ID
 * @param {Object} postData - The updated post data
 * @returns {Object|null} The updated blog post or null if not found
 */
export const updateBlogPost = (id, postData) => {
  const posts = JSON.parse(localStorage.getItem('blogPosts') || JSON.stringify(initialBlogPosts));
  
  const postIndex = posts.findIndex(post => post.id === id);
  if (postIndex === -1) return null;
  
  const updatedPost = {
    ...posts[postIndex],
    ...postData,
    updatedAt: new Date().toISOString()
  };
  
  posts[postIndex] = updatedPost;
  localStorage.setItem('blogPosts', JSON.stringify(posts));
  
  return updatedPost;
};

/**
 * Delete a blog post
 * @param {string} id - The post ID
 * @returns {boolean} True if deleted, false if not found
 */
export const deleteBlogPost = (id) => {
  const posts = JSON.parse(localStorage.getItem('blogPosts') || JSON.stringify(initialBlogPosts));
  
  const initialLength = posts.length;
  const updatedPosts = posts.filter(post => post.id !== id);
  
  if (updatedPosts.length === initialLength) return false; // Post not found
  
  localStorage.setItem('blogPosts', JSON.stringify(updatedPosts));
  return true;
};

/**
 * Get blog posts by tag
 * @param {string} tag - The tag to filter by
 * @param {boolean} publishedOnly - Whether to return only published posts
 * @returns {Array} Array of blog posts with the specified tag
 */
export const getBlogPostsByTag = (tag, publishedOnly = true) => {
  const posts = getBlogPosts(publishedOnly);
  return posts.filter(post => {
    const tags = post.tags ? post.tags.split(',').map(t => t.trim().toLowerCase()) : [];
    return tags.includes(tag.toLowerCase());
  });
};

/**
 * Get blog posts by author
 * @param {string} author - The author to filter by
 * @param {boolean} publishedOnly - Whether to return only published posts
 * @returns {Array} Array of blog posts by the specified author
 */
export const getBlogPostsByAuthor = (author, publishedOnly = true) => {
  const posts = getBlogPosts(publishedOnly);
  return posts.filter(post => post.author.toLowerCase().includes(author.toLowerCase()));
};