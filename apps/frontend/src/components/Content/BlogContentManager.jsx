import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * Blog Content Management System
 * Allows management of blog posts with CRUD operations
 */
const BlogContentManager = ({ 
  initialPosts = [], 
  onPostCreate = () => {}, 
  onPostUpdate = () => {}, 
  onPostDelete = () => {} 
}) => {
  const [posts, setPosts] = useState(initialPosts);
  const [isCreating, setIsCreating] = useState(false);
  const [currentPost, setCurrentPost] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    excerpt: '',
    author: '',
    tags: '',
    published: false,
    publishDate: new Date().toISOString().split('T')[0]
  });

  // Load posts from localStorage if available
  useEffect(() => {
    const savedPosts = localStorage.getItem('blogPosts');
    if (savedPosts) {
      setPosts(JSON.parse(savedPosts));
    }
  }, []);

  // Save posts to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('blogPosts', JSON.stringify(posts));
  }, [posts]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (currentPost) {
      // Update existing post
      const updatedPosts = posts.map(post => 
        post.id === currentPost.id 
          ? { ...formData, id: currentPost.id, updatedAt: new Date().toISOString() } 
          : post
      );
      setPosts(updatedPosts);
      onPostUpdate({ ...formData, id: currentPost.id });
    } else {
      // Create new post
      const newPost = {
        ...formData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const updatedPosts = [newPost, ...posts];
      setPosts(updatedPosts);
      onPostCreate(newPost);
    }
    
    resetForm();
  };

  const handleEdit = (post) => {
    setCurrentPost(post);
    setFormData({
      title: post.title,
      content: post.content,
      excerpt: post.excerpt,
      author: post.author,
      tags: post.tags,
      published: post.published,
      publishDate: post.publishDate
    });
    setIsCreating(true);
  };

  const handleDelete = (postId) => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      const updatedPosts = posts.filter(post => post.id !== postId);
      setPosts(updatedPosts);
      onPostDelete(postId);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      excerpt: '',
      author: '',
      tags: '',
      published: false,
      publishDate: new Date().toISOString().split('T')[0]
    });
    setCurrentPost(null);
    setIsCreating(false);
  };

  const toggleCreateForm = () => {
    if (isCreating) {
      resetForm();
    } else {
      setIsCreating(true);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Blog Content Manager</h1>
        <button
          onClick={toggleCreateForm}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-500 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity"
        >
          {isCreating ? 'Cancel' : 'Create New Post'}
        </button>
      </div>

      {isCreating && (
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 mb-8 border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4">
            {currentPost ? 'Edit Post' : 'Create New Post'}
          </h2>
          
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-gray-300 mb-2" htmlFor="title">
                  Title
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-gray-300 mb-2" htmlFor="author">
                  Author
                </label>
                <input
                  type="text"
                  id="author"
                  name="author"
                  value={formData.author}
                  onChange={handleInputChange}
                  required
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-gray-300 mb-2" htmlFor="publishDate">
                  Publish Date
                </label>
                <input
                  type="date"
                  id="publishDate"
                  name="publishDate"
                  value={formData.publishDate}
                  onChange={handleInputChange}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="published"
                  name="published"
                  checked={formData.published}
                  onChange={handleInputChange}
                  className="w-5 h-5 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
                />
                <label className="ml-2 text-gray-300" htmlFor="published">
                  Published
                </label>
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-gray-300 mb-2" htmlFor="excerpt">
                Excerpt
              </label>
              <textarea
                id="excerpt"
                name="excerpt"
                value={formData.excerpt}
                onChange={handleInputChange}
                rows="3"
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-gray-300 mb-2" htmlFor="tags">
                Tags (comma separated)
              </label>
              <input
                type="text"
                id="tags"
                name="tags"
                value={formData.tags}
                onChange={handleInputChange}
                placeholder="tech, innovation, ai"
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-gray-300 mb-2" htmlFor="content">
                Content
              </label>
              <textarea
                id="content"
                name="content"
                value={formData.content}
                onChange={handleInputChange}
                rows="10"
                required
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            
            <div className="flex justify-end gap-4">
              {currentPost && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-500 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                {currentPost ? 'Update Post' : 'Create Post'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-white mb-4">Published Posts</h2>
        
        {posts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">No blog posts available. Create your first post!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts
              .filter(post => post.published)
              .map(post => (
                <div 
                  key={post.id} 
                  className="bg-gray-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-gray-700 hover:border-purple-500 transition-colors"
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg font-bold text-white">{post.title}</h3>
                      <span className={`px-2 py-1 rounded text-xs ${
                        post.published ? 'bg-green-900/50 text-green-300' : 'bg-yellow-900/50 text-yellow-300'
                      }`}>
                        {post.published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    
                    <p className="text-gray-400 text-sm mb-4 line-clamp-3">
                      {post.excerpt || post.content.substring(0, 100) + '...'}
                    </p>
                    
                    <div className="flex justify-between items-center text-xs text-gray-500 mb-4">
                      <span>By {post.author}</span>
                      <span>{new Date(post.publishDate).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      {post.tags.split(',').map((tag, index) => (
                        <span 
                          key={index} 
                          className="px-2 py-1 bg-gray-700/50 text-gray-300 rounded text-xs"
                        >
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(post)}
                        className="flex-1 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="flex-1 py-2 bg-red-900/50 text-red-300 rounded hover:bg-red-800/50 transition-colors text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {posts.filter(post => !post.published).length > 0 && (
        <div className="mt-12">
          <h2 className="text-2xl font-semibold text-white mb-4">Draft Posts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts
              .filter(post => !post.published)
              .map(post => (
                <div 
                  key={post.id} 
                  className="bg-gray-800/30 backdrop-blur-sm rounded-xl overflow-hidden border border-gray-700"
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg font-bold text-white">{post.title}</h3>
                      <span className="px-2 py-1 bg-yellow-900/50 text-yellow-300 rounded text-xs">
                        Draft
                      </span>
                    </div>
                    
                    <p className="text-gray-400 text-sm mb-4 line-clamp-3">
                      {post.excerpt || post.content.substring(0, 100) + '...'}
                    </p>
                    
                    <div className="flex justify-between items-center text-xs text-gray-500 mb-4">
                      <span>By {post.author}</span>
                      <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(post)}
                        className="flex-1 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="flex-1 py-2 bg-red-900/50 text-red-300 rounded hover:bg-red-800/50 transition-colors text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

BlogContentManager.propTypes = {
  /** Initial blog posts to load */
  initialPosts: PropTypes.array,
  /** Callback when a post is created */
  onPostCreate: PropTypes.func,
  /** Callback when a post is updated */
  onPostUpdate: PropTypes.func,
  /** Callback when a post is deleted */
  onPostDelete: PropTypes.func,
};

export default BlogContentManager;