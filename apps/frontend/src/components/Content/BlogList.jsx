import React from 'react';
import PropTypes from 'prop-types';
import BlogPost from './BlogPost';

/**
 * Blog List Component
 * Displays a list of blog posts
 */
const BlogList = ({ posts = [], className = '' }) => {
  if (!posts || posts.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <p className="text-gray-400">No blog posts available.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-8 ${className}`}>
      {posts.map((post) => (
        <BlogPost
          key={post.id}
          id={post.id}
          title={post.title}
          content={post.content}
          excerpt={post.excerpt}
          author={post.author}
          publishDate={post.publishDate}
          tags={post.tags ? post.tags.split(',').map(tag => tag.trim()) : []}
          published={post.published}
        />
      ))}
    </div>
  );
};

BlogList.propTypes = {
  /** Array of blog post objects */
  posts: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      content: PropTypes.string,
      excerpt: PropTypes.string,
      author: PropTypes.string.isRequired,
      publishDate: PropTypes.string.isRequired,
      tags: PropTypes.string,
      published: PropTypes.bool,
    })
  ),
  /** Additional CSS classes */
  className: PropTypes.string,
};

export default BlogList;